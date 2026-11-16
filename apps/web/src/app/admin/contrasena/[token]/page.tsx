import type { Metadata } from 'next';
import { LONGITUD_MINIMA_CONTRASENA, consultarEnlace } from '@wl/database';

import { FormularioContrasena } from './FormularioContrasena';
import { LogoMarca } from '@/components/Marca';

export const metadata: Metadata = {
  title: 'Elegir contraseña · Panel',
  robots: { index: false, follow: false },
  // El token va en la dirección: que no se filtre como «página de origen» si
  // alguien toca un enlace desde aquí.
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

/**
 * Destino de los enlaces de contraseña (invitación, restablecimiento y «olvidé
 * mi contraseña»).
 *
 * Abrir la página no gasta el enlace: se gasta al guardar. Algunos filtros de
 * correo abren cada enlace para revisarlo y, si bastara con eso, lo gastarían
 * antes que la persona.
 */
export default async function ContrasenaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const estado = await consultarEnlace(token);

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4"
    >
      <div className="pb-8">
        <LogoMarca sobre="claro" className="h-12 text-2xl text-ink" />
        <h1 className="mt-1 text-lg text-ink-soft">
          {estado.ok && estado.primeraVez ? 'Elige tu contraseña' : 'Contraseña nueva'}
        </h1>
      </div>

      {estado.ok ? (
        <>
          <p className="pb-6 text-sm text-ink-soft">
            Hola, {estado.nombre.split(' ')[0]}. Con esta contraseña entrarás al panel con{' '}
            <span className="font-medium break-all text-ink">{estado.email}</span>.
            {!estado.primeraVez && ' La anterior deja de servir en cuanto guardes esta.'}
          </p>
          <FormularioContrasena
            token={token}
            email={estado.email}
            minimo={LONGITUD_MINIMA_CONTRASENA}
          />
        </>
      ) : (
        <div className="space-y-4 text-sm text-ink-soft">
          <p>{estado.error}</p>
          <p>
            <a href="/admin/entrar/recuperar" className="text-ink underline underline-offset-4">
              Pedir un enlace nuevo
            </a>{' '}
            o pide a administración que te genere otro.
          </p>
        </div>
      )}
    </main>
  );
}
