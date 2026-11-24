import {
  PROGRAMA_BASE,
  ZONA_HORARIA_POR_OMISION,
  diasEnPausa,
  esPrefijoCodigo,
  esSlugDeNegocio,
  esZonaHorariaValida,
  fechaDeBorrado,
  finDePeriodoPagado,
  listoParaBorrar,
  type PeriodoPago,
  type ProgramaLealtad,
} from '@wl/domain';
import type { Prisma, PrismaClient } from '@prisma/client';

import { crearCliente } from './cliente';
import {
  conNegocio,
  leerAjustes,
  leerMarca,
  negocioPorId,
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
 * la aplicación solo puede leer, y el panel cruza datos de todos los clubes.
 * Por eso estas funciones usan otra conexión:
 *
 * - `DATABASE_URL_PLATAFORMA`, si existe: un usuario miembro de
 *   `wl_plataforma` (migración `rol_plataforma`), que lee y escribe datos
 *   pero no puede cambiar la estructura, el aislamiento ni los permisos.
 * - Si no, `DIRECT_URL` (el rol dueño), como antes.
 *
 * Las usan la siembra, las pruebas y el panel de plataforma (`/plataforma`).
 */

/** En desarrollo, Next recarga módulos: el singleton vive en `globalThis` para no fugar conexiones. */
const global = globalThis as unknown as { wlPrismaDuenio?: PrismaClient };

let duenio: PrismaClient | null = global.wlPrismaDuenio ?? null;

/** Conexión de plataforma: el rol `wl_plataforma` si está configurado; si no, el dueño. */
export function urlDePlataforma(): string | undefined {
  return process.env.DATABASE_URL_PLATAFORMA?.trim() || process.env.DIRECT_URL;
}

/**
 * Cliente de plataforma (sin RLS de negocio). Conserva el nombre de cuando
 * solo existía el rol dueño; ver `urlDePlataforma`.
 */
export function clienteDuenio(): PrismaClient {
  const url = urlDePlataforma();
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL_PLATAFORMA o DIRECT_URL: las operaciones de plataforma no tienen conexión.',
    );
  }
  duenio ??= crearCliente(url);
  if (process.env.NODE_ENV !== 'production') global.wlPrismaDuenio = duenio;
  return duenio;
}

export function desconectarPlataforma(): Promise<void> {
  const cliente = duenio;
  duenio = null;
  global.wlPrismaDuenio = undefined;
  return cliente ? cliente.$disconnect() : Promise.resolve();
}

export interface SucursalNueva {
  readonly slug: string;
  readonly nombre: string;
  readonly direccion?: string;
  readonly colonia?: string;
  readonly ciudad?: string;
  readonly estado?: string;
  readonly codigoPostal?: string;
  /** WhatsApp de la sucursal en E.164 sin signos: "522281234567". */
  readonly whatsapp?: string | null;
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
          whatsapp: s.whatsapp ?? null,
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

const SELECCION_EN_LISTA = {
  id: true,
  slug: true,
  name: true,
  status: true,
  timezone: true,
  codePrefix: true,
  brand: true,
  settings: true,
  createdAt: true,
  _count: { select: { branchs: true, loyaltyCards: true, userAccounts: true } },
} as const;

interface FilaEnLista {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly timezone: string;
  readonly codePrefix: string;
  readonly brand: unknown;
  readonly settings: unknown;
  readonly createdAt: Date;
  readonly _count: {
    readonly branchs: number;
    readonly loyaltyCards: number;
    readonly userAccounts: number;
  };
}

/** Misma lectura que `negocioPorSlug`, sobre la fila ya leída (sin otra consulta por negocio). */
function aNegocioEnLista(f: FilaEnLista): NegocioEnLista {
  return {
    negocio: {
      id: f.id,
      slug: f.slug,
      nombre: f.name,
      activo: f.status === 'ACTIVO',
      zonaHoraria: esZonaHorariaValida(f.timezone) ? f.timezone : ZONA_HORARIA_POR_OMISION,
      prefijoCodigo: esPrefijoCodigo(f.codePrefix) ? f.codePrefix : 'WL',
      marca: leerMarca(f.brand),
      ajustes: leerAjustes(f.settings),
    },
    creado: f.createdAt,
    sucursales: f._count.branchs,
    tarjetas: f._count.loyaltyCards,
    usuarios: f._count.userAccounts,
  };
}

/** Todos los negocios, activos y suspendidos, con sus tamaños. */
export async function listarNegocios(): Promise<NegocioEnLista[]> {
  const filas = await clienteDuenio().tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: SELECCION_EN_LISTA,
  });
  return filas.map(aNegocioEnLista);
}

