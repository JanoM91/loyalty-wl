import { createHash, randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { hashContrasena, validarContrasena, verificarContrasena } from './auth/password';
import { clienteDuenio } from './plataforma';

/**
 * Equipo de plataforma (Exkalibur): cuentas, enlaces de contraseña y bitácora.
 *
 * Las cuentas nuevas se crean por invitación: nacen sin contraseña y la
 * persona la fija con un enlace de un solo uso, para que nunca viaje por un
 * chat. Quien olvidó la suya pide un enlace por correo (una hora) o un
 * compañero le genera uno (72 horas). La terminal sigue sirviendo
 * (`plataforma:usuario`) por si nadie puede entrar.
 *
 * Todo vive en tablas `platform_*` que el rol de la aplicación no puede ver.
 */

const HORAS_INVITACION = 72;
const MINUTOS_RECUPERACION = 60;
/** Enlaces de recuperación por cuenta y por hora; más ya no se emiten. */
const RECUPERACIONES_POR_HORA = 3;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const correoValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoEquipo<T = object> =
  ({ readonly ok: true } & T) | { readonly ok: false; readonly error: string };

export interface CuentaPlataforma {
  readonly id: string;
  readonly email: string;
  readonly nombre: string;
  readonly activa: boolean;
  /** Ya fijó su contraseña (si no, tiene una invitación pendiente o vencida). */
  readonly conContrasena: boolean;
  readonly bloqueadaHasta: Date | null;
  readonly ultimoAcceso: Date | null;
  readonly invitadaPor: string | null;
  readonly creada: Date;
}

/** Todas las cuentas de plataforma: primero las activas, luego por antigüedad. */
export async function listarCuentasPlataforma(): Promise<CuentaPlataforma[]> {
  const filas = await clienteDuenio().platformUser.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      passwordHash: true,
      lockedUntil: true,
      lastLoginAt: true,
      invitedBy: true,
      createdAt: true,
    },
  });
  const ahora = Date.now();
  return filas.map((f) => ({
    id: f.id,
    email: f.email,
    nombre: f.name,
    activa: f.isActive,
    conContrasena: f.passwordHash !== null,
    bloqueadaHasta: f.lockedUntil && f.lockedUntil.getTime() > ahora ? f.lockedUntil : null,
    ultimoAcceso: f.lastLoginAt,
    invitadaPor: f.invitedBy,
    creada: f.createdAt,
  }));
}

async function emitirEnlace(
  userId: string,
  proposito: 'INVITACION' | 'RECUPERACION',
  quien: string | null,
): Promise<{ token: string; expira: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(
    Date.now() +
      (proposito === 'INVITACION' ? HORAS_INVITACION * 3_600_000 : MINUTOS_RECUPERACION * 60_000),
  );
  const bd = clienteDuenio();
  // Un enlace vigente a la vez: el nuevo anula los anteriores sin usar.
  await bd.platformPasswordToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });
  await bd.platformPasswordToken.create({
    data: {
      userId,
      tokenHash: hash(token),
      purpose: proposito,
      expiresAt: expira,
      createdBy: quien,
    },
  });
  return { token, expira };
}

/**
 * Invita a una persona al equipo: crea su cuenta sin contraseña y devuelve el
 * enlace (72 horas, un solo uso) con el que la fija. Si el correo ya tiene una
 * cuenta, no la toca: para eso está «Generar enlace».
 */
export async function invitarCuentaPlataforma(
  d: { readonly email: string; readonly nombre: string },
  quien: string,
): Promise<ResultadoEquipo<{ userId: string; token: string; expira: Date }>> {
  const email = d.email.trim().toLowerCase();
  if (!correoValido(email) || email.length > 160) return { ok: false, error: 'Correo no válido.' };
  const nombre = d.nombre.trim().slice(0, 160);
  if (nombre.length < 2) return { ok: false, error: 'Escribe su nombre.' };
  const bd = clienteDuenio();
  const existente = await bd.platformUser.findUnique({ where: { email }, select: { id: true } });
  if (existente) {
    return {
      ok: false,
      error: 'Ese correo ya tiene cuenta. Usa «Generar enlace» en su renglón.',
    };
  }
  const u = await bd.platformUser.create({
    data: { email, name: nombre, passwordHash: null, invitedBy: quien.slice(0, 160) },
    select: { id: true },
  });
  const enlace = await emitirEnlace(u.id, 'INVITACION', quien);
  return { ok: true, userId: u.id, ...enlace };
}

/**
 * Enlace para que un compañero fije una contraseña nueva (la olvidó o nunca
 * usó su invitación). La contraseña de ahora sigue sirviendo hasta que la cambie.
 */
export async function enlaceParaCuentaPlataforma(
  userId: string,
  quien: string,
): Promise<ResultadoEquipo<{ token: string; expira: Date; email: string; nombre: string }>> {
  if (!UUID.test(userId)) return { ok: false, error: 'No encontramos esa cuenta.' };
  const u = await clienteDuenio().platformUser.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, email: true, name: true },
  });
  if (!u) return { ok: false, error: 'No encontramos esa cuenta.' };
  if (!u.isActive) return { ok: false, error: 'La cuenta está dada de baja. Reactívala primero.' };
  const enlace = await emitirEnlace(u.id, 'INVITACION', quien);
  return { ok: true, ...enlace, email: u.email, nombre: u.name };
}

