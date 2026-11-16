import { redirect } from 'next/navigation';

import { negocioDeLaPeticion } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

/**
 * Raíz. En el subdominio de un negocio lleva a su programa de lealtad; en el
 * dominio de plataforma muestra una portada mínima (el panel de plataforma
 * llega en la Fase 3).
 */
export default async function Inicio() {
  const negocio = await negocioDeLaPeticion();
  if (negocio) redirect('/lealtad');
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-3 px-6 text-center">
      <h1 className="text-3xl">Loyalty WL</h1>
      <p className="text-muted">
        Programas de lealtad para negocios. Cada negocio vive en su propia dirección.
      </p>
    </main>
  );
}
