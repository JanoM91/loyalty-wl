import { AsyncLocalStorage } from 'node:async_hooks';

import {
  ZONA_HORARIA_POR_OMISION,
  estadoComercial,
  esPrefijoCodigo,
  type EstadoComercial,
  esZonaHorariaValida,
  leerPermisosArcade,
  type ColoresMarca,
  type PermisosArcade,
} from '@wl/domain';

import { base } from './cliente';

/**
 * El negocio (tenant) al que pertenece lo que se está haciendo.
 *
 * Toda consulta de este paquete corre «dentro» de un negocio. De dónde sale:
 *
 * 1. `conNegocio(negocio, fn)`: quien llama lo fija a mano. Lo usan las tareas
 *    programadas (que recorren todos los negocios), el servicio web de Apple
 *    Wallet (que recibe el id en la ruta), la siembra y las pruebas.
 * 2. El resolutor registrado con `fijarResolutorDeNegocio`: la aplicación web
 *    registra uno que lee el subdominio de la petición.
 *
 * Si no hay negocio, la consulta **falla**; nunca corre «sin filtro». Y aunque
 * corriera, la base no devolvería nada: RLS exige `app.tenant_id`.
 */

// ---------------------------------------------------------------------------
// Marca y ajustes
// ---------------------------------------------------------------------------

export type { ColoresMarca };

/**
 * Plantilla de diseño: decide tipografía, formas y el carácter general. Los
 * colores los pone cada negocio; la plantilla, cómo se usan.
 * - `aire`: clara y mínima. La de las demos.
 * - `noche`: la misma, sobre fondo oscuro.
 * - `calida`: serif y tonos cálidos, para marcas artesanales.
 */
export const PLANTILLAS = ['aire', 'noche', 'calida'] as const;
export type PlantillaMarca = (typeof PLANTILLAS)[number];

export interface MarcaNegocio {
  readonly plantilla: PlantillaMarca;
  /** Va bajo el nombre en la portada. */
  readonly frase: string;
  readonly colores: ColoresMarca;
  /** Logotipo para fondos oscuros (cabecera). Null: se escribe el nombre. */
  readonly logoClaroUrl: string | null;
  /** Logotipo para fondos claros (cartel, correos). */
  readonly logoUrl: string | null;
  /** Isotipo cuadrado (ícono de la app, pases). */
  readonly iconoUrl: string | null;
  readonly contacto: {
    readonly correo: string | null;
    /** E.164 sin signos: "522281234567". Es lo que consume wa.me. */
    readonly whatsapp: string | null;
    readonly sitio: string | null;
  };
  readonly redes: {
    readonly instagram: string | null;
    readonly facebook: string | null;
  };
  /** Para los términos y el aviso de privacidad (plantillas a revisar con abogado). */
  readonly legal: {
    readonly razonSocial: string | null;
    readonly domicilio: string | null;
    readonly correoPrivacidad: string | null;
  };
}

/**
 * Qué hacer con el folio o la foto del ticket al registrar una visita.
 * NO_PEDIR: la caja sella en un toque, sin pantalla de ticket (lo normal en
 * negocios que no dan ticket, como una barbería). Es lo que reciben los clubes
 * creados desde el asistente.
 */
export type ReglaComprobante = 'NO_PEDIR' | 'PEDIDO' | 'OBLIGATORIO';

/**
 * Modalidad contratada.
 * - `LITE`: comparte instalación con otros negocios; personaliza su marca y su
 *   programa; campañas y reportes avanzados los administra Exkalibur.
 * - `PRIVADA`: instalación propia (su proyecto y su base), con todo abierto.
 */
export type PlanNegocio = 'LITE' | 'PRIVADA';

