import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { FormularioEntrar } from './FormularioEntrar';

export const metadata: Metadata = { title: 'Entra a tu tarjeta' };
export const dynamic = 'force-dynamic';

/**
 * Entrar con «correo o celular + contraseña».
 *
 * Una sola contraseña por tarjeta: sirve igual con el correo que con el
 * celular. Quien todavía no tiene contraseña la crea al abrir un enlace de
 * acceso («Olvidé mi contraseña» o el que le dan en caja).
 */
export default async function EntrarPage() {
  if (await tarjetaDeEsteNavegador()) redirect('/lealtad/tarjeta');
  return (
    <>
      <div className="grid gap-1">
        <a href="/lealtad" className="text-sm text-crust-dark underline underline-offset-4">
          ← Volver
        </a>
        <h1 className="text-2xl text-ink">Entra a tu tarjeta</h1>
        <p className="text-sm text-ink-soft">
          Escribe el correo o el celular de tu tarjeta y tu contraseña.
        </p>
      </div>
      <FormularioEntrar />
      <div className="grid gap-1 text-sm text-ink-soft">
        <a
          href="/lealtad/recuperar"
          className="font-semibold text-crust-dark underline underline-offset-4"
        >
          Olvidé mi contraseña · Todavía no tengo contraseña
        </a>
        <p className="text-xs text-muted">
          Te mandamos un enlace a tu correo o, si solo diste tu celular, tu sucursal te lo envía por
          WhatsApp.
        </p>
      </div>
    </>
  );
}
