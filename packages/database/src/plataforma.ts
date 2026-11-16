import {
  PROGRAMA_BASE,
  esPrefijoCodigo,
  esZonaHorariaValida,
  type ProgramaLealtad,
} from '@wl/domain';
import type { Prisma, PrismaClient } from '@prisma/client';

import { crearCliente } from './cliente';
import {
  conNegocio,
  negocioPorId,
  type AjustesNegocio,
  type MarcaNegocio,
  type Negocio,
} from './negocio';
import { emitirEnlaceContrasena } from './auth/usuarios';
import { prisma } from './index';

/**
 * Operaciones de plataforma: lo que hace Exkalibur, no un negocio.
 *
 * Crear, suspender o borrar un negocio toca la tabla `tenant`, que el rol de
 * la aplicación solo puede leer. Por eso estas funciones se conectan con el
 * rol dueño (`DIRECT_URL`). Hoy las usan la siembra y las pruebas; el panel de
 * plataforma (Fase 3) las usará desde una ruta protegida.
 */

let duenio: PrismaClient | null = null;

function clienteDuenio(): PrismaClient {
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

const SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** Subdominios que no pueden ser un negocio. */
const RESERVADOS = new Set(['www', 'app', 'api', 'admin', 'plataforma', 'static', 'mail']);

/** Crea un negocio con su programa inicial y sus sucursales. */
export async function crearNegocio(d: NegocioNuevo): Promise<ResultadoNegocio> {
  const slug = d.slug.trim().toLowerCase();
  if (!SLUG.test(slug) || RESERVADOS.has(slug)) {
    return { ok: false, error: 'El subdominio solo lleva minúsculas, números y guiones.' };
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
  if (existente) return { ok: false, error: `Ya existe un negocio con el subdominio «${slug}».` };

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
