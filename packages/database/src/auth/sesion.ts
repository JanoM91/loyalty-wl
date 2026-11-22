import { createHash, randomBytes } from 'node:crypto';

import { prisma, lote } from '../index';
import type { UserAccount, UserRole } from '@prisma/client';
import { verificarContrasena } from './password';

/**
 * Sesiones del panel de administración.
 *
 * El flujo completo vive aquí, y no repartido entre la pantalla de acceso y
 * el middleware, porque las reglas de seguridad que se escriben en dos sitios
 * terminan divergiendo.
 */

export const NOMBRE_COOKIE = 'wl_admin';

/** Una jornada larga. Al cerrar el mostrador, la sesión ya no sirve. */
const DURACION_HORAS = 12;

/** Fallos consecutivos permitidos antes de rechazar sin comprobar nada. */
const MAX_INTENTOS = 8;
const VENTANA_MINUTOS = 15;

export interface Sesion {
  readonly userId: string;
  readonly nombre: string;
  readonly email: string;
  readonly rol: UserRole;
  readonly branchId: string | null;
}

/**
 * El token viaja en la cookie; en la base solo queda su SHA-256.
 *
 * No lleva scrypt a propósito: un token de 256 bits aleatorios no se adivina
 * por fuerza bruta, así que endurecer el hash no aporta nada y sí costaría
 * 100 ms en cada carga de página del panel.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type ResultadoAcceso =
  | { readonly ok: true; readonly token: string; readonly expira: Date; readonly sesion: Sesion }
  | { readonly ok: false; readonly motivo: string };

/**
 * Verifica credenciales y abre sesión.
 *
 * **Un solo mensaje de error para todo.** Decir "ese correo no existe" le
 * confirma a quien tantea qué cuentas hay. Correo desconocido, contraseña
 * equivocada y cuenta desactivada responden exactamente lo mismo.
 */
export async function iniciarSesion(
  emailCrudo: string,
  clave: string,
  contexto: { readonly ip?: string | null; readonly userAgent?: string | null } = {},
): Promise<ResultadoAcceso> {
  const email = emailCrudo.trim().toLowerCase();
  const generico = 'Correo o contraseña incorrectos.';

  if (!email || !clave) return { ok: false, motivo: generico };

  if (await hayDemasiadosFallos(email, contexto.ip ?? null)) {
    return {
      ok: false,
      motivo: `Demasiados intentos fallidos. Espera ${VENTANA_MINUTOS} minutos e inténtalo de nuevo.`,
    };
  }

  const usuario = await prisma.userAccount.findFirst({
    where: { email },
    select: DATOS_SESION_CON_CLAVE,
  });

  // La contraseña se comprueba aunque el usuario no exista, contra un hash de
  // relleno. Si se saliera antes, la respuesta llegaría notablemente más
  // rápido y ese tiempo revelaría qué correos están dados de alta.
  const hash = usuario?.passwordHash ?? HASH_SENUELO;
  const claveCorrecta = await verificarContrasena(clave, hash);

  const permitido =
    Boolean(usuario) && usuario!.isActive && usuario!.passwordHash !== null && claveCorrecta;

  await prisma.loginAttempt.create({
    data: { email, ipAddress: contexto.ip ?? null, succeeded: permitido },
  });

  if (!permitido || !usuario) return { ok: false, motivo: generico };

  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACION_HORAS * 60 * 60 * 1000);

  await lote((tx) => [
    tx.adminSession.create({
      data: {
        tokenHash: hashToken(token),
        userId: usuario.id,
        expiresAt: expira,
        userAgent: contexto.userAgent?.slice(0, 255) ?? null,
      },
    }),
    tx.userAccount.update({
      where: { id: usuario.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  return { ok: true, token, expira, sesion: aSesion(usuario) };
}

/**
 * Hash válido de una contraseña que nadie conoce.
 *
 * Su única función es que verificar un correo inexistente cueste lo mismo que
 * verificar uno real. Se genera al azar en cada arranque del proceso.
 */
const HASH_SENUELO =
  'scrypt$65536$8$1$' +
  randomBytes(16).toString('base64') +
  '$' +
  randomBytes(64).toString('base64');

/**
 * Cuenta los fallos recientes de ese correo y de esa IP.
 *
 * Los fallos de un correo anteriores a que se fijara su contraseña vigente no
 * cuentan: quien se bloqueó por olvidarla y la restableció con un enlace debe
 * poder entrar de inmediato, no 15 minutos después. Los fallos de la IP con
 * otros correos sí siguen contando: eso es alguien probando cuentas.
 */
async function hayDemasiadosFallos(email: string, ip: string | null): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000);

  const cuenta = await prisma.userAccount.findFirst({
    where: { email },
    select: { passwordChangedAt: true },
  });
  const cambio = cuenta?.passwordChangedAt;
  const desdeCorreo = cambio && cambio > desde ? cambio : desde;

  const fallos = await prisma.loginAttempt.count({
    where: {
      succeeded: false,
      OR: [
        { email, createdAt: { gte: desdeCorreo } },
        ...(ip ? [{ ipAddress: ip, email: { not: email }, createdAt: { gte: desde } }] : []),
      ],
    },
  });

  return fallos >= MAX_INTENTOS;
}

// ---------------------------------------------------------------------------
// Lectura y cierre
// ---------------------------------------------------------------------------

/**
 * Resuelve la sesión a partir del token de la cookie.
 *
 * Comprueba en cada llamada que la cuenta siga activa: si a alguien se le
 * retira el acceso, deja de entrar en la siguiente página que abra, no cuando
 * caduque su sesión.
 */
export async function leerSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;

  const registro = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true },
      },
    },
  });

  if (!registro) return null;

  if (registro.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: registro.id } }).catch(() => undefined);
    return null;
  }

  if (!registro.user.isActive) return null;

  return aSesion(registro.user);
}

export async function cerrarSesion(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Cierra todas las sesiones de una cuenta menos la de este navegador. Se usa
 * al cambiar la contraseña propia: quien la cambia sigue dentro, cualquier
 * otro dispositivo tiene que volver a entrar.
 */
export async function cerrarOtrasSesiones(
  userId: string,
  tokenActual: string | undefined,
): Promise<number> {
  const { count } = await prisma.adminSession.deleteMany({
    where: {
      userId,
      ...(tokenActual ? { tokenHash: { not: hashToken(tokenActual) } } : {}),
    },
  });
  return count;
}

/** Limpieza de sesiones caducadas. Se puede llamar desde una tarea programada. */
export async function purgarSesionesVencidas(): Promise<number> {
  const { count } = await prisma.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

const DATOS_SESION_CON_CLAVE = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  isActive: true,
  passwordHash: true,
} as const;

function aSesion(u: Pick<UserAccount, 'id' | 'name' | 'email' | 'role' | 'branchId'>): Sesion {
  return {
    userId: u.id,
    nombre: u.name,
    email: u.email,
    rol: u.role,
    branchId: u.branchId,
  };
}

export const DURACION_SESION_SEGUNDOS = DURACION_HORAS * 60 * 60;
