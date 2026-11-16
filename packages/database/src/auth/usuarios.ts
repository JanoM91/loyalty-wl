import { createHash, randomBytes } from 'node:crypto';

import { normalizarCorreo } from '@wl/domain';
import type { AdminTokenPurpose, UserRole } from '@prisma/client';

import { prisma, transaccion, lote } from '../index';
import { hashContrasena, validarContrasena, verificarContrasena } from './password';
import { ROLES_USUARIOS, esRol } from './roles';
import { cerrarOtrasSesiones } from './sesion';

/**
 * Usuarios del panel: alta, cambios y enlaces para fijar la contraseña.
 *
 * **La contraseña nunca la escribe otra persona.** Administración da de alta
 * la cuenta y el sistema emite un enlace de un solo uso; quien va a usar la
 * cuenta abre el enlace y elige su contraseña. Así nadie más la conoce, ni
 * siquiera quien la invitó, y no viaja por WhatsApp ni por correo.
 *
 * **Dos maneras de entregar el enlace, y no se mezclan.** O se manda por
 * correo, o se muestra en pantalla para compartirlo a mano. Un enlace que llegó
 * por correo y se usó demuestra que la persona recibe ese correo; uno que se
 * vio en pantalla no demuestra nada. Solo a los correos demostrados se les
 * manda un enlace de recuperación cuando alguien escribe «olvidé mi
 * contraseña»: si no, cualquiera podría pedir el acceso de una cuenta con un
 * correo de relleno o mal escrito y el enlace acabaría en un buzón ajeno.
 */

/** Lo que dura un enlace que genera administración. Da tiempo de un fin de semana. */
export const HORAS_ENLACE_INVITACION = 72;
/** Lo que dura un enlace de «olvidé mi contraseña». */
export const MINUTOS_ENLACE_RECUPERACION = 60;
/** Enlaces de recuperación por cuenta y hora. Frena a quien quiera saturar un buzón. */
const MAX_RECUPERACIONES_POR_HORA = 3;

const ENLACE_INVALIDO = 'Este enlace ya se usó o venció. Pide uno nuevo.';
const CORREO_REPETIDO = 'Ya hay un usuario con ese correo.';

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** Quién hace el cambio, para la bitácora. */
export interface Actor {
  readonly userId: string;
  readonly ip?: string | null;
}

export type Resultado<T = object> =
  ({ readonly ok: true } & T) | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

export interface UsuarioPanel {
  readonly id: string;
  readonly email: string;
  readonly nombre: string;
  readonly rol: UserRole;
  readonly sucursal: { readonly id: string; readonly nombre: string } | null;
  readonly activo: boolean;
  readonly tieneContrasena: boolean;
  readonly correoVerificado: boolean;
  readonly ultimoAcceso: Date | null;
  readonly alta: Date;
  readonly contrasenaDesde: Date | null;
  /** Vencimiento del enlace sin usar más reciente, si hay uno. */
  readonly enlaceVigenteHasta: Date | null;
}

function seleccion() {
  return {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    passwordHash: true,
    emailVerifiedAt: true,
    lastLoginAt: true,
    createdAt: true,
    passwordChangedAt: true,
    branch: { select: { id: true, name: true } },
    passwordTokens: {
      where: { consumedAt: null, expiresAt: { gt: new Date() } },
      select: { expiresAt: true },
      orderBy: { expiresAt: 'desc' as const },
      take: 1,
    },
  };
}

type Fila = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  passwordChangedAt: Date | null;
  branch: { id: string; name: string } | null;
  passwordTokens: { expiresAt: Date }[];
};

function aUsuario(f: Fila): UsuarioPanel {
  return {
    id: f.id,
    email: f.email,
    nombre: f.name,
    rol: f.role,
    sucursal: f.branch ? { id: f.branch.id, nombre: f.branch.name } : null,
    activo: f.isActive,
    tieneContrasena: f.passwordHash !== null,
    correoVerificado: f.emailVerifiedAt !== null,
    ultimoAcceso: f.lastLoginAt,
    alta: f.createdAt,
    contrasenaDesde: f.passwordChangedAt,
    enlaceVigenteHasta: f.passwordTokens[0]?.expiresAt ?? null,
  };
}

