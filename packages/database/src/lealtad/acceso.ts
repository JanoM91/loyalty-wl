import { createHash, randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import {
  ERROR_ACCESO_GENERICO,
  HORAS_ENLACE_WHATSAPP,
  MAX_SOLICITUDES_POR_IP_HORA,
  MINUTOS_BLOQUEO_ACCESO,
  enmascararContacto,
  evaluarBloqueo,
  leerDatoDeAcceso,
  validarContrasenaTarjeta,
  venceSolicitud,
  type TipoContacto,
} from '@wl/domain';

import { prisma, lote, negocioActual, esErrorUnico } from '../index';
import { hashContrasena, verificarContrasena } from '../auth/password';
import { crearSesionTarjeta, hashTokenTarjeta } from './tarjetas';
import { crearEnlaceAcceso } from './verificacion';

/**
 * Entrar a la tarjeta con «correo o celular + contraseña», «Olvidé mi
 * contraseña» y las solicitudes de acceso que atiende la caja.
 *
 * Las reglas puras (qué contraseña sirve, cuándo se bloquea) viven en
 * `@wl/domain` (`loyalty/acceso.ts`); aquí se guardan y se consultan.
 * Flujo completo en docs/22-lealtad-acceso-con-contrasena.md.
 */

export const MENSAJE_BLOQUEO_ACCESO = `Demasiados intentos fallidos. Espera ${MINUTOS_BLOQUEO_ACCESO} minutos e inténtalo de nuevo.`;

/** Treinta minutos, como el enlace de recuperación que ya existía. */
const MINUTOS_ENLACE_CORREO = 30;

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

function hashDato(tipo: TipoContacto, valor: string): string {
  return sha256(`${tipo}:${valor}`);
}

/**
 * Hash válido de una contraseña que nadie conoce: verificar un dato que no
 * es de ninguna tarjeta cuesta lo mismo que uno real, y el tiempo de
 * respuesta no delata qué contactos existen.
 */
const HASH_SENUELO =
  'scrypt$65536$8$1$' +
  randomBytes(16).toString('base64') +
  '$' +
  randomBytes(64).toString('base64');

interface TarjetaDeAcceso {
  readonly id: string;
  readonly publicCode: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly passwordHash: string | null;
  readonly passwordChangedAt: Date | null;
  readonly enrolledBranchId: string | null;
}

/**
 * Tarjetas activas con ese correo o celular.
 *
 * Se compara contra el dato guardado también normalizado (minúsculas; los
 * últimos 10 dígitos del celular), por si quedó algún registro escrito
 * distinto de antes de normalizar. Si sale más de una, nadie entra con ese
 * dato: ver `entrarConContrasena`.
 */
async function tarjetasConDato(tipo: TipoContacto, valor: string): Promise<TarjetaDeAcceso[]> {
  const filas =
    tipo === 'CORREO'
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT "id"::text AS "id" FROM "loyalty_card"
          WHERE "is_active" AND "email" IS NOT NULL AND lower(btrim("email")) = ${valor}
          LIMIT 5`
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT "id"::text AS "id" FROM "loyalty_card"
          WHERE "is_active" AND "phone" IS NOT NULL
            AND right(regexp_replace("phone", '\\D', '', 'g'), 10) = ${valor}
          LIMIT 5`;
  if (filas.length === 0) return [];
  return prisma.loyaltyCard.findMany({
    where: { id: { in: filas.map((f) => f.id) } },
    select: {
      id: true,
      publicCode: true,
      name: true,
      phone: true,
      email: true,
      passwordHash: true,
      passwordChangedAt: true,
      enrolledBranchId: true,
    },
  });
}

/** Un dato que coincide con varias tarjetas: queda en bitácora para revisarlo. */
async function registrarDatoRepetido(
  tipo: TipoContacto,
  valor: string,
  tarjetas: readonly TarjetaDeAcceso[],
  donde: 'entrar' | 'olvide',
  ip: string | null,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: 'lealtad.acceso_contacto_repetido',
      entityType: 'loyalty_card',
      entityId: null,
      ipAddress: ip,
      metadata: {
        donde,
        tipo,
        contacto: enmascararContacto(valor),
        tarjetas: tarjetas.map((t) => t.publicCode),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Entrar
// ---------------------------------------------------------------------------

export type ResultadoEntrada =
  | { readonly ok: true; readonly token: string; readonly expira: Date }
  | { readonly ok: false; readonly error: string; readonly bloqueado?: boolean };

/**
 * «Correo o celular» + contraseña.
 *
 * **Un solo error para todo.** Dato que no es de nadie, tarjeta sin
 * contraseña, contraseña equivocada o dato repetido en varias tarjetas
 * responden «Correo, celular o contraseña incorrectos». El bloqueo tiene su
 * propio aviso, pero se cuenta por dato escrito cuando no hay una tarjeta
 * única, así que tampoco revela qué contactos existen.
 *
 * **Bloqueo.** 15 minutos tras 5 fallos, por tarjeta y por IP, contados en la
 * base (`loyalty_login_attempt`): cada petición puede caer en una función
 * serverless distinta.
 */
export async function entrarConContrasena(
  datoCrudo: string,
  clave: string,
  contexto: { readonly ip?: string | null; readonly userAgent?: string | null } = {},
): Promise<ResultadoEntrada> {
  const dato = leerDatoDeAcceso(datoCrudo);
  if (!dato || !clave) return { ok: false, error: ERROR_ACCESO_GENERICO };

  const ip = contexto.ip ?? null;
  const ahora = new Date();
  const identifierHash = hashDato(dato.tipo, dato.valor);

  const tarjetas = await tarjetasConDato(dato.tipo, dato.valor);
  const unica = tarjetas.length === 1 ? tarjetas[0]! : null;

  const ventana = new Date(ahora.getTime() - MINUTOS_BLOQUEO_ACCESO * 60 * 1000);
  const intentos = await prisma.loyaltyLoginAttempt.findMany({
    where: {
      createdAt: { gt: ventana },
      OR: [unica ? { cardId: unica.id } : { identifierHash }, ...(ip ? [{ ipAddress: ip }] : [])],
    },
    select: {
      cardId: true,
      identifierHash: true,
      ipAddress: true,
      succeeded: true,
      createdAt: true,
    },
  });
  const comoIntento = (i: (typeof intentos)[number]) => ({
    fecha: i.createdAt,
    exito: i.succeeded,
  });

  const porTarjeta = intentos
    .filter((i) => (unica ? i.cardId === unica.id : i.identifierHash === identifierHash))
    .map(comoIntento);
  const porIp = ip ? intentos.filter((i) => i.ipAddress === ip).map(comoIntento) : [];

  if (
    evaluarBloqueo(porTarjeta, ahora, { desde: unica?.passwordChangedAt, reiniciaConExito: true })
      .bloqueado ||
    evaluarBloqueo(porIp, ahora).bloqueado
  ) {
    return { ok: false, bloqueado: true, error: MENSAJE_BLOQUEO_ACCESO };
  }

  const correcta = await verificarContrasena(clave, unica?.passwordHash ?? HASH_SENUELO);
  const exito = Boolean(unica?.passwordHash) && correcta;

  if (tarjetas.length > 1) {
    await registrarDatoRepetido(dato.tipo, dato.valor, tarjetas, 'entrar', ip);
  }

  await prisma.loyaltyLoginAttempt.create({
    data: { cardId: unica?.id ?? null, identifierHash, ipAddress: ip, succeeded: exito },
  });

  if (!exito || !unica) return { ok: false, error: ERROR_ACCESO_GENERICO };

  const sesion = await crearSesionTarjeta(unica.id, contexto.userAgent ?? null);
  return { ok: true, ...sesion };
}

// ---------------------------------------------------------------------------
// Crear y cambiar la contraseña con la sesión abierta
// ---------------------------------------------------------------------------

export type ResultadoContrasena =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Primera contraseña, desde una sesión ya abierta (tarjeta sin contraseña).
 * Si ya tiene una, hay que cambiarla pidiendo la actual.
 */
export async function crearContrasenaTarjeta(
  cardId: string,
  clave: string,
): Promise<ResultadoContrasena> {
  const tarjeta = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { passwordHash: true, phone: true, isActive: true },
  });
  if (!tarjeta?.isActive) return { ok: false, error: 'No encontramos tu tarjeta.' };
  if (tarjeta.passwordHash) {
    return { ok: false, error: 'Tu tarjeta ya tiene contraseña. Usa «Cambiar contraseña».' };
  }
  const motivo = validarContrasenaTarjeta(clave, {
    celular: tarjeta.phone,
    negocio: (await negocioActual()).nombre,
  });
  if (motivo) return { ok: false, error: motivo };

  const hash = await hashContrasena(clave);
  // La condición `passwordHash: null` evita pisar una contraseña creada en
  // otra pestaña un instante antes.
  const { count } = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, passwordHash: null },
    data: { passwordHash: hash, passwordChangedAt: new Date() },
  });
  if (count === 0) {
    return { ok: false, error: 'Tu tarjeta ya tiene contraseña. Usa «Cambiar contraseña».' };
  }
  return { ok: true };
}

