import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  NOMBRE_COOKIE_PLATAFORMA,
  leerSesionPlataforma,
  type SesionPlataforma,
} from '@wl/database';

/**
 * Sesión del panel de plataforma (Exkalibur). Cada página y cada acción llama
 * a `exigirPlataforma()`: un layout no se vuelve a ejecutar al navegar.
 */
export async function exigirPlataforma(): Promise<SesionPlataforma> {
  const galletas = await cookies();
  const sesion = await leerSesionPlataforma(galletas.get(NOMBRE_COOKIE_PLATAFORMA)?.value);
  if (!sesion) redirect('/plataforma/entrar');
  return sesion;
}

export async function guardarSesionPlataforma(token: string, expira: Date): Promise<void> {
  const galletas = await cookies();
  galletas.set(NOMBRE_COOKIE_PLATAFORMA, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Solo viaja al panel de plataforma, nunca a las páginas de un negocio.
    path: '/plataforma',
    expires: expira,
  });
}
