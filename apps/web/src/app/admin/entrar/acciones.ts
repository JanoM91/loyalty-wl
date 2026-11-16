'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import {
  NOMBRE_COOKIE,
  cerrarSesion,
  definirContrasenaConEnlace,
  iniciarSesion,
  solicitarRecuperacion,
} from '@wl/database';

import { mandarRecuperacion } from '@/lib/admin/correos-usuarios';
import { contextoPeticion, guardarSesionEnNavegador } from '@/lib/admin/sesion';
import { rutaBase, ruta } from '@/lib/negocio';

export interface EstadoAcceso {
  readonly error: string | null;
}

/**
 * Entrar al panel.
 *
 * El resultado se decide entero en el servidor. El formulario solo dibuja lo
 * que esta función devuelve: nada de lo que llegue del navegador se cree.
 */
export async function entrar(_previo: EstadoAcceso, form: FormData): Promise<EstadoAcceso> {
  const email = String(form.get('email') ?? '');
  const clave = String(form.get('clave') ?? '');

  const resultado = await iniciarSesion(email, clave, await contextoPeticion());

  if (!resultado.ok) return { error: resultado.motivo };

  await guardarSesionEnNavegador(resultado.token, resultado.expira);

  // Fuera del try: `redirect` lanza una excepción de control de Next.
  redirect(await ruta('/admin'));
}

export async function salir(): Promise<void> {
  const galletas = await cookies();
  const token = galletas.get(NOMBRE_COOKIE)?.value;

  // Se borra de la base y no solo del navegador. Si solo se quitara la cookie,
  // una copia del token seguiría sirviendo para entrar.
  await cerrarSesion(token);
  galletas.delete({ name: NOMBRE_COOKIE, path: (await rutaBase()) || '/' });

  redirect(await ruta('/admin/entrar'));
}

// ---------------------------------------------------------------------------
// Olvidé mi contraseña
// ---------------------------------------------------------------------------

export interface EstadoRecuperar {
  readonly error: string | null;
  readonly enviado: boolean;
}

/**
 * Pide un enlace para restablecer la contraseña.
 *
 * Exista o no la cuenta, la respuesta es la misma y tarda lo mismo: el correo
 * se manda después de responder (`after`), para que el tiempo de espera no
 * delate qué correos tienen cuenta.
 */
export async function pedirRecuperacion(
  _previo: EstadoRecuperar,
  form: FormData,
): Promise<EstadoRecuperar> {
  const { ip } = await contextoPeticion();
  const r = await solicitarRecuperacion(String(form.get('email') ?? ''), ip);
  const { token, email, nombre } = r;
  if (!email) return { error: 'Escribe un correo válido.', enviado: false };

  if (token && nombre) {
    after(async () => {
      const envio = await mandarRecuperacion({ email, nombre, token });
      if (!envio.ok) console.error('No salió el correo de recuperación del panel:', envio.error);
    });
  }
  return { error: null, enviado: true };
}

// ---------------------------------------------------------------------------
// Definir la contraseña con un enlace
// ---------------------------------------------------------------------------

export interface EstadoContrasena {
  readonly error: string | null;
}

/**
 * Gasta el enlace, guarda la contraseña y deja a la persona dentro del panel.
 *
 * La sesión se abre con `iniciarSesion`, igual que en la pantalla de acceso:
 * así queda registrada en la bitácora de accesos y respeta el bloqueo.
 */
export async function fijarContrasena(
  _previo: EstadoContrasena,
  form: FormData,
): Promise<EstadoContrasena> {
  const token = String(form.get('token') ?? '');
  const clave = String(form.get('clave') ?? '');
  const confirmacion = String(form.get('confirmacion') ?? '');

  if (clave !== confirmacion) return { error: 'Las dos contraseñas no coinciden.' };

  const r = await definirContrasenaConEnlace(token, clave);
  if (!r.ok) return { error: r.error };

  const acceso = await iniciarSesion(r.email, clave, await contextoPeticion());
  if (!acceso.ok) redirect(await ruta('/admin/entrar?contrasena=lista'));

  await guardarSesionEnNavegador(acceso.token, acceso.expira);
  redirect(await ruta('/admin'));
}
