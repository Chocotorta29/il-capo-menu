import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(request) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;

    if (!token) {
      console.error('ERROR: No se encontró MP_ACCESS_TOKEN');
      return NextResponse.json(
        { error: 'Servidor no configurado: falta MP_ACCESS_TOKEN' },
        { status: 500 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const body = await request.json();
    const { cart, customerName, address, orderType } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    // Mapeo seguro de los ítems
    const items = cart.map((item) => {
      const rawPrice = item.unit_price || item.price || item.precio || 0;
      const cleanPrice = typeof rawPrice === 'string'
        ? parseFloat(rawPrice.replace(/[^0-9.-]+/g, ''))
        : Number(rawPrice);

      return {
        id: String(item.id || item._id || 'item'),
        title: String(item.title || item.name || item.nombre || 'Producto'),
        quantity: Number(item.quantity || item.cantidad || 1),
        unit_price: isNaN(cleanPrice) || cleanPrice <= 0 ? 100 : cleanPrice,
        currency_id: 'ARS',
      };
    });

    const preference = new Preference(client);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const result = await preference.create({
      body: {
        items,
        payer: {
          name: customerName ? String(customerName) : 'Cliente',
        },
        metadata: {
          customer_name: customerName || '',
          address: address || '',
          order_type: orderType || '',
        },
        back_urls: {
          success: `${baseUrl}/`,
          failure: `${baseUrl}/`,
          pending: `${baseUrl}/`,
        },
      },
    });

    return NextResponse.json({ init_point: result.init_point });
  } catch (error) {
    console.error('=== ERROR MERCADO PAGO ===', error);
    return NextResponse.json(
      { 
        error: 'Error al generar preferencia', 
        details: error?.message || String(error) 
      },
      { status: 500 }
    );
  }
}