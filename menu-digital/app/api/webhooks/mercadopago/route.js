import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    // Escuchar únicamente notificaciones de pago
    if (topic === 'payment' && id) {
      // 1. Consultar a la API de Mercado Pago la veracidad del pago
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      });

      const paymentData = await res.json();

      // 2. Si el pago está APROBADO, guardamos el pedido pagado en Supabase
      if (paymentData.status === 'approved') {
        const metadata = paymentData.metadata;

        await supabase.from('orders').insert([
          {
            mp_payment_id: id,
            customer_name: metadata.customer_name,
            address: metadata.address,
            order_type: metadata.order_type,
            total_amount: paymentData.transaction_amount,
            status: 'pagado',
            cart_details: metadata.cart_details,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Error Webhook Mercado Pago:', err);
    return new Response('Error interno', { status: 500 });
  }
}