export interface AjustesNegocio {
  readonly plan: PlanNegocio;
  /**
   * Con el QR del cliente a la vista. PEDIDO: la caja lo pide siempre, pero si
   * no se captura la visita se acredita igual (queda anotado y esa visita no
   * se puede cruzar con la compra). OBLIGATORIO: sin folio ni foto no acredita.
   */
  readonly comprobanteConQr: ReglaComprobante;
  /** Sin el QR (cliente identificado por celular o correo). */
  readonly comprobanteSinTarjeta: ReglaComprobante;
  /** Estampas totales a partir de las cuales migrar la tarjeta física exige foto, celular y correo. */
  readonly umbralEvidenciaMigracion: number;
  /** Lugares que deben quedar libres al migrar: con 2, una tarjeta de 10 admite hasta 8 visitas migradas. */
  readonly margenMigracion: number;
  /** Días que se conservan las fotos de ticket y de tarjeta física. */
  readonly diasConservacionFotos: number;
  /**
   * Fin del periodo de prueba (fecha ISO). Null: el club no está en prueba,
   * porque ya pagó o porque lo dio de alta Exkalibur. Ver `estadoComercial`.
   */
  readonly pruebaVence: string | null;
  /**
   * Fin del último periodo pagado (fecha ISO). Si existe, manda sobre la
   * prueba: activo hasta esa fecha y pausado después.
   */
  readonly pagadoHasta: string | null;
  /** Lo que dejó el dueño en el asistente de alta. Null si lo creó Exkalibur. */
  readonly alta: AltaNegocio | null;
  /**
   * Arcade del club (servicio adicional): qué puede usar el club y hasta
   * cuándo está pagado. Null: nunca se le ha activado. Solo lo cambia la
   * plataforma.
   */
  readonly arcade: PermisosArcade | null;
  /**
   * «Mensajes a tus clientes»: si el club puede mandar correos a quienes
   * aceptaron promociones y cuántos al mes. Null: nunca se le ha activado.
   * Solo lo cambia la plataforma.
   */
  readonly mensajes: AjustesMensajes | null;
}

export interface AjustesMensajes {
  readonly activo: boolean;
  /** Correos al mes, contando cada destinatario. */
  readonly topeMensual: number;
}

/** Tope por omisión al encender el servicio a un club. */
export const TOPE_MENSAJES_POR_OMISION = 500;

export interface AltaNegocio {
  readonly giro: string;
  readonly correo: string;
  /** E.164 sin signos: "522281234567". */
  readonly whatsapp: string;
  /** Página desde la que llegó: "belleza", "cafeterias" o "empezar". */
  readonly origen: string;
  /** Versión de los términos y del aviso de privacidad que aceptó al crear el club. */
  readonly legal: string;
  /** Huella de la red desde la que se creó (no la IP): frena altas en ráfaga. */
  readonly red?: string;
}

export const MARCA_POR_OMISION: MarcaNegocio = {
  plantilla: 'aire',
  frase: '',
  colores: {
    fondo: '#1d1d1f',
    sobreFondo: '#ffffff',
    acento: '#ffd60a',
    papel: '#f5f5f7',
    tinta: '#1d1d1f',
  },
  logoClaroUrl: null,
  logoUrl: null,
  iconoUrl: null,
  contacto: { correo: null, whatsapp: null, sitio: null },
  redes: { instagram: null, facebook: null },
  legal: { razonSocial: null, domicilio: null, correoPrivacidad: null },
};

export const AJUSTES_POR_OMISION: AjustesNegocio = {
  plan: 'LITE',
  comprobanteConQr: 'PEDIDO',
  comprobanteSinTarjeta: 'OBLIGATORIO',
  umbralEvidenciaMigracion: 5,
  margenMigracion: 2,
  diasConservacionFotos: 90,
  pruebaVence: null,
  pagadoHasta: null,
  alta: null,
  arcade: null,
  mensajes: null,
};

