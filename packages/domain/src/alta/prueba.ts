/**
 * Prueba, pago y pausa de un club creado desde el asistente de alta.
 *
 * El club nace con una fecha de fin de prueba. Mientras no llega, opera
 * completo («PRUEBA»). Al pasar, queda «PAUSADO»: la caja deja de sellar y no
 * se crean tarjetas nuevas. Cuando plataforma registra un pago, el club queda
 * «ACTIVO» hasta `pagadoHasta` (un mes o un año); si no renueva, vuelve a
 * «PAUSADO». A los 30 días en pausa el club puede borrarse.
 *
 * Un club sin ninguna de las dos fechas (lo dio de alta Exkalibur) está
 * activo sin límite.
 */

export const DIAS_PRUEBA = 7;
/** Tarjetas que admite un club mientras está en prueba. */
export const TOPE_TARJETAS_PRUEBA = 200;
/** Días que se conservan las tarjetas de un club pausado antes de borrarlo. */
export const DIAS_CONSERVACION_PAUSADO = 30;

export type EstadoComercial = 'ACTIVO' | 'PRUEBA' | 'PAUSADO';

const DIA = 24 * 60 * 60 * 1000;

function fecha(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * `vence`: fecha ISO en que termina la prueba. `pagadoHasta`: fin del último
 * periodo pagado; si existe, manda sobre la prueba.
 */
export function estadoComercial(
  vence: string | null,
  ahora: Date = new Date(),
  pagadoHasta: string | null = null,
): EstadoComercial {
  const pagado = fecha(pagadoHasta);
  if (pagado !== null) return ahora.getTime() < pagado ? 'ACTIVO' : 'PAUSADO';
  const fin = fecha(vence);
  if (fin === null) return 'ACTIVO';
  return ahora.getTime() < fin ? 'PRUEBA' : 'PAUSADO';
}

/** Desde cuándo está en pausa un club, o null si no lo está. */
export function pausadoDesde(
  vence: string | null,
  pagadoHasta: string | null,
  ahora: Date = new Date(),
): Date | null {
  if (estadoComercial(vence, ahora, pagadoHasta) !== 'PAUSADO') return null;
  return new Date((fecha(pagadoHasta) ?? fecha(vence))!);
}

/** Días completos que lleva en pausa; 0 si no lo está. */
export function diasEnPausa(
  vence: string | null,
  pagadoHasta: string | null,
  ahora: Date = new Date(),
): number {
  const desde = pausadoDesde(vence, pagadoHasta, ahora);
  return desde ? Math.floor((ahora.getTime() - desde.getTime()) / DIA) : 0;
}

/** Fecha a partir de la cual un club en pausa puede borrarse, o null si no está en pausa. */
export function fechaDeBorrado(
  vence: string | null,
  pagadoHasta: string | null,
  ahora: Date = new Date(),
): Date | null {
  const desde = pausadoDesde(vence, pagadoHasta, ahora);
  return desde ? new Date(desde.getTime() + DIAS_CONSERVACION_PAUSADO * DIA) : null;
}

/** ¿Cumplió los 30 días en pausa? */
export function listoParaBorrar(
  vence: string | null,
  pagadoHasta: string | null,
  ahora: Date = new Date(),
): boolean {
  const fin = fechaDeBorrado(vence, pagadoHasta, ahora);
  return fin !== null && ahora.getTime() >= fin.getTime();
}

export type PeriodoPago = 'MES' | 'ANIO';

/**
 * Fin del periodo que se acaba de pagar. Si el club sigue pagado, el periodo
 * nuevo empieza donde termina el actual; si no, desde hoy.
 */
export function finDePeriodoPagado(
  periodo: PeriodoPago,
  pagadoHasta: string | null,
  ahora: Date = new Date(),
): string {
  const actual = fecha(pagadoHasta);
  const inicio = new Date(actual !== null && actual > ahora.getTime() ? actual : ahora.getTime());
  const fin = new Date(inicio);
  if (periodo === 'MES') fin.setUTCMonth(fin.getUTCMonth() + 1);
  else fin.setUTCFullYear(fin.getUTCFullYear() + 1);
  return fin.toISOString();
}

/** Vencimiento de una prueba que empieza en `inicio`. */
export function vencimientoDePrueba(inicio: Date = new Date()): string {
  return new Date(inicio.getTime() + DIAS_PRUEBA * 24 * 60 * 60 * 1000).toISOString();
}

/** Días completos que le quedan a la prueba; 0 si ya venció o no hay prueba. */
export function diasRestantesDePrueba(vence: string | null, ahora: Date = new Date()): number {
  if (!vence) return 0;
  const fin = Date.parse(vence);
  if (Number.isNaN(fin) || fin <= ahora.getTime()) return 0;
  return Math.ceil((fin - ahora.getTime()) / DIA);
}
