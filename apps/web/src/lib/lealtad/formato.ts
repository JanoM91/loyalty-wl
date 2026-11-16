/**
 * Fechas del programa en español y en el horario de la plataforma.
 *
 * Dos tipos de fecha conviven aquí y no se deben mezclar:
 *
 * - **Fecha civil** (`@db.Date`, como la fecha de compra del ticket): llega
 *   como medianoche UTC y se lee en UTC. Leída en el horario de la plataforma, el 17
 *   aparecería como 16.
 * - **Instante** (`created_at`, `redeemed_at`): se convierte al horario de
 *   la zona local para mostrarlo.
 */

const ZONA = 'America/Mexico_City';

/** Fecha de compra: "17 sep 2026". */
export function fechaCivil(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(d)
    .replace('.', '');
}

/** Instante en hora local: "17 sep 2026". */
export function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ZONA,
  })
    .format(d)
    .replace('.', '');
}

/** Hora local: "10:42". */
export function hora(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA,
  }).format(d);
}

/** Pesos desde centavos: "$185.00". */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    centavos / 100,
  );
}