/**
 * Da de baja o reactiva una cuenta. La baja cierra sus sesiones y anula sus
 * enlaces. Nadie se da de baja a sí mismo y siempre queda al menos una cuenta
 * activa con contraseña.
 */
export async function cambiarEstadoCuentaPlataforma(
  userId: string,
  activa: boolean,
  quienId: string,
): Promise<ResultadoEquipo<{ email: string }>> {
  if (!UUID.test(userId)) return { ok: false, error: 'No encontramos esa cuenta.' };
  const bd = clienteDuenio();
  const u = await bd.platformUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isActive: true },
  });
  if (!u) return { ok: false, error: 'No encontramos esa cuenta.' };
  if (!activa) {
    if (u.id === quienId) return { ok: false, error: 'No puedes darte de baja a ti mismo.' };
    const otras = await bd.platformUser.count({
      where: { isActive: true, passwordHash: { not: null }, id: { not: u.id } },
    });
    if (otras === 0) {
      return { ok: false, error: 'Es la única cuenta que puede entrar: no se puede dar de baja.' };
    }
  }
  await bd.platformUser.update({
    where: { id: u.id },
    data: activa ? { isActive: true, failedAttempts: 0, lockedUntil: null } : { isActive: false },
  });
  if (!activa) {
    await bd.platformSession.deleteMany({ where: { userId: u.id } });
    await bd.platformPasswordToken.updateMany({
      where: { userId: u.id, usedAt: null },
      data: { expiresAt: new Date() },
    });
  }
  return { ok: true, email: u.email };
}

export type EstadoEnlacePlataforma =
  | {
      readonly ok: true;
      readonly email: string;
      readonly nombre: string;
      readonly primeraVez: boolean;
    }
  | { readonly ok: false };

/** ¿Sirve este enlace? No lo gasta: solo dice a quién es. */
export async function consultarEnlacePlataforma(token: string): Promise<EstadoEnlacePlataforma> {
  if (!token || token.length > 100) return { ok: false };
  const t = await clienteDuenio().platformPasswordToken.findUnique({
    where: { tokenHash: hash(token) },
    select: {
      usedAt: true,
      expiresAt: true,
      user: { select: { email: true, name: true, isActive: true, passwordHash: true } },
    },
  });
  if (!t || t.usedAt || t.expiresAt <= new Date() || !t.user.isActive) return { ok: false };
  return {
    ok: true,
    email: t.user.email,
    nombre: t.user.name,
    primeraVez: t.user.passwordHash === null,
  };
}

/**
 * Fija la contraseña con un enlace y lo gasta. Cierra todas las sesiones de
 * la cuenta y quita el bloqueo por intentos.
 */
