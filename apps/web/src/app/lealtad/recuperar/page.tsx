import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Aviso } from '@/components/lealtad/Aviso';
import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { FormularioRecuperar } from './FormularioRecuperar';

export const metadata: Metadata = { title: 'Olvidé mi contraseña' };
export const dynamic = 'force-dynamic';

/**
 * «Olvidé mi contraseña» (y «todavía no tengo»).
 *
 * Con correo en la tarjeta, el enlace llega ahí. Si solo tiene celular, queda
 * una solicitud en la caja de su sucursal, que le manda el enlace por
 * WhatsApp en horario de atención: la app no envía SMS ni WhatsApp. La
 * respuesta es la misma en todos los casos.
 */
export default async function RecuperarPage() {
  if (await tarjetaDeEsteNavegador()) redirect('/lealtad/tarjeta');
  return (
    <>
      <div className="grid gap-1">
        <a href="/lealtad/entrar" className="text-sm text-crust-dark underline underline-offset-4">
          ← Volver
        </a>
        <h1 className="text-2xl text-ink">Olvidé mi contraseña</h1>
        <p className="text-sm text-ink-soft">
          Escribe el correo o el celular de tu tarjeta. Te haremos llegar un enlace para entrar y
          crear una contraseña nueva. Sirve también si todavía no tienes contraseña.
        </p>
      </div>
      <FormularioRecuperar />
      <Aviso tono="neutro" titulo="Tu tarjeta está protegida" icono="candado">
        Escribir un correo o un celular no da acceso a ninguna tarjeta: solo entra quien recibe el
        enlace. Si estás en la sucursal, también pueden generarte un enlace en caja.
      </Aviso>
    </>
  );
}