/** Todas las cuentas: primero las activas, por nombre. */
export async function listarUsuarios(): Promise<UsuarioPanel[]> {
  const filas = await prisma.userAccount.findMany({
    select: seleccion(),
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return filas.map(aUsuario);
}

export async function leerUsuario(id: string): Promise<UsuarioPanel | null> {
  if (!esUuid(id)) return null;
  const fila = await prisma.userAccount.findUnique({ where: { id }, select: seleccion() });
  return fila ? aUsuario(fila) : null;
}

// ---------------------------------------------------------------------------
// Alta y cambios
// ---------------------------------------------------------------------------

export interface DatosUsuario {
  readonly email: string;
  readonly nombre: string;
  readonly rol: string;
  readonly sucursalId?: string | null;
}

interface Validado {
  readonly email: string;
  readonly nombre: string;
  readonly rol: UserRole;
  readonly branchId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

async function validar(d: DatosUsuario): Promise<Resultado<{ v: Validado }>> {
  const email = normalizarCorreo(d.email);
  if (!email) return { ok: false, error: 'Escribe un correo válido.' };

  const nombre = d.nombre.trim().replace(/\s+/g, ' ');
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la persona.' };
  if (nombre.length > 160) return { ok: false, error: 'El nombre es demasiado largo.' };

  if (!esRol(d.rol)) return { ok: false, error: 'Elige un rol.' };

  // Una cuenta de sucursal sin sucursal no puede usar la caja ni la
  // disponibilidad; los demás roles ven todas, así que no llevan ninguna.
  let branchId: string | null = null;
  if (d.rol === 'SUCURSAL') {
    const id = d.sucursalId ?? '';
    const sucursal = esUuid(id)
      ? await prisma.branch.findFirst({ where: { id, isActive: true }, select: { id: true } })
      : null;
    if (!sucursal) return { ok: false, error: 'El rol Sucursal necesita una sucursal.' };
    branchId = sucursal.id;
  }

  return { ok: true, v: { email, nombre, rol: d.rol, branchId } };
}

function esCorreoRepetido(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

/**
 * Da de alta una cuenta sin contraseña. Todavía no puede entrar: para eso se
 * le emite un enlace con `emitirEnlaceContrasena`.
 */
export async function crearUsuario(
  datos: DatosUsuario,
  actor: Actor,
): Promise<Resultado<{ id: string }>> {
  const r = await validar(datos);
  if (!r.ok) return r;
  const { email, nombre, rol, branchId } = r.v;

  const existe = await prisma.userAccount.findFirst({ where: { email }, select: { id: true } });
  if (existe) return { ok: false, error: CORREO_REPETIDO };

  try {
    const id = await transaccion(async (tx) => {
      const u = await tx.userAccount.create({
        data: { email, name: nombre, role: rol, branchId, isActive: true },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'usuario.crear',
          entityType: 'user_account',
          entityId: u.id,
          metadata: { email, rol, sucursalId: branchId },
          ipAddress: actor.ip ?? null,
        },
      });
      return u.id;
    });
    return { ok: true, id };
  } catch (e) {
    // Dos altas del mismo correo a la vez: la restricción única decide.
    if (esCorreoRepetido(e)) return { ok: false, error: CORREO_REPETIDO };
    throw e;
  }
}

/**
 * Cambia nombre, correo, rol, sucursal o estado de una cuenta.
 *
 * Los cambios de rol y sucursal valen desde la siguiente página que abra la
 * persona: la sesión lee la cuenta en cada carga, no guarda una copia.
 *
 * Dos frenos para no dejar el panel sin dueño: nadie puede quitarse a sí mismo
 * el rol de administración ni desactivarse, y siempre debe quedar al menos una
 * cuenta de administración activa.
 */
export async function actualizarUsuario(
  id: string,
  datos: DatosUsuario & { readonly activo: boolean },
  actor: Actor,
): Promise<Resultado<{ cambios: number }>> {
  if (!esUuid(id)) return { ok: false, error: 'No encontramos ese usuario.' };
  const actual = await prisma.userAccount.findUnique({
    where: { id },
    select: { email: true, name: true, role: true, branchId: true, isActive: true },
  });
  if (!actual) return { ok: false, error: 'No encontramos ese usuario.' };

  const r = await validar(datos);
  if (!r.ok) return r;
  const v = r.v;

  if (id === actor.userId && (v.rol !== actual.role || !datos.activo)) {
    return {
      ok: false,
      error:
        'No puedes cambiar tu propio rol ni desactivar tu cuenta. Pídeselo a otra persona que administre usuarios.',
    };
  }

  const administra = (rol: UserRole) => ROLES_USUARIOS.includes(rol);
  if (administra(actual.role) && actual.isActive && (!administra(v.rol) || !datos.activo)) {
    const otros = await prisma.userAccount.count({
      where: { role: { in: [...ROLES_USUARIOS] }, isActive: true, id: { not: id } },
    });
    if (otros === 0) {
      return {
        ok: false,
        error:
          'Debe quedar al menos una cuenta activa que administre usuarios (Administración o Dueño).',
      };
    }
  }

  const cambiaCorreo = v.email !== actual.email;
  if (cambiaCorreo) {
    const otro = await prisma.userAccount.findFirst({
      where: { email: v.email },
      select: { id: true },
    });
    if (otro) return { ok: false, error: CORREO_REPETIDO };
  }

  const cambios: Record<string, [unknown, unknown]> = {};
  if (cambiaCorreo) cambios.email = [actual.email, v.email];
  if (v.nombre !== actual.name) cambios.nombre = [actual.name, v.nombre];
  if (v.rol !== actual.role) cambios.rol = [actual.role, v.rol];
  if (v.branchId !== actual.branchId) cambios.sucursalId = [actual.branchId, v.branchId];
  if (datos.activo !== actual.isActive) cambios.activo = [actual.isActive, datos.activo];

  const total = Object.keys(cambios).length;
  if (total === 0) return { ok: true, cambios: 0 };

  const desactiva = actual.isActive && !datos.activo;
  const ahora = new Date();

  try {
    await transaccion(async (tx) => {
      await tx.userAccount.update({
        where: { id },
        data: {
          email: v.email,
          name: v.nombre,
          role: v.rol,
          branchId: v.branchId,
          isActive: datos.activo,
          // El correo nuevo no está comprobado: la recuperación queda apagada
          // hasta que use un enlace que le llegue ahí.
          ...(cambiaCorreo ? { emailVerifiedAt: null } : {}),
        },
      });
      // Un enlace mandado al correo anterior, o de una cuenta que se apaga, ya
      // no debe servir.
      if (cambiaCorreo || desactiva) {
        await tx.adminPasswordToken.updateMany({
          where: { userId: id, consumedAt: null },
          data: { consumedAt: ahora },
        });
      }
      // La sesión ya se rechaza al estar desactivada; se borra para no dejar
      // tokens vivos en la base.
      if (desactiva) await tx.adminSession.deleteMany({ where: { userId: id } });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'usuario.actualizar',
          entityType: 'user_account',
          entityId: id,
          metadata: { cambios } as object,
          ipAddress: actor.ip ?? null,
        },
      });
    });
  } catch (e) {
    if (esCorreoRepetido(e)) return { ok: false, error: CORREO_REPETIDO };
    throw e;
  }

  return { ok: true, cambios: total };
}

