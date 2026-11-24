/**
 * Reportes del programa por periodo (panel › Números › Tendencias y
 * Distribución de visitas). Aquí vive lo que no necesita base de datos: filtros, periodo
 * anterior, accesos rápidos y cubetas. Adaptado del tablero de analítica del
 * sistema de referencia (nov-2026), sin la parte de punto de venta.
 */

import { sumarDias } from '../shared/fecha';
import { diasEntre } from './motor';

export type AgruparReporte = 'DIA' | 'SEMANA' | 'MES';

export interface FiltrosReporte {
  /** AAAA-MM-DD, incluidos los dos, en la zona del negocio. */
  readonly desde: string;
  readonly hasta: string;
  readonly agrupar: AgruparReporte;
  /** Direcciones de sucursal. Vacío = todas. */
  readonly sucursales: readonly string[];
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Máximo de días por consulta (~4 años). */
export const MAX_DIAS_REPORTE = 1500;

/** Días del periodo, contando los dos extremos. */
export function diasDelPeriodo(desde: string, hasta: string): number {
  return diasEntre(desde, hasta) + 1;
}

/** El periodo inmediatamente anterior, del mismo largo. */
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const n = diasDelPeriodo(desde, hasta);
  return { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
}

/**
 * Normaliza lo que llega de la URL: fechas válidas y en orden, un máximo de
 * días y solo sucursales que existen. Por omisión, los últimos 28 días.
 */
export function normalizarFiltrosReporte(
  x: { desde?: unknown; hasta?: unknown; agrupar?: unknown; sucursales?: unknown },
  hoy: string,
  sucursalesValidas: readonly string[],
): FiltrosReporte {
  const fecha = (v: unknown, def: string) => (typeof v === 'string' && FECHA.test(v) ? v : def);
  let hasta = fecha(x.hasta, hoy);
  let desde = fecha(x.desde, sumarDias(hasta > hoy ? hoy : hasta, -27));
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  // Nada en el futuro: los días que no han llegado no tienen datos.
  if (hasta > hoy) hasta = hoy;
  if (desde > hasta) desde = hasta;
  if (diasDelPeriodo(desde, hasta) > MAX_DIAS_REPORTE) {
    desde = sumarDias(hasta, -(MAX_DIAS_REPORTE - 1));
  }
  const lista = Array.isArray(x.sucursales) ? x.sucursales : [];
  const sucursales = [
    ...new Set(
      lista.filter((s): s is string => typeof s === 'string' && sucursalesValidas.includes(s)),
    ),
  ];
  const agrupar: AgruparReporte = x.agrupar === 'SEMANA' || x.agrupar === 'MES' ? x.agrupar : 'DIA';
  return { desde, hasta, agrupar, sucursales };
}

export interface AccesoRapido {
  readonly nombre: string;
  readonly desde: string;
  readonly hasta: string;
  readonly agrupar: AgruparReporte;
}

/** Periodos de un toque: hoy, 7 y 28 días, el mes, 13 semanas, el año y desde el inicio. */
export function accesosRapidos(hoy: string, primerDia: string | null = null): AccesoRapido[] {
  const [a, m] = hoy.split('-').map(Number) as [number, number];
  const inicioMes = `${a}-${String(m).padStart(2, '0')}-01`;
  const finMesAnterior = sumarDias(inicioMes, -1);
  const inicioMesAnterior = `${finMesAnterior.slice(0, 7)}-01`;
  return [
    { nombre: 'Hoy', desde: hoy, hasta: hoy, agrupar: 'DIA' },
    { nombre: '7 días', desde: sumarDias(hoy, -6), hasta: hoy, agrupar: 'DIA' },
    { nombre: '28 días', desde: sumarDias(hoy, -27), hasta: hoy, agrupar: 'DIA' },
    { nombre: 'Este mes', desde: inicioMes, hasta: hoy, agrupar: 'DIA' },
    { nombre: 'Mes anterior', desde: inicioMesAnterior, hasta: finMesAnterior, agrupar: 'DIA' },
    { nombre: '13 semanas', desde: sumarDias(hoy, -90), hasta: hoy, agrupar: 'SEMANA' },
    { nombre: '12 meses', desde: sumarDias(hoy, -364), hasta: hoy, agrupar: 'MES' },
    ...(primerDia && primerDia < hoy
      ? [{ nombre: 'Desde el inicio', desde: primerDia, hasta: hoy, agrupar: 'MES' as const }]
      : []),
  ];
}

/**
 * Inicio de cada periodo entre dos fechas, en orden: cada día, el lunes de
 * cada semana o el día 1 de cada mes (lo mismo que `date_trunc` en la base).
 * Sirve para que la gráfica muestre en cero los periodos sin movimiento.
 */
export function periodosDelRango(desde: string, hasta: string, agrupar: AgruparReporte): string[] {
  if (desde > hasta) return [];
  const inicio = (f: string) => {
    if (agrupar === 'MES') return `${f.slice(0, 7)}-01`;
    if (agrupar === 'SEMANA') {
      const dia = new Date(`${f}T00:00:00Z`).getUTCDay(); // 0 = domingo
      return sumarDias(f, -((dia + 6) % 7));
    }
    return f;
  };
  const siguiente = (f: string) => {
    if (agrupar === 'MES') {
      const [a, m] = f.split('-').map(Number) as [number, number];
      return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
    }
    return sumarDias(f, agrupar === 'SEMANA' ? 7 : 1);
  };
  const lista: string[] = [];
  for (let f = inicio(desde); f <= hasta; f = siguiente(f)) lista.push(f);
  return lista;
}

/** Cubetas de «visitas por cliente en el periodo», en orden. */
export const CUBETAS_FRECUENCIA = ['1', '2', '3', '4–5', '6–9', '10 o más'] as const;
export type CubetaFrecuencia = (typeof CUBETAS_FRECUENCIA)[number];

export function cubetaDeVisitas(n: number): CubetaFrecuencia | null {
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  if (n <= 5) return '4–5';
  if (n <= 9) return '6–9';
  return '10 o más';
}

/**
 * Sellos en el ciclo con los que a la tarjeta le falta una visita para un
 * premio: la posición de cada premio menos uno.
 */
export function sellosCercaDelPremio(posicionesDePremio: readonly number[]): number[] {
  return [...new Set(posicionesDePremio.filter((p) => p >= 1).map((p) => p - 1))].sort(
    (a, b) => a - b,
  );
}

/** Proporción segura: 0 si no hay base. */
export function proporcion(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}
