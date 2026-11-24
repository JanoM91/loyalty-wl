'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import {
  NOMBRE_COOKIE_PLATAFORMA,
  cambiarContrasenaPlataforma,
  cambiarEstadoCuentaPlataforma,
  cerrarOtrasSesionesPlataforma,
  definirContrasenaPlataforma,
  enlaceParaCuentaPlataforma,
  invitarCuentaPlataforma,
  solicitarRecuperacionPlataforma,
} from '@wl/database';

import { enviarCorreo } from '@/lib/correo';
import { anotar } from '@/lib/plataforma/bitacora';
import {
  correoDeInvitacion,
  correoDeRecuperacion,
  enlaceDeContrasena,
} from '@/lib/plataforma/correos';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

export interface EstadoEquipo {
  readonly error: string | null;
  readonly listo: string | null;
  /** Enlace de un solo uso para mostrarlo una vez. */
  readonly enlace?: string;
  /** Carga completa de esta dirección al terminar (ver la nota en ../acciones.ts). */
  readonly recargar?: string;
}

/** Dirección de esta misma instalación, para el enlace que se muestra en pantalla. */
async function origenDeLaPeticion(): Promise<string | undefined> {
  return (await headers()).get('x-wl-origen') ?? undefined;
}

/** Invita a una persona: crea su cuenta sin contraseña y le manda el enlace por correo. */
export async function invitar(_previo: EstadoEquipo, form: FormData): Promise<EstadoEquipo> {
  const sesion = await exigirPlataforma();
  const email = String(form.get('email') ?? '');
  const nombre = String(form.get('nombre') ?? '');
  const r = await invitarCuentaPlataforma({ email, nombre }, sesion.email);
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'equipo.invitar', { detalle: { email: email.trim().toLowerCase() } });
  const enlace = enlaceDeContrasena(r.token, await origenDeLaPeticion());
  let listo = 'Cuenta creada. Mándale el enlace tú.';
  if (form.get('porCorreo') === 'on') {
    const correo = await enviarCorreo(
      correoDeInvitacion({
        para: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        quien: sesion.nombre,
        token: r.token,
      }),
    );
    listo = correo.ok
      ? `Cuenta creada. Le mandamos el enlace a ${email.trim().toLowerCase()}.`
      : `Cuenta creada, pero el correo no salió (${correo.error}). Mándale el enlace tú.`;
  }
  return { error: null, listo, enlace };
}

/** Enlace nuevo de contraseña para alguien del equipo (72 horas). */
export async function generarEnlace(_previo: EstadoEquipo, form: FormData): Promise<EstadoEquipo> {
  const sesion = await exigirPlataforma();
  const r = await enlaceParaCuentaPlataforma(String(form.get('id') ?? ''), sesion.email);
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'equipo.enlace', { detalle: { email: r.email } });
  return {
    error: null,
    listo: `Enlace para ${r.nombre}. Sirve una vez y vence en 72 horas.`,
    enlace: enlaceDeContrasena(r.token, await origenDeLaPeticion()),
  };
}

export async function cambiarEstado(_previo: EstadoEquipo, form: FormData): Promise<EstadoEquipo> {
  const sesion = await exigirPlataforma();
  const activa = form.get('activa') === '1';
  const r = await cambiarEstadoCuentaPlataforma(
    String(form.get('id') ?? ''),
    activa,
    sesion.userId,
  );
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, activa ? 'equipo.alta' : 'equipo.baja', { detalle: { email: r.email } });
  return {
    error: null,
    listo: activa ? 'Cuenta reactivada.' : 'Cuenta dada de baja: ya no puede entrar.',
    recargar: `/plataforma/equipo?aviso=${activa ? 'alta' : 'baja'}`,
  };
}

/** Cambiar la contraseña propia (pide la actual). Deja abierta solo esta sesión. */
export async function cambiarMiContrasena(
  _previo: EstadoEquipo,
  form: FormData,
): Promise<EstadoEquipo> {
  const sesion = await exigirPlataforma();
  const nueva = String(form.get('nueva') ?? '');
  if (nueva !== String(form.get('confirmacion') ?? '')) {
    return { error: 'La contraseña nueva y su confirmación no coinciden.', listo: null };
  }
  const token = (await cookies()).get(NOMBRE_COOKIE_PLATAFORMA)?.value;
  const r = await cambiarContrasenaPlataforma(
    sesion.userId,
    String(form.get('actual') ?? ''),
    nueva,
    token,
  );
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'cuenta.contrasena');
  return { error: null, listo: 'Listo: tu contraseña cambió y se cerraron tus otras sesiones.' };
}

export async function cerrarMisOtrasSesiones(_previo: EstadoEquipo): Promise<EstadoEquipo> {
  const sesion = await exigirPlataforma();
  const token = (await cookies()).get(NOMBRE_COOKIE_PLATAFORMA)?.value;
  const cerradas = await cerrarOtrasSesionesPlataforma(sesion.userId, token);
  await anotar(sesion, 'cuenta.cerrar_sesiones', { detalle: { cerradas } });
  return {
    error: null,
    listo:
      cerradas === 0
        ? 'No había otras sesiones abiertas.'
        : `Se ${cerradas === 1 ? 'cerró 1 sesión' : `cerraron ${cerradas} sesiones`}.`,
  };
}

/**
 * «¿Olvidaste tu contraseña?». Responde siempre lo mismo, exista o no la
 * cuenta, para no revelar quién tiene acceso.
 */
export async function recuperar(_previo: EstadoEquipo, form: FormData): Promise<EstadoEquipo> {
  const email = String(form.get('email') ?? '').slice(0, 160);
  const r = await solicitarRecuperacionPlataforma(email);
  if (r) {
    await anotar({ email: r.email }, 'sesion.recuperar');
    // Después de responder: así tarda lo mismo exista o no la cuenta.
    after(() =>
      enviarCorreo(correoDeRecuperacion({ para: r.email, nombre: r.nombre, token: r.token })),
    );
  }
  return {
    error: null,
    listo:
      'Si ese correo tiene cuenta en la plataforma, te llegará un enlace en unos minutos. Revisa también el correo no deseado.',
  };
}

/** Fija la contraseña con el enlace y lleva a entrar. */
export async function fijarContrasena(
  _previo: EstadoEquipo,
  form: FormData,
): Promise<EstadoEquipo> {
  const clave = String(form.get('clave') ?? '');
  if (clave !== String(form.get('confirmacion') ?? '')) {
    return { error: 'La contraseña y su confirmación no coinciden.', listo: null };
  }
  const r = await definirContrasenaPlataforma(String(form.get('token') ?? ''), clave);
  if (!r.ok) return { error: r.error, listo: null };
  await anotar({ email: r.email }, 'sesion.contrasena');
  redirect('/plataforma/entrar?contrasena=lista');
}
