import { redirect } from 'next/navigation';
import { abrirConEnlacePersonal, canjearEnlaceAcceso } from '@wl/database';

import { guardarSesionTarjeta, tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';

export const dynamic = 'force-dynamic';

/**
 * Arranque de la tarjeta instalada como aplicación (`start_url` del manifest).
 *
 * Si la app ya tiene sesión, directo a la tarjeta. Si no, abre sesión con el
 * enlace personal permanente que trae en `mi` (desde nov 2026: la app
 * instalada nunca se queda sin acceso) o, en apps instaladas antes, con el
 * enlace de un solo uso de `t` (30 días). Si no hay ninguno válido, a «Entra a
 * tu tarjeta» (correo o celular + contraseña).
 *
 * Es un Route Handler y no una página: abrir sesión escribe una cookie, y
 * Next.js solo deja escribir cookies en acciones de servidor y Route Handlers.
 * Como página fallaba justo en el caso del iPhone, donde la app instalada no
 * comparte cookies con Safari y llega sin sesión la primera vez.
 */
export async function GET(req: Request): Promise<never> {
  const actual = await tarjetaDeEsteNavegador();
  if (actual) {
    redirect('/lealtad/tarjeta');
  }

  const q = new URL(req.url).searchParams;
  const mi = q.get('mi');
  if (mi) {
    const r = await abrirConEnlacePersonal(mi, { userAgent: req.headers.get('user-agent') });
    if (r.ok) {
      await guardarSesionTarjeta(r.token, r.expira);
      redirect('/lealtad/tarjeta');
    }
  }

  const t = q.get('t');
  if (t) {
    const r = await canjearEnlaceAcceso(t, req.headers.get('user-agent'));
    if (r.ok) {
      await guardarSesionTarjeta(r.token, r.expira);
      redirect('/lealtad/tarjeta');
    }
  }
  redirect('/lealtad/entrar');
}