// ---------------------------------------------------------------------------
// Enlaces de contraseña
// ---------------------------------------------------------------------------

export interface EnlaceEmitido {
  readonly token: string;
  readonly email: string;
  readonly nombre: string;
  readonly rol: UserRole;
  readonly expira: Date;
  /** True si la cuenta todavía no tenía contraseña. */
  readonly primeraVez: boolean;
}

async function guardarEnlace(
  userId: string,
  proposito: AdminTokenPurpose,
  porCorreo: boolean,
  expira: Date,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  // Solo sirve el último: emitir uno nuevo anula los que no se usaron.
  await lote((tx) => [
    tx.adminPasswordToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    tx.adminPasswordToken.create({
      data: {
        userId,
        purpose: proposito,
        tokenHash: hash(token),
        sentByEmail: porCorreo,
        expiresAt: expira,
      },
    }),
  ]);
  return token;
}

/**
 * Enlace que genera administración, para la primera contraseña o para
 * restablecerla. `porCorreo` dice cómo se va a entregar: quien llama manda el
 * correo o muestra el enlace, nunca las dos cosas.
 */
export async function emitirEnlaceContrasena(
  userId: string,
  opciones: { readonly porCorreo: boolean },
  actor: Actor,
): Promise<Resultado<EnlaceEmitido>> {
  if (!esUuid(userId)) return { ok: false, error: 'No encontramos ese usuario.' };
  const u = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true, isActive: true, passwordHash: true },
  });
  if (!u) return { ok: false, error: 'No encontramos ese usuario.' };
  if (!u.isActive) return { ok: false, error: 'La cuenta está desactivada. Actívala primero.' };

  const expira = new Date(Date.now() + HORAS_ENLACE_INVITACION * 60 * 60 * 1000);
  const token = await guardarEnlace(userId, 'INVITACION', opciones.porCorreo, expira);
  const primeraVez = u.passwordHash === null;

  await prisma.auditLog.create({
    data: {
      userId: actor.userId,
      action: 'usuario.enlace_contrasena',
      entityType: 'user_account',
      entityId: userId,
      metadata: { porCorreo: opciones.porCorreo, primeraVez },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true, token, email: u.email, nombre: u.name, rol: u.role, expira, primeraVez };
}

/**
 * Anula un enlace que no llegó a su destino, por ejemplo si el correo falló.
 * Nadie lo conoce, pero no tiene por qué quedar vivo.
 */
export async function anularEnlace(token: string): Promise<void> {
  await prisma.adminPasswordToken.updateMany({
    where: { tokenHash: hash(token), consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

/**
 * «Olvidé mi contraseña».
 *
 * Devuelve `token: null` si no hay una cuenta activa con ese correo
 * comprobado, o si ya pidió demasiados enlaces. Quien llama debe responder lo
 * mismo en todos los casos: decir «ese correo no existe» le confirmaría a
 * cualquiera qué cuentas hay.
 */
export async function solicitarRecuperacion(
  emailCrudo: string,
  ip: string | null = null,
): Promise<{
  readonly token: string | null;
  readonly email: string | null;
  readonly nombre: string | null;
}> {
  const email = normalizarCorreo(emailCrudo);
  if (!email) return { token: null, email: null, nombre: null };

  const u = await prisma.userAccount.findFirst({
    where: { email },
    select: { id: true, name: true, isActive: true, emailVerifiedAt: true },
  });
  if (!u || !u.isActive || !u.emailVerifiedAt) return { token: null, email, nombre: null };

  const recientes = await prisma.adminPasswordToken.count({
    where: {
      userId: u.id,
      purpose: 'RECUPERACION',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recientes >= MAX_RECUPERACIONES_POR_HORA) return { token: null, email, nombre: null };

  const expira = new Date(Date.now() + MINUTOS_ENLACE_RECUPERACION * 60 * 1000);
  const token = await guardarEnlace(u.id, 'RECUPERACION', true, expira);

  await prisma.auditLog.create({
    data: {
      userId: null,
      action: 'usuario.recuperacion',
      entityType: 'user_account',
      entityId: u.id,
      ipAddress: ip,
    },
  });

  return { token, email, nombre: u.name };
}

export type EstadoEnlace = Resultado<{
  readonly nombre: string;
  readonly email: string;
  readonly proposito: AdminTokenPurpose;
  readonly primeraVez: boolean;
  readonly expira: Date;
}>;

/** ¿Sirve este enlace? Solo mira: no lo gasta. */
export async function consultarEnlace(token: string): Promise<EstadoEnlace> {
  // Un token de verdad son 43 caracteres. Lo demás ni se busca.
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, error: ENLACE_INVALIDO };

  const t = await prisma.adminPasswordToken.findUnique({
    where: { tokenHash: hash(token) },
    select: {
      purpose: true,
      expiresAt: true,
      consumedAt: true,
      user: { select: { name: true, email: true, isActive: true, passwordHash: true } },
    },
  });
  if (!t || t.consumedAt || t.expiresAt <= new Date() || !t.user.isActive) {
    return { ok: false, error: ENLACE_INVALIDO };
  }
  return {
    ok: true,
    nombre: t.user.name,
    email: t.user.email,
    proposito: t.purpose,
    primeraVez: t.user.passwordHash === null,
    expira: t.expiresAt,
  };
}

/**
 * Gasta el enlace y fija la contraseña.
 *
 * Cierra todas las sesiones abiertas de esa cuenta: si se restablece porque
 * alguien más la conocía, dejarlo dentro haría inútil el cambio.
 */
export async function definirContrasenaConEnlace(
  token: string,
  clave: string,
): Promise<Resultado<{ email: string }>> {
  const revision = validarContrasena(clave);
  if (!revision.ok) return { ok: false, error: revision.motivo };

  const estado = await consultarEnlace(token);
  if (!estado.ok) return estado;

  // El hash tarda ~100 ms a propósito: se calcula fuera de la transacción.
  const passwordHash = await hashContrasena(clave);
  const ahora = new Date();

  const email = await transaccion(async (tx) => {
    const t = await tx.adminPasswordToken.findUnique({
      where: { tokenHash: hash(token) },
      select: { id: true, userId: true, purpose: true, sentByEmail: true },
    });
    if (!t) return null;

    // La condición va en el UPDATE: si dos pestañas envían a la vez, solo una
    // encuentra el enlace sin usar.
    const gastado = await tx.adminPasswordToken.updateMany({
      where: { id: t.id, consumedAt: null, expiresAt: { gt: ahora } },
      data: { consumedAt: ahora },
    });
    if (gastado.count === 0) return null;

    const u = await tx.userAccount.update({
      where: { id: t.userId },
      data: {
        passwordHash,
        passwordChangedAt: ahora,
        ...(t.sentByEmail ? { emailVerifiedAt: ahora } : {}),
      },
      select: { email: true },
    });
    await tx.adminPasswordToken.updateMany({
      where: { userId: t.userId, consumedAt: null },
      data: { consumedAt: ahora },
    });
    await tx.adminSession.deleteMany({ where: { userId: t.userId } });
    await tx.auditLog.create({
      data: {
        userId: t.userId,
        action: 'usuario.contrasena_definida',
        entityType: 'user_account',
        entityId: t.userId,
        metadata: { proposito: t.purpose, porCorreo: t.sentByEmail },
      },
    });
    return u.email;
  });

  if (!email) return { ok: false, error: ENLACE_INVALIDO };
  return { ok: true, email };
}

/**
 * Cambiar la contraseña propia desde «Mi cuenta». Pide la actual: una sesión
 * abierta en una computadora prestada no debe bastar para quedarse la cuenta.
 * Cierra las demás sesiones y deja abierta la de quien la cambia.
 */
export async function cambiarContrasenaPropia(
  userId: string,
  actual: string,
  nueva: string,
  tokenSesionActual: string | undefined,
): Promise<Resultado<{ sesionesCerradas: number }>> {
  const u = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true },
  });
  if (!u || !u.isActive || !u.passwordHash) {
    return { ok: false, error: 'No pudimos cambiar la contraseña.' };
  }
  if (!(await verificarContrasena(actual, u.passwordHash))) {
    return { ok: false, error: 'La contraseña actual no coincide.' };
  }
  const revision = validarContrasena(nueva);
  if (!revision.ok) return { ok: false, error: revision.motivo };
  if (nueva === actual) {
    return { ok: false, error: 'La contraseña nueva debe ser distinta de la actual.' };
  }

  const passwordHash = await hashContrasena(nueva);
  const ahora = new Date();
  await lote((tx) => [
    tx.userAccount.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: ahora },
    }),
    tx.adminPasswordToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: ahora },
    }),
    tx.auditLog.create({
      data: {
        userId,
        action: 'usuario.cambio_contrasena',
        entityType: 'user_account',
        entityId: userId,
      },
    }),
  ]);
  const sesionesCerradas = await cerrarOtrasSesiones(userId, tokenSesionActual);
  return { ok: true, sesionesCerradas };
}
