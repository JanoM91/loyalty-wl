import { randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '../index';
import { obtenerTarjeta, type VistaTarjeta } from './tarjetas';

/**
 * Apple Wallet: lo que la base guarda para que el pase se mantenga al día.
 *
 * El protocolo es de Apple (PassKit Web Service) y vive en la aplicación web;
 * aquí solo están los datos que necesita: con qué token se identifica un pase,
 * qué dispositivos lo tienen instalado y qué tarjetas cambiaron desde cuándo.
 *
 * Términos de Apple que aparecen abajo:
 * - *serial number*: el número de serie del pase. Usamos el id de la tarjeta.
 * - *authentication token*: lo lleva el pase y el iPhone lo manda en cada
 *   petición. Es secreto por tarjeta; quien lo tenga puede leer ese pase.
 * - *device library identifier*: cómo Apple identifica al iPhone.
 * - *push token*: a dónde avisarle a ese iPhone que hay cambios.
 */

// ---------------------------------------------------------------------------
// Token del pase
// ---------------------------------------------------------------------------

/**
 * El token con el que el pase de esta tarjeta se identifica. Se genera la
 * primera vez que la persona descarga el pase y no cambia después: si
 * cambiara, los pases ya instalados dejarían de poder actualizarse.
 */
export async function tokenWalletDeTarjeta(cardId: string): Promise<string | null> {
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { walletAuthToken: true, isActive: true },
  });
  if (!t || !t.isActive) return null;
  if (t.walletAuthToken) return t.walletAuthToken;

  const token = randomBytes(32).toString('base64url');
  // Si dos descargas simultáneas llegan aquí, solo una escribe (la condición
  // `walletAuthToken: null` lo garantiza) y la otra relee el token ganador.
  const cambio = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, walletAuthToken: null },
    data: { walletAuthToken: token },
  });
  if (cambio.count === 1) return token;
  const otra = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { walletAuthToken: true },
  });
  return otra?.walletAuthToken ?? null;
}

/**
 * Comprueba el token que manda el iPhone contra el de la tarjeta.
 *
 * Devuelve el id de la tarjeta si coincide; null si no existe, está inactiva
 * o el token no es el suyo. La comparación es de tiempo constante.
 */
export async function autenticarPase(serial: string, token: string): Promise<string | null> {
  if (!esUuid(serial) || token.length < 16 || token.length > 64) return null;
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: serial },
    select: { id: true, walletAuthToken: true, isActive: true },
  });
  if (!t || !t.isActive || !t.walletAuthToken) return null;
  const a = Buffer.from(t.walletAuthToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return t.id;
}

// ---------------------------------------------------------------------------
// Datos del pase
// ---------------------------------------------------------------------------

export interface TarjetaParaPase {
  readonly tarjeta: VistaTarjeta;
  readonly token: string;
  /** Último cambio que el pase debe reflejar. Es el `Last-Modified` del pase. */
  readonly actualizada: Date;
}

/** Todo lo que hace falta para construir el pase de una tarjeta. */
export async function tarjetaParaPase(cardId: string): Promise<TarjetaParaPase | null> {
  const token = await tokenWalletDeTarjeta(cardId);
  if (!token) return null;
  const [tarjeta, fila] = await Promise.all([
    obtenerTarjeta(cardId),
    prisma.loyaltyCard.findUnique({ where: { id: cardId }, select: { walletUpdatedAt: true } }),
  ]);
  if (!tarjeta || !fila) return null;
  return { tarjeta, token, actualizada: fila.walletUpdatedAt };
}

/**
 * Deja constancia de que la tarjeta cambió en algo que el pase muestra.
 *
 * Lo llaman la caja (estampas, premios) y el perfil (nombre). Avisar al
 * iPhone es trabajo de la aplicación web, después de responder.
 */
