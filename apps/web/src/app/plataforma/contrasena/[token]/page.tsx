import type { Metadata } from 'next';
import { consultarEnlacePlataforma } from '@wl/database';

import { LogotipoClub } from '@/components/ClubLealtad';

import { FormularioNuevaContrasena } from '../../equipo/Formularios';

export const metadata: Metadata = { title: 'Contraseña', referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

/** Elegir la contraseña de una cuenta de plataforma con un enlace de un solo uso. */
export default async function ContrasenaPlataformaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const enlace = await consultarEnlacePlataforma(decodeURIComponent(token));
  return (
    <main id="contenido" className="mx-auto grid min-h-screen max-w-sm content-center gap-8 px-5">
      <div className="grid gap-2">
        <LogotipoClub tam={22} />
        <h1 className="mt-4 text-4xl">
          {enlace.ok && enlace.primeraVez ? 'Bienvenido' : 'Contraseña nueva'}
        </h1>
        <p className="text-[15px] text-muted">
          {enlace.ok
            ? `${enlace.nombre}, elige la contraseña con la que entrarás a la plataforma (${enlace.email}).`
            : 'Este enlace ya se usó o venció.'}
        </p>
      </div>
      {enlace.ok ? (
        <FormularioNuevaContrasena token={decodeURIComponent(token)} email={enlace.email} />
      ) : (
        <p className="text-[15px]">
          <a href="/plataforma/entrar/recuperar" className="text-ink underline underline-offset-4">
            Pedir un enlace nuevo
          </a>{' '}
          o pídele a alguien del equipo que te genere uno.
        </p>
      )}
    </main>
  );
}