type Desconocido = Record<string, unknown>;
const objeto = (v: unknown): Desconocido =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Desconocido) : {};
const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const color = (v: unknown, respaldo: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : respaldo;
const entero = (v: unknown, respaldo: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : respaldo;
const regla = (v: unknown, respaldo: ReglaComprobante): ReglaComprobante =>
  v === 'NO_PEDIR' || v === 'PEDIDO' || v === 'OBLIGATORIO' ? v : respaldo;
const fechaIso = (v: unknown): string | null =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;

/** Lee la marca guardada en la base; lo que falte o venga mal toma su valor por omisión. */
export function leerMarca(json: unknown): MarcaNegocio {
  const m = objeto(json);
  const c = objeto(m.colores);
  const contacto = objeto(m.contacto);
  const redes = objeto(m.redes);
  const legal = objeto(m.legal);
  const d = MARCA_POR_OMISION;
  return {
    plantilla: (PLANTILLAS as readonly unknown[]).includes(m.plantilla)
      ? (m.plantilla as PlantillaMarca)
      : d.plantilla,
    frase: texto(m.frase) ?? '',
    colores: {
      fondo: color(c.fondo, d.colores.fondo),
      sobreFondo: color(c.sobreFondo, d.colores.sobreFondo),
      acento: color(c.acento, d.colores.acento),
      papel: color(c.papel, d.colores.papel),
      tinta: color(c.tinta, d.colores.tinta),
    },
    logoClaroUrl: texto(m.logoClaroUrl),
    logoUrl: texto(m.logoUrl),
    iconoUrl: texto(m.iconoUrl),
    contacto: {
      correo: texto(contacto.correo),
      whatsapp: texto(contacto.whatsapp),
      sitio: texto(contacto.sitio),
    },
    redes: { instagram: texto(redes.instagram), facebook: texto(redes.facebook) },
    legal: {
      razonSocial: texto(legal.razonSocial),
      domicilio: texto(legal.domicilio),
      correoPrivacidad: texto(legal.correoPrivacidad),
    },
  };
}

/** Lee los ajustes guardados en la base, con los valores por omisión en lo que falte. */
export function leerAjustes(json: unknown): AjustesNegocio {
  const a = objeto(json);
  const d = AJUSTES_POR_OMISION;
  const alta = leerAlta(a.alta);
  // Los clubes del asistente sellan sin pedir ticket, salvo que el dueño lo cambie.
  const reglaAlta = (v: unknown, respaldo: ReglaComprobante) =>
    regla(v, alta ? 'NO_PEDIR' : respaldo);
  return {
    plan: a.plan === 'PRIVADA' ? 'PRIVADA' : d.plan,
    comprobanteConQr: reglaAlta(a.comprobanteConQr, d.comprobanteConQr),
    comprobanteSinTarjeta: reglaAlta(a.comprobanteSinTarjeta, d.comprobanteSinTarjeta),
    umbralEvidenciaMigracion: entero(a.umbralEvidenciaMigracion, d.umbralEvidenciaMigracion, 1, 30),
    margenMigracion: entero(a.margenMigracion, d.margenMigracion, 1, 10),
    diasConservacionFotos: entero(a.diasConservacionFotos, d.diasConservacionFotos, 1, 3650),
    pruebaVence: fechaIso(a.pruebaVence),
    pagadoHasta: fechaIso(a.pagadoHasta),
    alta,
    arcade: leerPermisosArcade(a.arcade),
    mensajes: leerAjustesMensajes(a.mensajes),
  };
}

export function leerAjustesMensajes(json: unknown): AjustesMensajes | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const m = json as Desconocido;
  return {
    activo: m.activo === true,
    topeMensual: entero(m.topeMensual, TOPE_MENSAJES_POR_OMISION, 0, 100_000),
  };
}

function leerAlta(json: unknown): AltaNegocio | null {
  const a = objeto(json);
  const correo = texto(a.correo);
  const whatsapp = texto(a.whatsapp);
  if (!correo || !whatsapp) return null;
  return {
    giro: texto(a.giro) ?? 'otro',
    correo,
    whatsapp,
    origen: texto(a.origen) ?? '',
    legal: texto(a.legal) ?? '',
    ...(texto(a.red) ? { red: texto(a.red)! } : {}),
  };
}

/** En prueba, pausado (prueba o pago vencido), o activo. No mira si está suspendido. */
export function estadoComercialDe(negocio: Negocio, ahora: Date = new Date()): EstadoComercial {
  return estadoComercial(negocio.ajustes.pruebaVence, ahora, negocio.ajustes.pagadoHasta);
}

// ---------------------------------------------------------------------------
// Negocio
// ---------------------------------------------------------------------------

export interface Negocio {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
  readonly activo: boolean;
  readonly zonaHoraria: string;
  /** Prefijo del código de las tarjetas: "WL". */
  readonly prefijoCodigo: string;
  readonly marca: MarcaNegocio;
  readonly ajustes: AjustesNegocio;
}

interface FilaNegocio {
  id: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  codePrefix: string;
  brand: unknown;
  settings: unknown;
}

const SELECCION = {
  id: true,
  slug: true,
  name: true,
  status: true,
  timezone: true,
  codePrefix: true,
  brand: true,
  settings: true,
} as const;

function aNegocio(f: FilaNegocio): Negocio {
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.name,
    activo: f.status === 'ACTIVO',
    zonaHoraria: esZonaHorariaValida(f.timezone) ? f.timezone : ZONA_HORARIA_POR_OMISION,
    prefijoCodigo: esPrefijoCodigo(f.codePrefix) ? f.codePrefix : 'WL',
    marca: leerMarca(f.brand),
    ajustes: leerAjustes(f.settings),
  };
}

const SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El negocio de un subdominio, o null si no existe. Incluye los suspendidos. */
export async function negocioPorSlug(slug: string): Promise<Negocio | null> {
  const limpio = slug.trim().toLowerCase();
  if (!SLUG.test(limpio)) return null;
  const fila = await base.tenant.findUnique({ where: { slug: limpio }, select: SELECCION });
  return fila ? aNegocio(fila) : null;
}

/** El negocio por su id, o null. */
export async function negocioPorId(id: string): Promise<Negocio | null> {
  if (!UUID.test(id)) return null;
  const fila = await base.tenant.findUnique({ where: { id }, select: SELECCION });
  return fila ? aNegocio(fila) : null;
}

/** Todos los negocios activos, para las tareas programadas. */
export async function negociosActivos(): Promise<Negocio[]> {
  const filas = await base.tenant.findMany({
    where: { status: 'ACTIVO' },
    orderBy: { slug: 'asc' },
    select: SELECCION,
  });
  return filas.map(aNegocio);
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

const almacen = new AsyncLocalStorage<Negocio>();

type Resolutor = () => Promise<Negocio | null> | Negocio | null;
const global = globalThis as unknown as { wlResolutorNegocio?: Resolutor };

/** Ejecuta `fn` dentro de un negocio. Manda sobre el resolutor registrado. */
export function conNegocio<T>(negocio: Negocio, fn: () => Promise<T>): Promise<T> {
  // El `await` va dentro a propósito: las consultas de Prisma son perezosas y
  // no arrancan hasta que alguien las espera. Si se esperaran fuera, correrían
  // ya sin negocio.
  return almacen.run(negocio, async () => await fn());
}

/**
 * Registra de dónde sale el negocio cuando nadie lo fijó con `conNegocio`.
 * La aplicación web registra uno que lee el subdominio de la petición.
 */
export function fijarResolutorDeNegocio(resolutor: Resolutor): void {
  global.wlResolutorNegocio = resolutor;
}

export class SinNegocioError extends Error {
  constructor() {
    super(
      'Esta operación necesita un negocio y no hay ninguno en contexto. ' +
        'Usa conNegocio(negocio, fn) o registra un resolutor con fijarResolutorDeNegocio.',
    );
    this.name = 'SinNegocioError';
  }
}

/** El negocio en contexto, o null. */
export async function negocioSiHay(): Promise<Negocio | null> {
  const fijado = almacen.getStore();
  if (fijado) return fijado;
  return (await global.wlResolutorNegocio?.()) ?? null;
}

/** El negocio en contexto. Lanza `SinNegocioError` si no hay. */
export async function negocioActual(): Promise<Negocio> {
  const negocio = await negocioSiHay();
  if (!negocio) throw new SinNegocioError();
  return negocio;
}

/** Qué puede hacer el negocio por su cuenta, según su modalidad. */
export function funcionesDelPlan(negocio: Negocio): {
  readonly marcaEditable: boolean;
  readonly campanas: boolean;
  readonly reportesCompletos: boolean;
} {
  const privada = negocio.ajustes.plan === 'PRIVADA';
  return { marcaEditable: true, campanas: privada, reportesCompletos: privada };
}