export async function marcarTarjetaActualizada(cardId: string): Promise<void> {
  await prisma.loyaltyCard.updateMany({
    where: { id: cardId },
    data: { walletUpdatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Dispositivos
// ---------------------------------------------------------------------------

export type ResultadoRegistro = 'CREADO' | 'EXISTIA';

/** El iPhone instaló el pase: lo suscribe a los cambios de esa tarjeta. */
export async function registrarDispositivo(r: {
  readonly deviceLibraryId: string;
  readonly pushToken: string;
  readonly cardId: string;
}): Promise<ResultadoRegistro> {
  // El token de notificaciones puede cambiar: siempre se guarda el último.
  const previo = await prisma.walletDevice.findFirst({
    where: { deviceLibraryId: r.deviceLibraryId },
    select: { id: true },
  });
  const dispositivo = previo
    ? await prisma.walletDevice.update({
        where: { id: previo.id },
        data: { pushToken: r.pushToken },
        select: { id: true },
      })
    : await prisma.walletDevice.create({
        data: { deviceLibraryId: r.deviceLibraryId, pushToken: r.pushToken },
        select: { id: true },
      });
  const existente = await prisma.walletRegistration.findUnique({
    where: { deviceId_cardId: { deviceId: dispositivo.id, cardId: r.cardId } },
    select: { id: true },
  });
  if (existente) return 'EXISTIA';
  await prisma.walletRegistration.create({
    data: { deviceId: dispositivo.id, cardId: r.cardId },
  });
  return 'CREADO';
}

/** La persona quitó el pase de Wallet. Si al dispositivo no le queda ninguno, se olvida. */
export async function eliminarRegistro(deviceLibraryId: string, cardId: string): Promise<void> {
  const dispositivo = await prisma.walletDevice.findFirst({
    where: { deviceLibraryId },
    select: { id: true },
  });
  if (!dispositivo) return;
  await prisma.walletRegistration.deleteMany({
    where: { deviceId: dispositivo.id, cardId },
  });
  const restantes = await prisma.walletRegistration.count({
    where: { deviceId: dispositivo.id },
  });
  if (restantes === 0) {
    await prisma.walletDevice.delete({ where: { id: dispositivo.id } }).catch(() => undefined);
  }
}

export interface SerialesActualizados {
  readonly seriales: readonly string[];
  /** La fecha del cambio más reciente, para que Wallet la devuelva en la siguiente pregunta. */
  readonly ultimaActualizacion: Date | null;
}

/**
 * Qué tarjetas de este dispositivo cambiaron desde `desde` (todas si es null).
 *
 * Es la pregunta que Wallet hace al recibir una notificación. Si la respuesta
 * no incluye el serial, Wallet no vuelve a pedir el pase.
 */
export async function serialesActualizados(
  deviceLibraryId: string,
  desde: Date | null,
): Promise<SerialesActualizados | null> {
  const dispositivo = await prisma.walletDevice.findFirst({
    where: { deviceLibraryId },
    select: {
      registrations: {
        select: { card: { select: { id: true, walletUpdatedAt: true, isActive: true } } },
      },
    },
  });
  if (!dispositivo) return null;

  const cambiadas = dispositivo.registrations
    .map((r) => r.card)
    .filter((c) => c.isActive && (desde === null || c.walletUpdatedAt > desde));
  const ultima = cambiadas.reduce<Date | null>(
    (max, c) => (max === null || c.walletUpdatedAt > max ? c.walletUpdatedAt : max),
    null,
  );
  return { seriales: cambiadas.map((c) => c.id), ultimaActualizacion: ultima };
}

/** Tokens de notificación de los dispositivos que tienen esta tarjeta. */
export async function tokensPushDeTarjeta(cardId: string): Promise<string[]> {
  const registros = await prisma.walletRegistration.findMany({
    where: { cardId },
    select: { device: { select: { pushToken: true } } },
  });
  return [...new Set(registros.map((r) => r.device.pushToken))];
}

/** Id de tarjeta a partir de su código público (para avisar después de la caja). */
export async function idDeTarjetaPorCodigo(codigo: string): Promise<string | null> {
  const t = await prisma.loyaltyCard.findFirst({
    where: { publicCode: codigo },
    select: { id: true },
  });
  return t?.id ?? null;
}

/** Id de tarjeta de una acreditación (para avisar después de aprobar una pendiente). */
export async function idDeTarjetaPorAcreditacion(accrualId: string): Promise<string | null> {
  if (!esUuid(accrualId)) return null;
  const a = await prisma.loyaltyAccrual.findUnique({
    where: { id: accrualId },
    select: { cardId: true },
  });
  return a?.cardId ?? null;
}

/**
 * Apple respondió que ese token ya no sirve (la persona borró el pase sin
 * conexión, cambió de teléfono): se olvida el dispositivo.
 */
export async function olvidarDispositivoPorToken(pushToken: string): Promise<void> {
  await prisma.walletDevice.deleteMany({ where: { pushToken } });
}

// ---------------------------------------------------------------------------
// Google Wallet
// ---------------------------------------------------------------------------

/** Deja constancia de que la tarjeta tiene objeto en Google Wallet. */
export async function marcarObjetoGoogle(cardId: string): Promise<void> {
  await prisma.loyaltyCard.updateMany({
    where: { id: cardId },
    data: { googleWalletObjectAt: new Date() },
  });
}

/** ¿Esta tarjeta pidió alguna vez el pase de Google? Si no, no hay nada que actualizar. */
export async function tieneObjetoGoogle(cardId: string): Promise<boolean> {
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { googleWalletObjectAt: true },
  });
  return t?.googleWalletObjectAt !== null && t?.googleWalletObjectAt !== undefined;
}

function esUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ---------------------------------------------------------------------------
// Mensajes push (campañas)
// ---------------------------------------------------------------------------

export interface MensajeWallet {
  readonly texto: string;
  readonly en: Date;
  /** Mensaje de campaña que lo mandó (para medir el clic), si lo hay. */
  readonly mensajeId: string | null;
}

/** El último mensaje para los pases de esta tarjeta, o null si nunca hubo. */
export async function mensajeWalletDeTarjeta(cardId: string): Promise<MensajeWallet | null> {
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { walletMessage: true, walletMessageAt: true, walletMessageId: true },
  });
  if (!t?.walletMessage || !t.walletMessageAt) return null;
  return { texto: t.walletMessage, en: t.walletMessageAt, mensajeId: t.walletMessageId };
}

