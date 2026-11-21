import type { Prisma } from '@prisma/client';

import { prisma } from './index';
import { negocioActual } from './negocio';
import { mezclarAjustes } from './plataforma';

/**
 * «Mensajes a tus clientes»: el negocio escribe un correo y le llega a quien
 * aceptó promociones, con su correo verificado y sin haberse dado de baja.
 *
 * La plataforma enciende el servicio y fija el tope mensual por club
 * (`ajustes.mensajes`). Cada correo trae su enlace de baja; darse de baja
 * apaga las promociones de esa tarjeta y deja la fecha como evidencia.
 */

/** Quién recibe: promociones aceptadas, correo verificado y entregable. */
const AUDIENCIA = {
  isActive: true,
  marketingOptIn: true,
  email: { not: null },
  emailVerifiedAt: { not: null },
  campaignOptOutAt: null,
  emailUndeliverableAt: null,
} satisfies Prisma.LoyaltyCardWhereInput;

/** Horas mínimas entre un mensaje y el siguiente del mismo club. */
export const HORAS_ENTRE_MENSAJES = 24;

/** Largo del asunto y del mensaje. */
export const LIMITES_MENSAJE = { asunto: 80, cuerpo: 1500 } as const;

export function audienciaMensajes(): Promise<number> {
  return prisma.loyaltyCard.count({ where: AUDIENCIA });
}

export interface DestinatarioMensaje {
  readonly cardId: string;
  readonly correo: string;
  readonly nombre: string | null;
}

export async function destinatariosMensaje(limite: number): Promise<DestinatarioMensaje[]> {
  const filas = await prisma.loyaltyCard.findMany({
    where: AUDIENCIA,
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: 'asc' },
    take: Math.max(0, limite),
  });
  return filas.map((f) => ({ cardId: f.id, correo: f.email!, nombre: f.name }));
}

/** Primer instante del mes en la Ciudad de México (UTC-6 todo el año desde 2022). */
export function inicioDelMes(ahora = new Date()): Date {
  const local = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 6, 0, 0));
}

/** Correos ya usados este mes (cada destinatario cuenta uno). */
export async function usoMensajesDelMes(ahora = new Date()): Promise<number> {
  const r = await prisma.clubMessage.aggregate({
    where: { createdAt: { gte: inicioDelMes(ahora) } },
    _sum: { recipients: true },
  });
  return r._sum.recipients ?? 0;
}

/** Cuándo se puede mandar el siguiente mensaje; null si ya se puede. */
export async function siguienteMensajePosible(ahora = new Date()): Promise<Date | null> {
  const ultimo = await prisma.clubMessage.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!ultimo) return null;
  const siguiente = new Date(ultimo.createdAt.getTime() + HORAS_ENTRE_MENSAJES * 60 * 60 * 1000);
  return siguiente > ahora ? siguiente : null;
}

export interface MensajeRevisado {
  readonly asunto: string;
  readonly cuerpo: string;
}

/** Limpia y revisa lo que escribió el dueño. */
export function revisarMensaje(
  asuntoCrudo: string,
  cuerpoCrudo: string,
): { ok: true; mensaje: MensajeRevisado } | { ok: false; error: string } {
  const asunto = asuntoCrudo.replace(/\s+/g, ' ').trim();
  const cuerpo = cuerpoCrudo
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (asunto.length < 3) return { ok: false, error: 'Escribe el asunto del correo.' };
  if (asunto.length > LIMITES_MENSAJE.asunto)
    return { ok: false, error: `El asunto lleva hasta ${LIMITES_MENSAJE.asunto} letras.` };
  if (cuerpo.length < 10) return { ok: false, error: 'Escribe el mensaje.' };
  if (cuerpo.length > LIMITES_MENSAJE.cuerpo)
    return { ok: false, error: `El mensaje lleva hasta ${LIMITES_MENSAJE.cuerpo} letras.` };
  return { ok: true, mensaje: { asunto, cuerpo } };
}

/** Registra el mensaje antes de mandarlo: cuenta para el tope desde ya. */
export async function registrarMensaje(
  m: MensajeRevisado,
  destinatarios: number,
  actor: { readonly userId: string },
): Promise<string> {
  const fila = await prisma.clubMessage.create({
    data: {
      subject: m.asunto,
      body: m.cuerpo,
      recipients: destinatarios,
      createdById: actor.userId,
    },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.userId,
      action: 'mensajes.enviar',
      entityType: 'club_message',
      entityId: fila.id,
      metadata: { destinatarios },
    },
  });
  return fila.id;
}

/** Cierra el mensaje con lo que de verdad salió. */
export async function cerrarMensaje(
  id: string,
  r: { readonly enviados: number; readonly fallidos: number },
): Promise<void> {
  await prisma.clubMessage.update({
    where: { id },
    data: {
      sent: r.enviados,
      failed: r.fallidos,
      status: r.enviados === 0 && r.fallidos > 0 ? 'FALLO' : 'ENVIADO',
      finishedAt: new Date(),
    },
  });
}

export interface MensajeEnviado {
  readonly id: string;
  readonly asunto: string;
  readonly estado: string;
  readonly destinatarios: number;
  readonly enviados: number;
  readonly fallidos: number;
  readonly creado: Date;
  readonly autor: string | null;
}

export async function historialMensajes(cuantos = 10): Promise<MensajeEnviado[]> {
  const filas = await prisma.clubMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: cuantos,
    select: {
      id: true,
      subject: true,
      status: true,
      recipients: true,
      sent: true,
      failed: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    asunto: f.subject,
    estado: f.status,
    destinatarios: f.recipients,
    enviados: f.sent,
    fallidos: f.failed,
    creado: f.createdAt,
    autor: f.createdBy ? f.createdBy.name || f.createdBy.email : null,
  }));
}

/**
 * Baja de las promociones desde el enlace del correo. Apaga el consentimiento
 * y deja la fecha de la baja. Devuelve false si la tarjeta no existe.
 */
export async function darDeBajaPromociones(cardId: string): Promise<boolean> {
  const r = await prisma.loyaltyCard.updateMany({
    where: { id: cardId },
    data: { marketingOptIn: false, marketingOptInAt: null, campaignOptOutAt: new Date() },
  });
  return r.count > 0;
}

/** «Fue un error»: vuelve a aceptar promociones desde la misma página. */
export async function volverAPromociones(cardId: string): Promise<boolean> {
  const r = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, isActive: true },
    data: { marketingOptIn: true, marketingOptInAt: new Date(), campaignOptOutAt: null },
  });
  return r.count > 0;
}

/** Enciende o apaga el servicio y fija el tope. Solo la plataforma. */
export async function fijarAjustesMensajes(
  negocioId: string,
  a: { readonly activo: boolean; readonly topeMensual: number },
): Promise<void> {
  const tope = Math.max(0, Math.min(100_000, Math.round(a.topeMensual)));
  await mezclarAjustes(negocioId, { mensajes: { activo: a.activo, topeMensual: tope } });
}

/** ¿El club en curso puede mandar mensajes? */
export async function mensajesDelClub(): Promise<{ activo: boolean; topeMensual: number }> {
  const m = (await negocioActual()).ajustes.mensajes;
  return { activo: Boolean(m?.activo), topeMensual: m?.topeMensual ?? 0 };
}
