import type { Metadata } from 'next';
import { confirmarCorreoUsuario } from '@wl/database';

import { LogoMarca } from '@/components/Marca';
import { cuentaDelEnlace } from '@/lib/admin/confirmar-correo';
import { exigirNegocio, ruta } from '@/lib/negocio';

export const metadata: Metadata = {
  title: 'Confirmar correo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Destino del enlace «Confirmar mi correo» (bienvenida del alta y «Mi
 * cuenta»). No abre sesión: solo deja el correo como comprobado, y así
 * «Olvidé mi contraseña» ya puede mandarle el enlace.
 */
export default async function ConfirmarCorreo({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, negocio] = await Promise.all([params, exigirNegocio()]);
  const cuenta = await cuentaDelEnlace(negocio.id, token);
  if (cuenta && !cuenta.confirmado) await confirmarCorreoUsuario(cuenta.userId, cuenta.email);
  const panel = await ruta('/admin');

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4"
    >
      <div className="pb-8">
        <LogoMarca sobre="claro" className="h-12 text-2xl text-ink" />
      </div>
      {cuenta ? (
        <>
          <h1 className="font-display text-2xl text-ink">Tu correo quedó confirmado</h1>
          <p className="mt-3 text-[15px] text-ink-soft">
            Si un día olvidas tu contraseña, te mandaremos el enlace a{' '}
            <b className="break-all text-ink">{cuenta.email}</b>.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl text-ink">Este enlace ya no sirve</h1>
          <p className="mt-3 text-[15px] text-ink-soft">
            Entra a tu panel y pide uno nuevo en «Mi cuenta».
          </p>
        </>
      )}
      <a
        href={panel}
        className="mt-8 inline-flex min-h-[48px] items-center justify-center self-start rounded-full bg-ink px-6 text-[15px] font-semibold text-cream"
      >
        Ir a mi panel
      </a>
    </main>
  );
}
