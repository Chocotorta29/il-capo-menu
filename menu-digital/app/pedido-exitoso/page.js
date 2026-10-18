'use client';
import Link from 'next/link';

export default function PedidoExitosoPage() {
  const PHONE_NUMBER = '542236819158';

  const sendWhatsAppConfirmation = () => {
    const text = encodeURIComponent(
      '¡Hola! Acabo de realizar y abonar mi pedido por Mercado Pago a través de la web. ¡Muchas gracias!'
    );
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center text-4xl mb-4">
        ✓
      </div>
      <h1 className="text-2xl font-black text-amber-400">¡Pago Aprobado!</h1>
      <p className="text-xs text-neutral-400 mt-2 max-w-sm leading-relaxed">
        Tu pago se procesó correctamente. Avisale al local por WhatsApp para iniciar la preparación.
      </p>

      <button
        onClick={sendWhatsAppConfirmation}
        className="mt-6 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2"
      >
        <span>Enviar Confirmación a WhatsApp 📲</span>
      </button>

      <Link href="/" className="mt-4 text-xs text-neutral-500 hover:text-neutral-300 underline">
        Volver al Menú
      </Link>
    </div>
  );
}