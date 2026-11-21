import type { Metadata } from 'next';

import { tarjetaDeLaBaja } from '@/lib/mensajes';
import { exigirNegocio } from '@/lib/negocio';

import { darmeDeBaja, volverARecibir } from './acciones';

export const metadata: Metadata = {
  title: 'Promociones',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

const BOTON =
  'inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-semibold';

/**
 * Enlace «Ya no quiero recibir promociones» de los mensajes del negocio. No
 * da de baja al abrirse (los filtros de correo abren los enlaces para
 * revisarlos): pide un toque. La tarjeta y sus sellos no cambian.
 */
export default async function BajaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ listo?: string }>;
}) {
  const [{ token }, { listo }, negocio] = await Promise.all([
    params,
    searchParams,
    exigirNegocio(),
  ]);
  const valido = Boolean(await tarjetaDeLaBaja(negocio.id, token));

  if (!valido) {
    return (
      <section className="grid gap-3">
        <h1 className="text-2xl text-ink">Este enlace no sirve</h1>
        <p className="text-[15px] text-ink-soft">
          Puedes apagar las promociones desde tu tarjeta, en tu perfil.
        </p>
      </section>
    );
  }

  if (listo === 'baja') {
    return (
      <section className="grid gap-4">
        <h1 className="text-2xl text-ink">Listo, ya no te mandaremos promociones</h1>
        <p className="text-[15px] text-ink-soft">
          Tu tarjeta de {negocio.nombre} y tus sellos siguen igual. Los avisos de tu tarjeta, como
          tus premios, te siguen llegando.
        </p>
        <form action={volverARecibir}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={`${BOTON} border-[1.5px] border-ink text-ink`}>
            Fue un error: quiero recibirlas
          </button>
        </form>
      </section>
    );
  }

  if (listo === 'alta') {
    return (
      <section className="grid gap-3">
        <h1 className="text-2xl text-ink">Listo, te volveremos a escribir</h1>
        <p className="text-[15px] text-ink-soft">
          Recibirás las promociones de {negocio.nombre} en tu correo.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl text-ink">¿Ya no quieres recibir promociones de {negocio.nombre}?</h1>
      <p className="text-[15px] text-ink-soft">
        Tu tarjeta y tus sellos no cambian. Solo dejaremos de mandarte promociones por correo.
      </p>
      <form action={darmeDeBaja}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={`${BOTON} bg-ink text-cream`}>
          Ya no quiero recibirlas
        </button>
      </form>
    </section>
  );
}
