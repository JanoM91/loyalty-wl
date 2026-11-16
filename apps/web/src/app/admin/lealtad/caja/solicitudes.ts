'use server';

import { revalidatePath } from 'next/cache';
import { descartarSolicitudAcceso, enviarSolicitudPorWhatsApp } from '@wl/database';
import { mensajeEnlaceAcceso } from '@wl/domain';

import { ROLES_CAJA, alcanceSolicitudes } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

/**
 * Solicitudes de acceso en la caja: «Olvidé mi contraseña» de tarjetas que
 * solo tienen celular. La app no manda SMS ni WhatsApp; la sucursal manda el
 * enlace desde su WhatsApp con un botón que abre el mensaje ya escrito.
 * Ver docs/22-lealtad-acceso-con-contrasena.md.
 */

export type RespuestaSolicitud =
  | { readonly ok: true; readonly whatsapp?: string }
  | { readonly ok: false; readonly error: string };

export async function enviarEnlacePorWhatsApp(solicitudId: string): Promise<RespuestaSolicitud> {
  const sesion = await exigirRol(ROLES_CAJA);
  const r = await enviarSolicitudPorWhatsApp(solicitudId, {
    ...alcanceSolicitudes(sesion),
    userId: sesion.userId,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath('/admin/lealtad/caja');
  const url = `${await origenDeLaPeticion()}/lealtad/acceso/${r.token}`;
  // Siempre al celular registrado de la tarjeta: la pantalla no lo puede cambiar.
  return {
    ok: true,
    whatsapp: `https://wa.me/52${r.celular}?text=${encodeURIComponent(mensajeEnlaceAcceso(r.nombre, url, (await exigirNegocio()).nombre))}`,
  };
}

export async function descartarSolicitud(solicitudId: string): Promise<RespuestaSolicitud> {
  const sesion = await exigirRol(ROLES_CAJA);
  const r = await descartarSolicitudAcceso(solicitudId, {
    ...alcanceSolicitudes(sesion),
    userId: sesion.userId,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/admin/lealtad/caja');
  return { ok: true };
}
