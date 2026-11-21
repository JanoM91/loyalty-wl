import {
  PROGRAMA_BASE,
  esPrefijoCodigo,
  esSlugDeNegocio,
  esZonaHorariaValida,
  type ProgramaLealtad,
} from '@wl/domain';
import type { Prisma, PrismaClient } from '@prisma/client';

import { crearCliente } from './cliente';
import {
  conNegocio,
  negocioPorId,
  negocioPorSlug,
  type AjustesNegocio,
  type MarcaNegocio,
  type Negocio,
  type PlanNegocio,
} from './negocio';
import { emitirEnlaceContrasena } from './auth/usuarios';
import { prisma } from './index';

/**
 * Operaciones de plataforma: lo que hace Exkalibur, no un negocio.
 *
 * Crear, suspender o borrar un negocio toca la tabla `tenant`, que el rol de
 * la aplicación solo puede leer. Por eso estas funciones se conectan con el
 * rol dueño (`DIRECT_URL`). Las usan la siembra, las pruebas y el panel de
 * plataforma (`/plataforma`), que por eso necesita `DIRECT_URL` en el servidor.
 */

let duenio: PrismaClient | null = null;

export function clienteDuenio(): PrismaClient {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error('Falta DIRECT_URL: las operaciones de plataforma usan el rol dueño.');
  duenio ??= crearCliente(url);
  return duenio;
}

export function desconectarPlataforma(): Promise<void> {
  return duenio ? duenio.$disconnect() : Promise.resolve();
}

export interface SucursalNueva {
  readonly slug: string;
  readonly nombre: string;
  readonly direccion?: string;
  readonly colonia?: string;
  readonly ciudad?: string;
  readonly estado?: string;
  readonly codigoPostal?: string;
  /** Si acredita estampas desde el primer día. */
  readonly participa?: boolean;
}

export interface NegocioNuevo {
  readonly slug: string;
  readonly nombre: string;
  readonly zonaHoraria?: string;
  readonly prefijoCodigo?: string;
  readonly marca?: Partial<MarcaNegocio>;
  readonly ajustes?: Partial<AjustesNegocio>;
  /** Programa inicial; si falta, el programa base. Se guarda como versión v1 activa. */
  readonly programa?: Omit<ProgramaLealtad, 'version'>;
  readonly sucursales?: readonly SucursalNueva[];
}

export type ResultadoNegocio =
  { readonly ok: true; readonly negocio: Negocio } | { readonly ok: false; readonly error: string };

