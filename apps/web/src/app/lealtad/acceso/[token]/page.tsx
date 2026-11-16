import type { Metadata } from 'next';
import { consultarEnlaceAcceso } from '@wl/database';

import { Aviso } from '@/components/lealtad/Aviso';
import { AvisoNavegadorIntegrado } from '@/components/lealtad/AvisoNavegadorIntegrado';
import { BotonAcceso } from './BotonAcceso';

export const metadata: Metadata = { title: 'Abrir mi tarjeta' };
export const dynamic = 'force-dynamic';

/**
 * Destino de los enlaces de acceso: bienvenida del alta en caja, «Olvidé mi
 * contraseña» (correo o WhatsApp de la sucursal) y el que genera la caja.
 *
 * Abrir la página no consume el enlace: hace falta tocar el botón. Algunos
 * filtros de correo abren cada enlace para revisarlo y, si bastara con eso,
 * gastarían el acceso antes que la persona.
 *
 * Solo el enlace de «Olvidé mi contraseña» obliga a crear una nueva; en los
 * demás es opcional (nov 2026).
 */
export default async function AccesoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const estado = await consultarEnlaceAcceso(token);

  if (!estado.valido) {
    return (
      <>
        <h1 className="text-2xl text-ink">Abrir mi tarjeta</h1>
        <Aviso tono="error" titulo="Este enlace ya no sirve">
          Ya se usó o venció.{' '}
          <a href="/lealtad/entrar" className="font-semibold underline">
            Entrar con mi contraseña
          </a>{' '}
          o{' '}
          <a href="/lealtad/recuperar" className="font-semibold underline">
            pedir otro enlace
          </a>
          .
        </Aviso>
      </>
    );
  }

  const obligatoria = estado.contrasena === 'OBLIGATORIA';
  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">
          {obligatoria ? 'Crea tu contraseña' : 'Abrir mi tarjeta'}
        </h1>
        <p className="text-sm text-ink-soft">
          {obligatoria
            ? 'Con ella entrarás a tu tarjeta desde cualquier celular, escribiendo tu correo o tu celular. El enlace sirve una sola vez.'
            : 'Toca el botón para abrir tu tarjeta de lealtad en este celular. El enlace sirve una sola vez.'}
        </p>
      </div>
      <AvisoNavegadorIntegrado />
      <BotonAcceso token={token} contrasena={estado.contrasena} usuario={estado.usuario} />
    </>
  );
}
