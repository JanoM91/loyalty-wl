'use server';

import {
  cambiarContrasenaPropia,
  cuentaParaConfirmar,
  marcarAvisos,
  puedeMandarConfirmacion,
} from '@wl/database';

import { urlConfirmacionCorreo } from '@/lib/admin/confirmar-correo';
import { mandarConfirmacionCorreo } from '@/lib/admin/correos-usuarios';
import { exigirSesion, tokenDeEsteNavegador } from '@/lib/admin/sesion';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

export interface EstadoCuenta {
  readonly error: string | null;
  readonly aviso: string | null;
}

export async function cambiarMiContrasena(
  _previo: EstadoCuenta,
  form: FormData,
): Promise<EstadoCuenta> {
  const sesion = await exigirSesion();
  const actual = String(form.get('actual') ?? '');
  const nueva = String(form.get('nueva') ?? '');
  const confirmacion = String(form.get('confirmacion') ?? '');

  if (nueva !== confirmacion)
    return { error: 'Las dos contraseñas nuevas no coinciden.', aviso: null };

  const r = await cambiarContrasenaPropia(
    sesion.userId,
    actual,
    nueva,
    await tokenDeEsteNavegador(),
  );
  if (!r.ok) return { error: r.error, aviso: null };

  return {
    error: null,
    aviso:
      r.sesionesCerradas > 0
        ? `Listo. Cerramos ${r.sesionesCerradas === 1 ? 'la sesión abierta' : `${r.sesionesCerradas} sesiones abiertas`} en otros dispositivos; aquí sigues dentro.`
        : 'Listo. La próxima vez entra con la contraseña nueva.',
  };
}

export interface EstadoConfirmacion {
  readonly error: string | null;
  readonly enviado: boolean;
}

/** Manda a la propia cuenta el enlace para confirmar su correo. */
export async function mandarmeConfirmacion(
  _previo: EstadoConfirmacion,
): Promise<EstadoConfirmacion> {
  const sesion = await exigirSesion();
  const [negocio, cuenta, origen] = await Promise.all([
    exigirNegocio(),
    cuentaParaConfirmar(sesion.userId),
    origenDeLaPeticion(),
  ]);
  if (!cuenta) return { error: 'No encontramos tu cuenta.', enviado: false };
  if (cuenta.confirmado) return { error: null, enviado: true };
  if (!CORREO_CONFIGURADO)
    return { error: 'El envío de correos todavía no está activo.', enviado: false };
  if (!(await puedeMandarConfirmacion(sesion.userId)))
    return { error: 'Ya te mandamos varios enlaces. Espera una hora.', enviado: false };
  const url = urlConfirmacionCorreo(origen, negocio.id, sesion.userId, cuenta.email);
  if (!url) return { error: 'No pudimos armar el enlace. Avísanos.', enviado: false };
  const r = await mandarConfirmacionCorreo({ email: cuenta.email, nombre: cuenta.nombre, url });
  return r.ok ? { error: null, enviado: true } : { error: r.error, enviado: false };
}

export interface EstadoResumen {
  readonly error: string | null;
  readonly aviso: string | null;
}

/** Enciende o apaga el resumen semanal por correo del club (dueño o administración). */
export async function cambiarResumenSemanal(
  _previo: EstadoResumen,
  form: FormData,
): Promise<EstadoResumen> {
  const sesion = await exigirSesion();
  if (sesion.rol !== 'DUENO' && sesion.rol !== 'ADMIN')
    return { error: 'Solo el dueño puede cambiar esto.', aviso: null };
  const negocio = await exigirNegocio();
  const encendido = form.get('resumen') === 'on';
  await marcarAvisos(negocio.id, { resumenSemanal: encendido });
  return {
    error: null,
    aviso: encendido
      ? 'Listo. Cada lunes te llega el resumen de la semana.'
      : 'Listo. Ya no te mandaremos el resumen semanal.',
  };
}
