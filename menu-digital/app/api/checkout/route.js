import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export async function POST(request) {
  try {
    const { cart, customerName, address, orderType, notes } = await request.json();

    const items = cart.map((item) => ({
      title: item.title || item.name,
      unit_price: Number(item.price),
      quantity: Number(item.quantity || 1),
      currency_id: 'ARS',
    }));

    const preference = new Preference(client);

    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:3000';

    const result = await preference.create({
      body: {
        items,
        payer: {
          name: customerName,
        },
        metadata: {
          customer_name: customerName,
          address: address || 'Retiro en local',
          order_type: orderType,
          notes: notes || '',
        },
        back_urls: {
          success: `${baseUrl}/pedido-exitoso`,
          failure: `${baseUrl}/`,
          pending: `${baseUrl}/`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });

    return Response.json({ init_point: result.init_point });
  } catch (error) {
    console.error('Error al crear preferencia MP:', error);
    return Response.json({ error: 'Error al generar el pago' }, { status: 500 });
  }
}