/**
 * Cambiar la contraseña pidiendo la actual. Los fallos cuentan para el mismo
 * bloqueo que «Entrar» (por tarjeta y por IP). Al cambiarla se cierran las
 * demás sesiones de la tarjeta; esta sigue abierta.
 */
export async function cambiarContrasenaTarjeta(
  cardId: string,
  actual: string,
  nueva: string,
  contexto: { readonly tokenSesion?: string | null; readonly ip?: string | null } = {},
): Promise<ResultadoContrasena> {
  const tarjeta = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { passwordHash: true, passwordChangedAt: true, phone: true, isActive: true },
  });
  if (!tarjeta?.isActive) return { ok: false, error: 'No encontramos tu tarjeta.' };
  if (!tarjeta.passwordHash) {
    return { ok: false, error: 'Tu tarjeta todavía no tiene contraseña. Créala primero.' };
  }

  const ip = contexto.ip ?? null;
  const ahora = new Date();
  const ventana = new Date(ahora.getTime() - MINUTOS_BLOQUEO_ACCESO * 60 * 1000);
  const intentos = await prisma.loyaltyLoginAttempt.findMany({
    where: { createdAt: { gt: ventana }, OR: [{ cardId }, ...(ip ? [{ ipAddress: ip }] : [])] },
    select: { cardId: true, ipAddress: true, succeeded: true, createdAt: true },
  });
  const deTarjeta = intentos
    .filter((i) => i.cardId === cardId)
    .map((i) => ({ fecha: i.createdAt, exito: i.succeeded }));
  const deIp = ip
    ? intentos
        .filter((i) => i.ipAddress === ip)
        .map((i) => ({ fecha: i.createdAt, exito: i.succeeded }))
    : [];
  if (
    evaluarBloqueo(deTarjeta, ahora, { desde: tarjeta.passwordChangedAt, reiniciaConExito: true })
      .bloqueado ||
    evaluarBloqueo(deIp, ahora).bloqueado
  ) {
    return { ok: false, error: MENSAJE_BLOQUEO_ACCESO };
  }

  const correcta = await verificarContrasena(actual, tarjeta.passwordHash);
  await prisma.loyaltyLoginAttempt.create({
    data: {
      cardId,
      identifierHash: sha256(`TARJETA:${cardId}`),
      ipAddress: ip,
      succeeded: correcta,
    },
  });
  if (!correcta) return { ok: false, error: 'Tu contraseña actual no coincide.' };

  const motivo = validarContrasenaTarjeta(nueva, {
    celular: tarjeta.phone,
    negocio: (await negocioActual()).nombre,
  });
  if (motivo) return { ok: false, error: motivo };

  const hash = await hashContrasena(nueva);
  const token = contexto.tokenSesion ?? null;
  await lote((tx) => [
    tx.loyaltyCard.update({
      where: { id: cardId },
      data: { passwordHash: hash, passwordChangedAt: new Date() },
    }),
    tx.loyaltySession.deleteMany({
      where: { cardId, ...(token ? { tokenHash: { not: hashTokenTarjeta(token) } } : {}) },
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Olvidé mi contraseña
// ---------------------------------------------------------------------------

export type ResultadoOlvide =
  /** Hay que mandar este enlace a este correo (lo manda la aplicación). */
  | { readonly tipo: 'CORREO'; readonly token: string; readonly correo: string }
  /** Tarjeta solo con celular: quedó una solicitud para su sucursal. */
  | { readonly tipo: 'SOLICITUD' }
  /** Nada que hacer (no existe, dato repetido, límites). Misma respuesta en pantalla. */
  | { readonly tipo: 'NADA' };

/** La sucursal de alta o, si no se sabe, la de su primera visita. */
async function sucursalDeLaTarjeta(t: TarjetaDeAcceso): Promise<string | null> {
  if (t.enrolledBranchId) return t.enrolledBranchId;
  const primera = await prisma.loyaltyAccrual.findFirst({
    where: { cardId: t.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { branchId: true },
  });
  return primera?.branchId ?? null;
}

/**
 * «Olvidé mi contraseña».
 *
 * - Tarjeta con correo: enlace por correo (30 min) que obliga a crear una
 *   contraseña nueva. Da igual si escribió el correo o el celular.
 * - Tarjeta solo con celular: solicitud para la sucursal de alta, que manda
 *   el enlace por WhatsApp desde su caja. Una abierta por tarjeta; vence a
 *   las 48 h; tope por IP.
 *
 * Quien llama responde lo mismo en todos los casos.
 */
export async function olvideContrasena(
  datoCrudo: string,
  contexto: { readonly ip?: string | null } = {},
): Promise<ResultadoOlvide> {
  const dato = leerDatoDeAcceso(datoCrudo);
  if (!dato) return { tipo: 'NADA' };
  const ip = contexto.ip ?? null;

  const tarjetas = await tarjetasConDato(dato.tipo, dato.valor);
  if (tarjetas.length > 1) {
    await registrarDatoRepetido(dato.tipo, dato.valor, tarjetas, 'olvide', ip);
    return { tipo: 'NADA' };
  }
  const t = tarjetas[0];
  if (!t) return { tipo: 'NADA' };

  if (t.email) {
    const enlace = await crearEnlaceAcceso(t.id, t.email, MINUTOS_ENLACE_CORREO, {
      restablece: true,
    });
    return enlace ? { tipo: 'CORREO', token: enlace.token, correo: t.email } : { tipo: 'NADA' };
  }

  const ahora = new Date();
  if (ip) {
    const recientes = await prisma.loyaltyAccessRequest.count({
      where: { ipAddress: ip, createdAt: { gte: new Date(ahora.getTime() - 60 * 60 * 1000) } },
    });
    if (recientes >= MAX_SOLICITUDES_POR_IP_HORA) return { tipo: 'NADA' };
  }

  // Las abiertas que ya vencieron se cierran aquí: el índice parcial solo
  // admite una ABIERTA por tarjeta.
  await prisma.loyaltyAccessRequest.updateMany({
    where: { cardId: t.id, status: 'ABIERTA', expiresAt: { lte: ahora } },
    data: { status: 'VENCIDA', resolvedAt: ahora },
  });

  try {
    await prisma.loyaltyAccessRequest.create({
      data: {
        cardId: t.id,
        branchId: await sucursalDeLaTarjeta(t),
        ipAddress: ip,
        createdAt: ahora,
        expiresAt: venceSolicitud(ahora),
      },
    });
  } catch (e) {
    // Ya hay una abierta para esta tarjeta: la sucursal ya la tiene en caja.
    if (esErrorUnico(e)) {
      return { tipo: 'NADA' };
    }
    throw e;
  }
  return { tipo: 'SOLICITUD' };
}

// ---------------------------------------------------------------------------
// Solicitudes de acceso en la caja
// ---------------------------------------------------------------------------

/**
 * Qué solicitudes ve una cuenta: la de sucursal, solo las de la suya;
 * Administración, Dueño y Gerencia, todas.
 */
export interface AlcanceSolicitudes {
  readonly todas: boolean;
  readonly branchId: string | null;
}

function filtroAlcance(a: AlcanceSolicitudes): Prisma.LoyaltyAccessRequestWhereInput {
  if (a.todas) return {};
  // Una cuenta de sucursal sin sucursal asignada no ve ninguna.
  return { branchId: a.branchId ?? '00000000-0000-0000-0000-000000000000' };
}

function abiertas(
  a: AlcanceSolicitudes,
  ahora = new Date(),
): Prisma.LoyaltyAccessRequestWhereInput {
  return {
    status: 'ABIERTA',
    expiresAt: { gt: ahora },
    card: { isActive: true, phone: { not: null } },
    ...filtroAlcance(a),
  };
}

export interface SolicitudAcceso {
  readonly id: string;
  readonly nombre: string | null;
  /** Celular enmascarado: la caja no necesita verlo completo. */
  readonly celular: string;
  readonly creada: Date;
  readonly sucursal: string | null;
}

export async function listarSolicitudesAcceso(
  alcance: AlcanceSolicitudes,
  limite = 50,
): Promise<SolicitudAcceso[]> {
  const filas = await prisma.loyaltyAccessRequest.findMany({
    where: abiertas(alcance),
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: {
      id: true,
      createdAt: true,
      card: { select: { name: true, phone: true } },
      branch: { select: { name: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    nombre: f.card.name,
    celular: enmascararContacto(f.card.phone),
    creada: f.createdAt,
    sucursal: f.branch?.name ?? null,
  }));
}

export async function contarSolicitudesAcceso(alcance: AlcanceSolicitudes): Promise<number> {
  return prisma.loyaltyAccessRequest.count({ where: abiertas(alcance) });
}

export type ResultadoEnvioSolicitud =
  | {
      readonly ok: true;
      readonly token: string;
      readonly expira: Date;
      /** Celular registrado de la tarjeta (10 dígitos): a él va el WhatsApp. */
      readonly celular: string;
      readonly nombre: string | null;
    }
  | { readonly ok: false; readonly error: string };

/**
 * «Enviar enlace por WhatsApp»: genera el enlace de un solo uso (24 h) que
 * obliga a crear contraseña nueva, marca la solicitud como enviada y lo deja
 * en bitácora. El WhatsApp va al celular **registrado** de la tarjeta: la
 * caja no lo escribe ni lo puede cambiar.
 */
export async function enviarSolicitudPorWhatsApp(
  solicitudId: string,
  usuario: AlcanceSolicitudes & { readonly userId: string },
): Promise<ResultadoEnvioSolicitud> {
  const ahora = new Date();
  const solicitud = await prisma.loyaltyAccessRequest.findFirst({
    where: { id: solicitudId, ...abiertas(usuario, ahora) },
    select: {
      id: true,
      cardId: true,
      card: { select: { phone: true, name: true, publicCode: true } },
    },
  });
  if (!solicitud?.card.phone) {
    return { ok: false, error: 'Esa solicitud ya se atendió o venció.' };
  }

  // Se toma la solicitud antes de generar el enlace: si dos cajas tocan el
  // botón a la vez, solo una la atiende.
  const tomada = await prisma.loyaltyAccessRequest.updateMany({
    where: { id: solicitud.id, status: 'ABIERTA' },
    data: { status: 'ENVIADA', resolvedAt: ahora, resolvedById: usuario.userId },
  });
  if (tomada.count === 0) return { ok: false, error: 'Esa solicitud ya se atendió.' };

  const enlace = await crearEnlaceAcceso(solicitud.cardId, '', HORAS_ENLACE_WHATSAPP * 60, {
    restablece: true,
    celular: solicitud.card.phone,
  });
  if (!enlace) {
    await prisma.loyaltyAccessRequest.update({
      where: { id: solicitud.id },
      data: { status: 'ABIERTA', resolvedAt: null, resolvedById: null },
    });
    return {
      ok: false,
      error:
        'Ya se generaron varios enlaces para esta tarjeta. Espera una hora e inténtalo de nuevo.',
    };
  }

  const codigo = await prisma.loyaltyCode.findUnique({
    where: { codeHash: sha256(enlace.token) },
    select: { id: true },
  });
  await lote((tx) => [
    tx.loyaltyAccessRequest.update({
      where: { id: solicitud.id },
      data: { codeId: codigo?.id ?? null },
    }),
    tx.auditLog.create({
      data: {
        userId: usuario.userId,
        action: 'lealtad.solicitud_acceso_enviada',
        entityType: 'loyalty_access_request',
        entityId: solicitud.id,
        metadata: {
          tarjeta: solicitud.card.publicCode,
          celular: enmascararContacto(solicitud.card.phone),
          vence: enlace.expira.toISOString(),
        },
      },
    }),
  ]);

  return {
    ok: true,
    token: enlace.token,
    expira: enlace.expira,
    celular: solicitud.card.phone,
    nombre: solicitud.card.name,
  };
}

/** «Descartar»: la solicitud sale de la caja sin enviar nada. */
export async function descartarSolicitudAcceso(
  solicitudId: string,
  usuario: AlcanceSolicitudes & { readonly userId: string },
): Promise<ResultadoContrasena> {
  const ahora = new Date();
  const solicitud = await prisma.loyaltyAccessRequest.findFirst({
    where: { id: solicitudId, status: 'ABIERTA', ...filtroAlcance(usuario) },
    select: { id: true, card: { select: { publicCode: true } } },
  });
  if (!solicitud) return { ok: false, error: 'Esa solicitud ya se atendió o venció.' };

  const { count } = await prisma.loyaltyAccessRequest.updateMany({
    where: { id: solicitud.id, status: 'ABIERTA' },
    data: { status: 'DESCARTADA', resolvedAt: ahora, resolvedById: usuario.userId },
  });
  if (count === 0) return { ok: false, error: 'Esa solicitud ya se atendió.' };

  await prisma.auditLog.create({
    data: {
      userId: usuario.userId,
      action: 'lealtad.solicitud_acceso_descartada',
      entityType: 'loyalty_access_request',
      entityId: solicitud.id,
      metadata: { tarjeta: solicitud.card.publicCode },
    },
  });
  return { ok: true };
}
