import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tarjeta de lealtad' };

/**
 * Lo que ve alguien que escanea con la cámara del celular el código de una
 * tarjeta. A propósito no muestra nada de la tarjeta: el código es para la
 * caja, y quien lo fotografía no debe obtener datos de nadie.
 */
export default function CodigoEscaneadoPage() {
  return (
    <section className="grid gap-3 rounded-xl border border-rule bg-cream p-5 text-center">
      <h1 className="text-2xl text-ink">Es una tarjeta de lealtad</h1>
      <p className="text-sm text-ink-soft">
        Este código sirve para sumar estampas y canjear premios en caja. Si es tuyo, muéstralo al
        personal en tu próxima compra.
      </p>
      <a
        href="/lealtad"
        className="mx-auto inline-flex min-h-[48px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft"
      >
        Conoce el programa
      </a>
    </section>
  );
}
