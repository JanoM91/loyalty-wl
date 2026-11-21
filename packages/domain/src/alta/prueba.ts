/**
 * Periodo de prueba de un club creado desde el asistente de alta.
 *
 * El club nace con una fecha de vencimiento. Mientras no llega, opera completo
 * («PRUEBA»). Al pasar, queda «PAUSADO»: la caja deja de sellar y no se crean
 * tarjetas nuevas, pero nada se borra. Cuando Exkalibur registra el pago quita
 * la fecha y el club queda «ACTIVO» sin límite.
 */

export const DIAS_PRUEBA = 7;
/** Tarjetas que admite un club mientras está en prueba. */
export const TOPE_TARJETAS_PRUEBA = 200;
/** Días que se conservan las tarjetas de un club pausado antes de borrarlo. */
export const DIAS_CONSERVACION_PAUSADO = 30;

export type EstadoComercial = 'ACTIVO' | 'PRUEBA' | 'PAUSADO';

/** `vence`: fecha ISO en que termina la prueba, o null si el club ya pagó o no tiene prueba. */
export function estadoComercial(vence: string | null, ahora: Date = new Date()): EstadoComercial {
  if (!vence) return 'ACTIVO';
  const fin = Date.parse(vence);
  if (Number.isNaN(fin)) return 'ACTIVO';
  return ahora.getTime() < fin ? 'PRUEBA' : 'PAUSADO';
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
  return Math.ceil((fin - ahora.getTime()) / (24 * 60 * 60 * 1000));
}
