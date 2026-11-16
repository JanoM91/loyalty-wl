import { randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '../index';
import { crearSesionTarjeta } from './tarjetas';
import { canjearEnlaceAcceso } from './verificacion';
import { marcarTarjetaActualizada } from './wallet';

/**
 * Enlace personal permanente («Mi tarjeta»).
 *
 * Problema que resuelve (nov 2026): después de la primera visita muchos
 * clientes no lograban volver a entrar. El enlace de bienvenida sirve una vez,
 * a menudo se abre dentro de WhatsApp (que no guarda la sesión) y luego hace
 * falta una contraseña que no recuerdan. Este enlace no vence: abre la tarjeta
 * en cualquier celular, tantas veces como haga falta, sin contraseña
 * (decisión de Jano, 11 nov 2026).
 *
 * Dónde aparece: la bienvenida de la caja (WhatsApp y correo), el perfil y el
 * reverso de los pases de Apple y Google Wallet, que así se vuelven «el lugar
 * seguro» desde donde siempre se abre la tarjeta.
 *
 * Riesgo aceptado: quien tenga el enlace ve la tarjeta. No puede canjear sin
 * estar en caja con el QR y la cuenta verificada, ni cambiar la contraseña sin
 * la actual. Si el enlace se comparte por error, la persona (perfil) o la
 * administración (ficha de la tarjeta) lo regeneran y el anterior deja de
 * servir.
 */

/** 24 bytes: 32 caracteres en la dirección, imposible de adivinar. */
function tokenNuevo(): string {
  return randomBytes(24).toString('base64url');
}

const FORMATO = /^[A-Za-z0-9_-]{32}$/;

/**
 * El token del enlace personal de la tarjeta; lo crea la primera vez.
 * Null si la tarjeta no existe o está inactiva.
 */
export async function enlacePersonalDeTarjeta(cardId: string): Promise<string | null> {
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { personalLinkToken: true, isActive: true },
  });
  if (!t || !t.isActive) return null;
  if (t.personalLinkToken) return t.personalLinkToken;

  const token = tokenNuevo();
  // Dos peticiones simultáneas: solo una escribe; la otra relee la ganadora.
  const r = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, personalLinkToken: null },
    data: { personalLinkToken: token, personalLinkCreatedAt: new Date() },
  });
  if (r.count === 1) return token;
  const otra = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { personalLinkToken: true },
  });
  return otra?.personalLinkToken ?? null;
}

/**
 * Cambia el enlace: el anterior deja de servir desde ya. Avisa a los pases de
 * Wallet (fecha de cambio) para que su reverso lleve el nuevo; mandar el aviso
 * a los teléfonos lo hace la aplicación web.
 */
export async function regenerarEnlacePersonal(
  cardId: string,
  quien: { readonly usuarioId?: string | null; readonly ip?: string | null } = {},
): Promise<string | null> {
  const token = tokenNuevo();
  const r = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, isActive: true },
    data: { personalLinkToken: token, personalLinkCreatedAt: new Date() },
  });
  if (r.count === 0) return null;
  await marcarTarjetaActualizada(cardId);
  await prisma.auditLog.create({
    data: {
      userId: quien.usuarioId ?? null,
      action: 'lealtad.enlace_personal_regenerado',
      entityType: 'loyalty_card',
      entityId: cardId,
      ipAddress: quien.ip ?? null,
      metadata: { por: quien.usuarioId ? 'panel' : 'cliente' },
    },
  });
  return token;
}

export interface TarjetaDeEnlace {
  readonly cardId: string;
  readonly nombre: string | null;
}

/** La tarjeta de un enlace personal vigente, o null. Solo lee. */
export async function tarjetaPorEnlacePersonal(token: string): Promise<TarjetaDeEnlace | null> {
  if (!FORMATO.test(token)) return null;
  const t = await prisma.loyaltyCard.findUnique({
    where: { personalLinkToken: token },
    select: { id: true, name: true, isActive: true, personalLinkToken: true },
  });
  if (!t || !t.isActive || !t.personalLinkToken) return null;
  // La búsqueda por índice ya compara; esto evita depender de cómo la base
  // compara cadenas (mayúsculas, espacios).
  const a = Buffer.from(t.personalLinkToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { cardId: t.id, nombre: t.name };
}

export interface OpcionesApertura {
  readonly userAgent: string | null;
  /**
   * Enlace de un solo uso que viajaba junto (bienvenida de la caja). Se canjea
   * en silencio para que verifique el correo o el celular por el que llegó; si
   * ya se usó o venció, no pasa nada.
   */
  readonly enlaceUnUso?: string | null;
  /** Mensaje de campaña (push en Wallet) cuyo enlace se tocó, para medirlo. */
  readonly mensajeCampanaId?: string | null;
}

export type ResultadoApertura =
  | { readonly ok: true; readonly cardId: string; readonly token: string; readonly expira: Date }
  | { readonly ok: false };

/** Abre sesión con el enlace personal. Se llama desde un botón, no al cargar la página. */
export async function abrirConEnlacePersonal(
  token: string,
  o: OpcionesApertura,
): Promise<ResultadoApertura> {
  const t = await tarjetaPorEnlacePersonal(token);
  if (!t) return { ok: false };

  if (o.enlaceUnUso && /^[A-Za-z0-9_-]{20,64}$/.test(o.enlaceUnUso)) {
    // Solo verifica: la sesión que abre se descarta (la de abajo es la buena).
    await canjearEnlaceAcceso(o.enlaceUnUso, o.userAgent).catch(() => undefined);
  }
  const sesion = await crearSesionTarjeta(t.cardId, o.userAgent);
  return { ok: true, cardId: t.cardId, ...sesion };
}
