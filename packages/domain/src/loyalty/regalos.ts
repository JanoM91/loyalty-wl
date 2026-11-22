import { inicioDelDia, sumarDias } from '../shared/fecha';

/**
 * Regalos automáticos del club: «Te extrañamos» y cumpleaños.
 *
 * - «Te extrañamos»: a quien lleva `dias` sin venir (21, 30, 45 o 60) le llega
 *   un correo con un regalo para su próxima visita. Solo a quien puede
 *   recibir promociones (aceptó, correo verificado, sin baja): sin correo no
 *   hay manera de avisarle y el regalo no tendría sentido. Una vez por
 *   ausencia y, como mucho, una vez cada 90 días. Quien no viene desde hace
 *   más de 180 días ya no recibe nada: el correo suele estar abandonado.
 * - Cumpleaños: el día de su cumpleaños (el 28 de febrero si nació un 29 y el
 *   año no es bisiesto) aparece el regalo en su tarjeta y en la caja. Si puede
 *   recibir promociones, además le llega un correo de felicitación. Uno al año.
 *
 * Los dos regalos vencen (7, 14 o 30 días) y se entregan en caja una sola vez,
 * con la tarjeta verificada, igual que los premios.
 */

export const DIAS_REGRESO = [21, 30, 45, 60] as const;
export const VIGENCIAS_REGALO = [7, 14, 30] as const;

export type DiasRegreso = (typeof DIAS_REGRESO)[number];
export type VigenciaRegalo = (typeof VIGENCIAS_REGALO)[number];

/** Quien no viene desde hace más de esto ya no recibe «Te extrañamos». */
export const MAX_DIAS_SIN_VENIR = 180;
/** Días mínimos entre dos «Te extrañamos» a la misma tarjeta. */
export const DIAS_ENTRE_REGRESOS = 90;
/** Correos automáticos por club en un día: cuida el envío y el tope. */
export const TOPE_DIARIO_AUTOMATICOS = 100;
/** Largo del texto del regalo («Un café americano», «10% en tu compra»). */
export const LIMITES_REGALO = { minimo: 3, maximo: 60 } as const;

export type TipoRegalo = 'REGRESO' | 'CUMPLE';

export interface AjustesRegreso {
  readonly activo: boolean;
  readonly dias: DiasRegreso;
  /** Lo que se regala. Vacío mientras el dueño no lo escribe. */
  readonly regalo: string;
  readonly vigencia: VigenciaRegalo;
}

export interface AjustesCumple {
  readonly activo: boolean;
  readonly regalo: string;
  readonly vigencia: VigenciaRegalo;
}

export interface AjustesRegalos {
  readonly regreso: AjustesRegreso;
  readonly cumple: AjustesCumple;
}

export const REGALOS_POR_OMISION: AjustesRegalos = {
  regreso: { activo: false, dias: 30, regalo: '', vigencia: 14 },
  cumple: { activo: false, regalo: '', vigencia: 7 },
};

type Desconocido = Record<string, unknown>;
const objeto = (v: unknown): Desconocido =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Desconocido) : {};
const uno = <T extends number>(lista: readonly T[], v: unknown, respaldo: T): T =>
  (lista as readonly unknown[]).includes(v) ? (v as T) : respaldo;

/** El texto del regalo limpio, o el error para el dueño. */
export function revisarRegalo(
  crudo: string,
): { ok: true; regalo: string } | { ok: false; error: string } {
  const regalo = crudo.replace(/\s+/g, ' ').trim();
  if (regalo.length < LIMITES_REGALO.minimo)
    return { ok: false, error: 'Escribe qué les regalas, por ejemplo «Un café americano».' };
  if (regalo.length > LIMITES_REGALO.maximo)
    return { ok: false, error: `El regalo lleva hasta ${LIMITES_REGALO.maximo} letras.` };
  return { ok: true, regalo };
}

/** Lee lo guardado en `ajustes.regalos`; lo que falte o venga mal toma su valor por omisión. */
export function leerRegalos(json: unknown): AjustesRegalos {
  const a = objeto(json);
  const r = objeto(a.regreso);
  const c = objeto(a.cumple);
  const d = REGALOS_POR_OMISION;
  const texto = (v: unknown) => {
    const t = typeof v === 'string' ? revisarRegalo(v) : null;
    return t?.ok ? t.regalo : '';
  };
  const regresoRegalo = texto(r.regalo);
  const cumpleRegalo = texto(c.regalo);
  return {
    regreso: {
      // Sin regalo escrito no se puede encender.
      activo: r.activo === true && regresoRegalo !== '',
      dias: uno(DIAS_REGRESO, r.dias, d.regreso.dias),
      regalo: regresoRegalo,
      vigencia: uno(VIGENCIAS_REGALO, r.vigencia, d.regreso.vigencia),
    },
    cumple: {
      activo: c.activo === true && cumpleRegalo !== '',
      regalo: cumpleRegalo,
      vigencia: uno(VIGENCIAS_REGALO, c.vigencia, d.cumple.vigencia),
    },
  };
}

/** "2026-11-28" → "28 de noviembre". */
export function diaConMes(fecha: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00.000Z`));
}

const esBisiesto = (anio: number) => (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

/**
 * Cumpleaños que se celebran en la fecha civil dada ("AAAA-MM-DD"): ese día
 * y mes, más el 29 de febrero cuando la fecha es el 28 de febrero de un año
 * que no es bisiesto.
 */
export function cumpleanosDelDia(fecha: string): readonly { dia: number; mes: number }[] {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const hoy = [{ dia, mes }];
  if (mes === 2 && dia === 28 && !esBisiesto(anio)) hoy.push({ dia: 29, mes: 2 });
  return hoy;
}

/** El periodo de un regalo: el año para el cumpleaños, el día para «Te extrañamos». */
export function periodoDeRegalo(tipo: TipoRegalo, fecha: string): string {
  return tipo === 'CUMPLE' ? fecha.slice(0, 4) : fecha;
}

/**
 * Vigencia de un regalo dado en la fecha civil `fecha`: vale ese día y los
 * siguientes hasta completar `vigencia` días. Devuelve el instante en que
 * vence (inicio del día siguiente al último) y el último día válido.
 */
export function vigenciaDeRegalo(
  fecha: string,
  vigencia: number,
  zona: string,
): { vence: Date; ultimoDia: string } {
  return {
    vence: inicioDelDia(sumarDias(fecha, vigencia), zona),
    ultimoDia: sumarDias(fecha, vigencia - 1),
  };
}

/**
 * Límites de «Te extrañamos» para un día: la última visita debe ser anterior
 * a `antesDe` y posterior a `despuesDe`; y no debe haber otro «Te extrañamos»
 * desde `sinRegaloDesde`.
 */
export function ventanaRegreso(
  hoy: string,
  dias: number,
  zona: string,
): { antesDe: Date; despuesDe: Date; sinRegaloDesde: Date } {
  return {
    // Vino por última vez hace `dias` días o más (a cualquier hora de ese día).
    antesDe: inicioDelDia(sumarDias(hoy, -dias + 1), zona),
    despuesDe: inicioDelDia(sumarDias(hoy, -MAX_DIAS_SIN_VENIR), zona),
    sinRegaloDesde: inicioDelDia(sumarDias(hoy, -DIAS_ENTRE_REGRESOS + 1), zona),
  };
}