/**
 * Deja el mensaje en la tarjeta y la marca como cambiada, para que el pase de
 * Apple lo muestre (y avise) en su siguiente descarga. Avisar a Apple y
 * mandarlo a Google es trabajo de la aplicación web.
 */
export async function guardarMensajeWallet(
  cardId: string,
  texto: string,
  mensajeId: string | null,
): Promise<void> {
  const ahora = new Date();
  await prisma.loyaltyCard.update({
    where: { id: cardId },
    data: {
      walletMessage: texto.slice(0, 200),
      walletMessageAt: ahora,
      walletMessageId: mensajeId,
      walletUpdatedAt: ahora,
    },
  });
}

/** Tarjetas con algún pase (Apple registrado o Google pedido). */
export async function tarjetasConPase(): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id::text AS id FROM loyalty_card c
     WHERE c.is_active
       AND (EXISTS (SELECT 1 FROM wallet_registration w WHERE w.card_id = c.id)
            OR c.google_wallet_object_at IS NOT NULL)`;
  return filas.map((f) => f.id);
}

/** Marca varias tarjetas como cambiadas (p. ej. para que todos los pases tomen un diseño nuevo). */
export async function marcarTarjetasActualizadas(cardIds: readonly string[]): Promise<number> {
  if (cardIds.length === 0) return 0;
  const r = await prisma.loyaltyCard.updateMany({
    where: { id: { in: [...cardIds] } },
    data: { walletUpdatedAt: new Date() },
  });
  return r.count;
}