/** Crea un negocio con su programa inicial y sus sucursales. */
export async function crearNegocio(d: NegocioNuevo): Promise<ResultadoNegocio> {
  const slug = d.slug.trim().toLowerCase();
  if (!esSlugDeNegocio(slug)) {
    return {
      ok: false,
      error:
        'La dirección del negocio solo lleva minúsculas, números y guiones, y no puede ser una palabra reservada del sitio.',
    };
  }
  if (d.nombre.trim().length < 2) return { ok: false, error: 'Escribe el nombre del negocio.' };
  const zona = d.zonaHoraria ?? 'America/Mexico_City';
  if (!esZonaHorariaValida(zona)) return { ok: false, error: 'La zona horaria no es válida.' };
  const prefijo = d.prefijoCodigo ?? 'WL';
  if (!esPrefijoCodigo(prefijo)) {
    return { ok: false, error: 'El prefijo del código lleva de 2 a 4 letras o números.' };
  }

  const bd = clienteDuenio();
  const existente = await bd.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existente) return { ok: false, error: `Ya existe un negocio con la dirección «${slug}».` };

  const fila = await bd.tenant.create({
    data: {
      slug,
      name: d.nombre.trim(),
      timezone: zona,
      codePrefix: prefijo,
      brand: (d.marca ?? {}) as Prisma.InputJsonValue,
      settings: (d.ajustes ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  const negocio = await negocioPorId(fila.id);
  if (!negocio) throw new Error('El negocio recién creado no se pudo leer.');

  // Lo demás se crea como lo haría la aplicación: dentro del negocio y bajo RLS.
  const programa = d.programa ?? PROGRAMA_BASE;
  await conNegocio(negocio, async () => {
    await prisma.loyaltyProgram.create({
      data: {
        version: 'v1',
        positions: programa.posiciones,
        mode: programa.modalidad,
        milestones: programa.hitos as unknown as Prisma.InputJsonValue,
        tiers: programa.tramos as unknown as Prisma.InputJsonValue,
        contingencyWindowDays: programa.ventanaContingenciaDias,
        isActive: true,
        activatedAt: new Date(),
        note: 'Programa inicial',
      },
    });
    for (const s of d.sucursales ?? []) {
      await prisma.branch.create({
        data: {
          slug: s.slug,
          name: s.nombre,
          addressLine: s.direccion ?? '',
          neighborhood: s.colonia ?? '',
          city: s.ciudad ?? '',
          state: s.estado ?? '',
          postalCode: s.codigoPostal ?? '',
          loyaltyEnabled: s.participa ?? false,
          loyaltySince: s.participa ? new Date() : null,
        },
      });
    }
  });

  return { ok: true, negocio };
}

export type ResultadoInvitacion =
  | { readonly ok: true; readonly usuarioId: string; readonly token: string; readonly expira: Date }
  | { readonly ok: false; readonly error: string };

/**
 * Crea la cuenta del dueño de un negocio y le emite el enlace de un solo uso
 * con el que fija su contraseña (`/admin/contrasena/<token>`). Nadie más
 * conoce esa contraseña. Si la cuenta ya existe, emite un enlace nuevo.
 */
export async function invitarDuenio(
  negocio: Negocio,
  d: { readonly email: string; readonly nombre: string },
): Promise<ResultadoInvitacion> {
  return conNegocio(negocio, async () => {
    const email = d.email.trim().toLowerCase();
    let usuario = await prisma.userAccount.findFirst({ where: { email }, select: { id: true } });
    if (!usuario) {
      usuario = await prisma.userAccount.create({
        data: { email, name: d.nombre.trim(), role: 'DUENO' },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: {
          action: 'plataforma.invitar_duenio',
          entityType: 'user_account',
          entityId: usuario.id,
          metadata: { email },
        },
      });
    }
    const enlace = await emitirEnlaceContrasena(
      usuario.id,
      { porCorreo: false },
      { userId: usuario.id },
    );
    if (!enlace.ok) return { ok: false, error: enlace.error };
    return { ok: true, usuarioId: usuario.id, token: enlace.token, expira: enlace.expira };
  });
}

/** Suspende o reactiva un negocio. */
export async function cambiarEstadoNegocio(id: string, activo: boolean): Promise<void> {
  await clienteDuenio().tenant.update({
    where: { id },
    data: { status: activo ? 'ACTIVO' : 'SUSPENDIDO' },
  });
}

/**
 * Borra un negocio y **todos** sus datos (las tablas de negocio se borran en
 * cascada). No tiene vuelta atrás: quien llama debe haber confirmado antes.
 */
export async function borrarNegocio(id: string): Promise<void> {
  await clienteDuenio().tenant.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Para el panel de plataforma
// ---------------------------------------------------------------------------

export interface NegocioEnLista {
  readonly negocio: Negocio;
  readonly creado: Date;
  readonly sucursales: number;
  readonly tarjetas: number;
  readonly usuarios: number;
}

/** Todos los negocios, activos y suspendidos, con sus tamaños. */
export async function listarNegocios(): Promise<NegocioEnLista[]> {
  const filas = await clienteDuenio().tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      slug: true,
      createdAt: true,
      _count: { select: { branchs: true, loyaltyCards: true, userAccounts: true } },
    },
  });
  const salida: NegocioEnLista[] = [];
  for (const f of filas) {
    const negocio = await negocioPorSlug(f.slug);
    if (negocio)
      salida.push({
        negocio,
        creado: f.createdAt,
        sucursales: f._count.branchs,
        tarjetas: f._count.loyaltyCards,
        usuarios: f._count.userAccounts,
      });
  }
  return salida;
}

/** Cambia la modalidad contratada. Solo plataforma: el negocio no puede. */
export async function cambiarPlan(id: string, plan: PlanNegocio): Promise<void> {
  const bd = clienteDuenio();
  const fila = await bd.tenant.findUniqueOrThrow({ where: { id }, select: { settings: true } });
  const ajustes =
    typeof fila.settings === 'object' && fila.settings !== null && !Array.isArray(fila.settings)
      ? fila.settings
      : {};
  await bd.tenant.update({ where: { id }, data: { settings: { ...ajustes, plan } } });
}

// ---------------------------------------------------------------------------
// Asistente de alta (autoregistro) y periodo de prueba
// ---------------------------------------------------------------------------

/** ¿Ya hay un club creado desde el asistente con ese correo o ese WhatsApp? */
export async function contactoConClub(correo: string, whatsapp: string): Promise<boolean> {
  const fila = await clienteDuenio().tenant.findFirst({
    where: {
      OR: [
        { settings: { path: ['alta', 'correo'], equals: correo } },
        { settings: { path: ['alta', 'whatsapp'], equals: whatsapp } },
      ],
    },
    select: { id: true },
  });
  return fila !== null;
}

/** Clubes creados en las últimas `horas`, para frenar altas en ráfaga. */
export function altasRecientes(horas = 24): Promise<number> {
  return clienteDuenio().tenant.count({
    where: { createdAt: { gte: new Date(Date.now() - horas * 60 * 60 * 1000) } },
  });
}

/** Primera dirección libre a partir de `base`: "barberia-leon", "barberia-leon-2"… */
export async function direccionLibre(base: string): Promise<string | null> {
  const bd = clienteDuenio();
  for (let i = 1; i <= 20; i += 1) {
    const slug = i === 1 ? base : `${base.slice(0, 56)}-${i}`;
    if (!esSlugDeNegocio(slug)) continue;
    const ocupado = await bd.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!ocupado) return slug;
  }
  return null;
}

/**
 * Cambia la fecha de fin de prueba. `null` la quita: el club queda activo sin
 * límite (es lo que se hace al registrar su pago).
 */
export async function fijarFinDePrueba(id: string, vence: string | null): Promise<void> {
  const bd = clienteDuenio();
  const fila = await bd.tenant.findUniqueOrThrow({ where: { id }, select: { settings: true } });
  const ajustes =
    typeof fila.settings === 'object' && fila.settings !== null && !Array.isArray(fila.settings)
      ? fila.settings
      : {};
  await bd.tenant.update({
    where: { id },
    data: { settings: { ...ajustes, pruebaVence: vence } },
  });
}
