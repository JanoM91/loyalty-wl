/**
 * Fechas civiles como texto "AAAA-MM-DD".
 *
 * Se trabaja con la fecha en texto y no con objetos Date desplazados, porque
 * sumar 24 horas a un Date no siempre da «el día siguiente». La zona horaria es
 * un dato de cada negocio: quien llama la pasa; si no, se usa la del centro de
 * México.
 */

export const ZONA_HORARIA_POR_OMISION = 'America/Mexico_City';

/** ¿Es una zona horaria IANA que este entorno conoce? */
export function esZonaHorariaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** Fecha civil de un instante en la zona horaria dada. */
export function fechaLocal(instante: Date, zona: string = ZONA_HORARIA_POR_OMISION): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zona,
  }).format(instante);
}

/** Suma (o resta) días de calendario a una fecha civil. */
export function sumarDias(fecha: string, dias: number): string {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/**
 * El instante en que empieza una fecha civil en la zona dada.
 *
 * Sirve para preguntar a la base «lo de hoy» sin suponer un desplazamiento
 * fijo: se prueba el desplazamiento de la zona en ese día y se corrige.
 */
export function inicioDelDia(fecha: string, zona: string = ZONA_HORARIA_POR_OMISION): Date {
  const utc = new Date(`${fecha}T00:00:00.000Z`);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utc);
  const n = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(
    n('year'),
    n('month') - 1,
    n('day'),
    n('hour'),
    n('minute'),
    n('second'),
  );
  const desplazamiento = comoUtc - utc.getTime();
  return new Date(utc.getTime() - desplazamiento);
}
