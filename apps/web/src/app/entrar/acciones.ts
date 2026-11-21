'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import {
  clubesDelCorreo,
  conNegocio,
  hashContrasena,
  iniciarSesion,
  solicitarRecuperacion,
} from '@wl/database';

import { mandarRecuperacion } from '@/lib/admin/correos-usuarios';
import { contextoPeticion, guardarSesionEnNavegador } from '@/lib/admin/sesion';
import { negocioDeLaPeticion, origenDeLaPeticion } from '@/lib/negocio';

export interface EstadoEntrar {
  readonly error: string | null;
}

const GENERICO = 'Correo o contraseña incorrectos.';

/**
 * Entrar al panel desde el sitio del servicio, sin saber la dirección del
 * club: se buscan los clubes donde ese correo tiene cuenta y se prueba la
 * contraseña en cada uno, con el mismo `iniciarSesion` (bitácora y bloqueo
 * incluidos). La sesión queda en la dirección del club que respondió.
 *
 * Un solo mensaje de error para todo, como en la pantalla de cada club. Si el
 * correo no tiene club, se calcula igual un hash para que la respuesta tarde
 * lo mismo y no delate qué correos existen.
 */
export async function entrarDesdeElSitio(
  _previo: EstadoEntrar,
  form: FormData,
): Promise<EstadoEntrar> {
  if (process.env.WL_NEGOCIO_UNICO || (await negocioDeLaPeticion())) {
    return { error: 'Entra desde la dirección de tu club.' };
  }
  const correo = String(form.get('correo') ?? '')
    .trim()
    .toLowerCase();
  const clave = String(form.get('clave') ?? '');
  if (!correo || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const clubes = await clubesDelCorreo(correo);
  if (clubes.length === 0) {
    await hashContrasena(clave);
    return { error: GENERICO };
  }

  const contexto = await contextoPeticion();
  let motivo = GENERICO;
  let destino: string | null = null;
  for (const club of clubes) {
    const acceso = await conNegocio(club, () => iniciarSesion(correo, clave, contexto));
    if (acceso.ok) {
      await guardarSesionEnNavegador(acceso.token, acceso.expira, `/${club.slug}`);
      destino = `/${club.slug}/admin`;
      break;
    }
    // «Demasiados intentos» pesa más que el genérico: es lo que debe leer.
    if (acceso.motivo !== GENERICO) motivo = acceso.motivo;
  }
  // Fuera del ciclo: `redirect` lanza una excepción de control de Next.
  if (destino) redirect(destino);
  return { error: motivo };
}

export interface EstadoRecuperarSitio {
  readonly error: string | null;
  readonly enviado: boolean;
}

/**
 * «Olvidé mi contraseña» desde el sitio del servicio. Por cada club de ese
 * correo pide el enlace como lo haría la pantalla del club; el correo sale
 * después de responder, y la respuesta es la misma exista o no la cuenta.
 */
export async function recuperarDesdeElSitio(
  _previo: EstadoRecuperarSitio,
  form: FormData,
): Promise<EstadoRecuperarSitio> {
  if (process.env.WL_NEGOCIO_UNICO || (await negocioDeLaPeticion())) {
    return { error: 'Pídelo desde la dirección de tu club.', enviado: false };
  }
  const correo = String(form.get('correo') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: 'Escribe un correo válido.', enviado: false };
  }
  const { ip } = await contextoPeticion();
  const origen = await origenDeLaPeticion();
  for (const club of await clubesDelCorreo(correo)) {
    const r = await conNegocio(club, () => solicitarRecuperacion(correo, ip));
    const { token, nombre } = r;
    if (token && nombre !== null) {
      after(async () => {
        const envio = await mandarRecuperacion({
          email: correo,
          nombre,
          token,
          club: { nombre: club.nombre, origen: `${origen}/${club.slug}` },
        });
        if (!envio.ok) console.error('No salió el correo de recuperación:', envio.error);
      });
    }
  }
  return { error: null, enviado: true };
}