export async function definirContrasenaPlataforma(
  token: string,
  clave: string,
): Promise<ResultadoEquipo<{ email: string; userId: string }>> {
  const valida = validarContrasena(clave);
  if (!valida.ok) return { ok: false, error: valida.motivo };
  if (!token || token.length > 100) return { ok: false, error: ENLACE_INSERVIBLE };
  const bd = clienteDuenio();
  const t = await bd.platformPasswordToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { id: true, usedAt: true, expiresAt: true, userId: true, user: true },
  });
  if (!t || t.usedAt || t.expiresAt <= new Date() || !t.user.isActive) {
    return { ok: false, error: ENLACE_INSERVIBLE };
  }
  const passwordHash = await hashContrasena(clave);
  // Gastarlo primero y solo si nadie lo gastó antes: dos envíos a la vez no lo usan dos veces.
  const gastado = await bd.platformPasswordToken.updateMany({
    where: { id: t.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (gastado.count === 0) return { ok: false, error: ENLACE_INSERVIBLE };
  await bd.platformUser.update({
    where: { id: t.userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  await bd.platformSession.deleteMany({ where: { userId: t.userId } });
  await bd.platformPasswordToken.updateMany({
    where: { userId: t.userId, usedAt: null },
    data: { expiresAt: new Date() },
  });
  return { ok: true, email: t.user.email, userId: t.userId };
}

const ENLACE_INSERVIBLE =
  'Este enlace ya se usó o venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».';

/**
 * «¿Olvidaste tu contraseña?». Devuelve el enlace (una hora) solo si el correo
 * es de una cuenta activa que ya tenía contraseña; si no, null. Quien llama
 * responde igual en los dos casos. Como mucho tres enlaces por hora.
 */
export async function solicitarRecuperacionPlataforma(
  emailCrudo: string,
): Promise<{ token: string; email: string; nombre: string } | null> {
  const email = emailCrudo.trim().toLowerCase();
  if (!correoValido(email)) return null;
  const bd = clienteDuenio();
  const u = await bd.platformUser.findUnique({
    where: { email },
    select: { id: true, name: true, isActive: true, passwordHash: true },
  });
  if (!u || !u.isActive || u.passwordHash === null) return null;
  const recientes = await bd.platformPasswordToken.count({
    where: {
      userId: u.id,
      purpose: 'RECUPERACION',
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
  });
  if (recientes >= RECUPERACIONES_POR_HORA) return null;
  const { token } = await emitirEnlace(u.id, 'RECUPERACION', null);
  return { token, email, nombre: u.name };
}

/** Cambia la contraseña propia pidiendo la actual. Deja abierta solo la sesión en curso. */
export async function cambiarContrasenaPlataforma(
  userId: string,
  actual: string,
  nueva: string,
  tokenSesion: string | undefined,
): Promise<ResultadoEquipo> {
  const bd = clienteDuenio();
  const u = await bd.platformUser.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true },
  });
  if (!u || !u.isActive || !u.passwordHash) return { ok: false, error: 'Vuelve a entrar.' };
  if (!(await verificarContrasena(actual, u.passwordHash))) {
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  }
  const valida = validarContrasena(nueva);
  if (!valida.ok) return { ok: false, error: valida.motivo };
  if (nueva === actual) return { ok: false, error: 'La nueva debe ser distinta de la actual.' };
  await bd.platformUser.update({
    where: { id: userId },
    data: { passwordHash: await hashContrasena(nueva), passwordChangedAt: new Date() },
  });
  await cerrarOtrasSesionesPlataforma(userId, tokenSesion);
  return { ok: true };
}

/** Cierra todas las sesiones de la cuenta menos la del token dado. Devuelve cuántas cerró. */
export async function cerrarOtrasSesionesPlataforma(
  userId: string,
  tokenSesion: string | undefined,
): Promise<number> {
  const r = await clienteDuenio().platformSession.deleteMany({
    where: { userId, ...(tokenSesion ? { tokenHash: { not: hash(tokenSesion) } } : {}) },
  });
  return r.count;
}

/** Sesiones abiertas (sin vencer) de la cuenta. */
export function sesionesAbiertasPlataforma(userId: string): Promise<number> {
  return clienteDuenio().platformSession.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

export interface AnotacionPlataforma {
  /** Correo de la cuenta que actuó. */
  readonly actor: string;
  /** «club.pago», «equipo.invitar»… Ver `ACCIONES_PLATAFORMA` en la web. */
  readonly accion: string;
  readonly club?: { readonly id: string; readonly slug: string } | null;
  readonly detalle?: Record<string, unknown> | null;
  readonly ip?: string | null;
}

/**
 * Anota una acción en la bitácora. Nunca hace fallar la acción: si la base no
 * responde, lo deja en el registro del servidor.
 */
export async function anotarPlataforma(a: AnotacionPlataforma): Promise<void> {
  try {
    await clienteDuenio().platformAudit.create({
      data: {
        actorEmail: a.actor.slice(0, 160),
        action: a.accion.slice(0, 80),
        tenantId: a.club?.id ?? null,
        tenantSlug: a.club?.slug.slice(0, 63) ?? null,
        detail: (a.detalle ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: a.ip?.slice(0, 45) ?? null,
      },
    });
  } catch (e) {
    console.error('[bitacora-plataforma] no se pudo anotar', a.accion, e);
  }
}

export interface EntradaBitacoraPlataforma {
  readonly id: string;
  readonly actor: string;
  readonly accion: string;
  readonly clubId: string | null;
  readonly clubSlug: string | null;
  readonly detalle: Record<string, unknown> | null;
  readonly ip: string | null;
  readonly fecha: Date;
}

/** Lo más reciente primero, con filtros opcionales por club, cuenta o tipo de acción. */
export async function listarBitacoraPlataforma(
  filtro: {
    readonly clubId?: string;
    readonly actor?: string;
    /** Prefijo de la acción: «club.», «equipo.». */
    readonly accion?: string;
    readonly limite?: number;
  } = {},
): Promise<EntradaBitacoraPlataforma[]> {
  const filas = await clienteDuenio().platformAudit.findMany({
    where: {
      ...(filtro.clubId && UUID.test(filtro.clubId) ? { tenantId: filtro.clubId } : {}),
      ...(filtro.actor ? { actorEmail: filtro.actor.toLowerCase() } : {}),
      ...(filtro.accion ? { action: { startsWith: filtro.accion } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(filtro.limite ?? 100, 1), 500),
  });
  return filas.map((f) => ({
    id: f.id,
    actor: f.actorEmail,
    accion: f.action,
    clubId: f.tenantId,
    clubSlug: f.tenantSlug,
    detalle:
      f.detail && typeof f.detail === 'object' && !Array.isArray(f.detail)
        ? (f.detail as Record<string, unknown>)
        : null,
    ip: f.ipAddress,
    fecha: f.createdAt,
  }));
}

/** Cuentas que aparecen en la bitácora, para el filtro. */
export async function actoresDeBitacoraPlataforma(): Promise<string[]> {
  const filas = await clienteDuenio().platformAudit.findMany({
    distinct: ['actorEmail'],
    select: { actorEmail: true },
    orderBy: { actorEmail: 'asc' },
    take: 50,
  });
  return filas.map((f) => f.actorEmail);
}
