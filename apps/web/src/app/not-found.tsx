import Link from 'next/link';

import { Marco } from '@/components/sitio/Marco';
import { negocioDeLaPeticion } from '@/lib/negocio';

const TEXTO = 'Revisa la dirección. Si escaneaste un código, vuelve a intentarlo.';

/**
 * Página no encontrada. Dentro de un negocio (su tarjeta o su panel) es neutra
 * y toma los colores del negocio; fuera de un negocio, en club-lealtad.com, va
 * con el marco y la marca del sitio.
 */
export default async function NoEncontrado() {
  const negocio = await negocioDeLaPeticion().catch(() => null);

  if (negocio) {
    return (
      <main className="mx-auto grid min-h-screen max-w-md content-center gap-3 px-6 text-center">
        <h1 className="text-3xl">No encontramos esta página</h1>
        <p className="text-muted">{TEXTO}</p>
      </main>
    );
  }

  return (
    <Marco compacto>
      <section className="sec">
        <div className="wrap col" style={{ gap: 18, alignItems: 'flex-start' }}>
          <span className="chip">Error 404</span>
          <h1 className="d h2">No encontramos esta página</h1>
          <p className="lead">{TEXTO}</p>
          <Link href="/" className="btn">
            Ir al inicio
          </Link>
        </div>
      </section>
    </Marco>
  );
}