/** Un negocio de la lista por su dirección, con una sola consulta. */
export async function obtenerNegocioEnLista(slug: string): Promise<NegocioEnLista | null> {
  const fila = await clienteDuenio().tenant.findUnique({
    where: { slug: slug.trim().toLowerCase() },
    select: SELECCION_EN_LISTA,
  });
  return fila ? aNegocioEnLista(fila) : null;
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

/**
 * Clubes donde ese correo tiene una cuenta del panel activa y con contraseña.
 * Sirve para entrar desde el sitio del servicio sin saber la dirección del
 * club. Como mucho cinco, del más antiguo al más nuevo.
 */
export async function clubesDelCorreo(correo: string): Promise<Negocio[]> {
  const email = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [];
  const filas = await clienteDuenio().userAccount.findMany({
    where: { email, isActive: true, passwordHash: { not: null } },
    select: { tenantId: true },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  const negocios = await Promise.all(filas.map((f) => negocioPorId(f.tenantId)));
  return negocios.filter((n): n is Negocio => n !== null);
}

/** Clubes creados en las últimas `horas`, para frenar altas en ráfaga. */
export function altasRecientes(horas = 24): Promise<number> {
  return clienteDuenio().tenant.count({
    where: { createdAt: { gte: new Date(Date.now() - horas * 60 * 60 * 1000) } },
  });
}

/**
 * Clubes creados en las últimas `horas` desde la misma red (huella de la IP,
 * guardada en `ajustes.alta.red`). Frena a un robot que cambia de correo.
 */
export function altasRecientesDesde(red: string, horas = 24): Promise<number> {
  return clienteDuenio().tenant.count({
    where: {
      createdAt: { gte: new Date(Date.now() - horas * 60 * 60 * 1000) },
      settings: { path: ['alta', 'red'], equals: red },
    },
  });
}

/** Primera dirección libre a partir de `base`: "barberia-leon", "barberia-leon-2"… */
export async function direccionLibre(base: string): Promise<string | null> {
  const candidatos: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const slug = i === 1 ? base : `${base.slice(0, 56)}-${i}`;
    if (esSlugDeNegocio(slug)) candidatos.push(slug);
  }
  if (candidatos.length === 0) return null;
  const ocupados = await clienteDuenio().tenant.findMany({
    where: { slug: { in: candidatos } },
    select: { slug: true },
  });
  const usados = new Set(ocupados.map((o) => o.slug));
  return candidatos.find((s) => !usados.has(s)) ?? null;
}

export async function mezclarAjustes(id: string, cambios: Record<string, unknown>): Promise<void> {
  const bd = clienteDuenio();
  const fila = await bd.tenant.findUniqueOrThrow({ where: { id }, select: { settings: true } });
  const ajustes =
    typeof fila.settings === 'object' && fila.settings !== null && !Array.isArray(fila.settings)
      ? fila.settings
      : {};
  await bd.tenant.update({
    where: { id },
    data: { settings: { ...ajustes, ...cambios } as Prisma.InputJsonValue },
  });
}

/**
 * Da una prueba nueva que vence en `vence`. Quita el periodo pagado, si había:
 * sirve también como gracia para un club que no renovó.
 */
export async function fijarFinDePrueba(id: string, vence: string | null): Promise<void> {
  await mezclarAjustes(id, { pruebaVence: vence, pagadoHasta: null });
}

/** Registra un pago de un mes o un año: el club queda activo hasta el fin del periodo. */
export async function registrarPago(negocio: Negocio, periodo: PeriodoPago): Promise<string> {
  const hasta = finDePeriodoPagado(periodo, negocio.ajustes.pagadoHasta);
  await mezclarAjustes(negocio.id, { pagadoHasta: hasta });
  return hasta;
}

// ---------------------------------------------------------------------------
// Borrado de clubes pausados
// ---------------------------------------------------------------------------

const CLAVE_BORRADO_AUTOMATICO = 'borrado_automatico';

/** ¿Está encendido el borrado automático de clubes con 30 días en pausa? Apagado por omisión. */
export async function borradoAutomaticoEncendido(): Promise<boolean> {
  const fila = await clienteDuenio().platformSetting.findUnique({
    where: { key: CLAVE_BORRADO_AUTOMATICO },
    select: { value: true },
  });
  return fila?.value === true;
}

export async function fijarBorradoAutomatico(encendido: boolean, quien: string): Promise<void> {
  await clienteDuenio().platformSetting.upsert({
    where: { key: CLAVE_BORRADO_AUTOMATICO },
    create: { key: CLAVE_BORRADO_AUTOMATICO, value: encendido, updatedBy: quien },
    update: { value: encendido, updatedBy: quien },
  });
}

export interface ClubEnPausa {
  readonly negocio: Negocio;
  readonly diasEnPausa: number;
  readonly borrarDesde: Date;
  readonly listo: boolean;
  readonly tarjetas: number;
}

/** Clubes en pausa (prueba o pago vencido), del que más tiempo lleva al que menos. */
export async function clubesEnPausa(
  ahora: Date = new Date(),
  lista?: readonly NegocioEnLista[],
): Promise<ClubEnPausa[]> {
  const salida: ClubEnPausa[] = [];
  for (const f of lista ?? (await listarNegocios())) {
    const { pruebaVence, pagadoHasta } = f.negocio.ajustes;
    const borrarDesde = fechaDeBorrado(pruebaVence, pagadoHasta, ahora);
    if (!borrarDesde) continue;
    salida.push({
      negocio: f.negocio,
      diasEnPausa: diasEnPausa(pruebaVence, pagadoHasta, ahora),
      borrarDesde,
      listo: listoParaBorrar(pruebaVence, pagadoHasta, ahora),
      tarjetas: f.tarjetas,
    });
  }
  return salida.sort((a, b) => b.diasEnPausa - a.diasEnPausa);
}

/**
 * Borra los clubes que cumplieron 30 días en pausa, solo si el borrado
 * automático está encendido. Lo llama la tarea diaria.
 */
export async function borrarClubesVencidos(
  ahora: Date = new Date(),
): Promise<{ readonly encendido: boolean; readonly borrados: readonly string[] }> {
  if (!(await borradoAutomaticoEncendido())) return { encendido: false, borrados: [] };
  const borrados: string[] = [];
  for (const c of await clubesEnPausa(ahora)) {
    if (!c.listo) continue;
    await borrarNegocio(c.negocio.id);
    borrados.push(c.negocio.slug);
  }
  return { encendido: true, borrados };
}
