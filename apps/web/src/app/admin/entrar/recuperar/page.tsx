import type { Metadata } from 'next';

import { FormularioRecuperar } from './FormularioRecuperar';
import { LogoMarca } from '@/components/Marca';

export const metadata: Metadata = {
  title: 'Restablecer contraseña · Panel',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * «Olvidé mi contraseña».
 *
 * Solo manda el enlace a cuentas cuyo correo ya se comprobó (usaron antes un
 * enlace que les llegó ahí). Las demás tienen que pedirlo a administración:
 * ver `solicitarRecuperacion` en @wl/database.
 */
export default function RecuperarPage() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4"
    >
      <div className="pb-8">
        <LogoMarca sobre="claro" className="h-12 text-2xl text-ink" />
        <h1 className="mt-1 text-lg text-ink-soft">Restablecer contraseña</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Escribe el correo con el que entras al panel y te mandamos un enlace para elegir una
          contraseña nueva.
        </p>
      </div>

      <FormularioRecuperar />

      <p className="mt-8 text-sm">
        <a href="/admin/entrar" className="text-ink underline underline-offset-4">
          Volver a entrar
        </a>
      </p>
    </main>
  );
}
