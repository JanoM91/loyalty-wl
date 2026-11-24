import { createHash, randomBytes } from 'node:crypto';

import { hashContrasena, validarContrasena, verificarContrasena } from './auth/password';
import { clienteDuenio } from './plataforma';

/**
 * Acceso al panel de plataforma (Exkalibur).
 *
 * Las cuentas se crean por invitación desde «Equipo» (ver
 * plataforma-equipo.ts) o desde la terminal (`plataforma:usuario`, dentro de
 * `packages/database`), por si nadie puede entrar. Cinco intentos fallidos
 * seguidos bloquean la cuenta 15 minutos; el conteo vive en la base.
 */

export const NOMBRE_COOKIE_PLATAFORMA = 'wl_plataforma';
const HORAS_SESION = 12;
const INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SesionPlataforma {
  readonly userId: string;
  readonly nombre: string;
  readonly email: string;
}

export async function crearUsuarioPlataforma(d: {
  readonly email: string;
  readonly nombre: string;
  readonly clave: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = d.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Correo no válido.' };
  const valida = validarContrasena(d.clave);
  if (!valida.ok) return { ok: false, error: valida.motivo };
  const passwordHash = await hashContrasena(d.clave);
  const nombre = d.nombre.trim() || email;
  await clienteDuenio().platformUser.upsert({
    where: { email },
    create: { email, name: nombre, passwordHash, passwordChangedAt: new Date() },
    update: {
      name: nombre,
      passwordHash,
      passwordChangedAt: new Date(),
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  // Cambiar la contraseña cierra las sesiones abiertas.
  await clienteDuenio().platformSession.deleteMany({ where: { user: { email } } });
  return { ok: true };
}

export type EntradaPlataforma =
  | { readonly ok: true; readonly token: string; readonly expira: Date }
  | { readonly ok: false; readonly error: string };

const RECHAZO = 'Correo o contraseña incorrectos.';

export async function entrarPlataforma(
  emailCrudo: string,
  clave: string,
): Promise<EntradaPlataforma> {
  const bd = clienteDuenio();
  const email = emailCrudo.trim().toLowerCase();
  const u = await bd.platformUser.findUnique({ where: { email } });
  // Sin contraseña: la invitación todavía no se usó. Se trata como si no existiera.
  if (!u || !u.isActive || u.passwordHash === null) {
    // Mismo trabajo y mismo mensaje exista o no la cuenta.
    await hashContrasena(clave.slice(0, 200));
    return { ok: false, error: RECHAZO };
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    return { ok: false, error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' };
  }
  if (!(await verificarContrasena(clave, u.passwordHash))) {
    const fallos = u.failedAttempts + 1;
    await bd.platformUser.update({
      where: { id: u.id },
      data:
        fallos >= INTENTOS
          ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) }
          : { failedAttempts: fallos },
    });
    return { ok: false, error: RECHAZO };
  }
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + HORAS_SESION * 3_600_000);
  await bd.platformUser.update({
    where: { id: u.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await bd.platformSession.create({
    data: { userId: u.id, tokenHash: hash(token), expiresAt: expira },
  });
  await bd.platformSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { ok: true, token, expira };
}

export async function leerSesionPlataforma(
  token: string | undefined,
): Promise<SesionPlataforma | null> {
  if (!token) return null;
  const s = await clienteDuenio().platformSession.findUnique({
    where: { tokenHash: hash(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });
  if (!s || s.expiresAt < new Date() || !s.user.isActive) return null;
  return { userId: s.user.id, nombre: s.user.name, email: s.user.email };
}

export async function salirPlataforma(token: string | undefined): Promise<void> {
  if (token)
    await clienteDuenio().platformSession.deleteMany({ where: { tokenHash: hash(token) } });
}
