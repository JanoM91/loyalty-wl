import { Prisma } from '@prisma/client';
import {
  CUBETAS_FRECUENCIA,
  cubetaDeVisitas,
  periodoAnterior,
  type CubetaFrecuencia,
  type FiltrosReporte,
} from '@wl/domain';

import { negocioActual, transaccion } from '../index';

/**
 * Reportes del programa por periodo, con filtros (fechas, agrupación y
 * sucursales). Es la parte de lealtad del tablero de analítica del sistema de
 * referencia, sin ventas ni punto de venta. Corre dentro del negocio en
 * contexto: RLS deja ver solo sus filas también en este SQL.
 *
 * Definiciones:
 * - Visita: acreditación ACREDITADA que no es migración de tarjeta física, por
 *   la fecha del ticket (`purchase_date`) y la sucursal donde se registró.
 * - Tarjeta nueva: alta en la fecha (hora del negocio); con filtro de
 *   sucursal, la sucursal donde se dio de alta.
 * - Premio ganado: por la fecha en que se ganó y la sucursal de la visita que
 *   lo dio; canjeado: por la fecha y la sucursal del canje.
 * - Regresaron: clientes con visita en el periodo anterior (mismo largo) que
 *   volvieron en este.
 * - Horarios: la hora en que la caja registró la visita, solo si la registró
 *   el mismo día de la compra (las contingencias de días anteriores no dicen
 *   a qué hora vino el cliente).
 */

export interface IndicadoresReporte {
  readonly altas: number;
  readonly visitas: number;
  readonly clientes: number;
  /** Clientes con 2 visitas o más dentro del periodo. */
  readonly repiten: number;
  /** Clientes con visita en el periodo anterior… */
  readonly baseRegreso: number;
  /** …de los que volvieron en este periodo. */
  readonly regresaron: number;
  readonly premiosGanados: number;
  readonly premiosCanjeados: number;
}

export interface PuntoReporte {
  /** Primer día del periodo (día, lunes de la semana o día 1 del mes). */
  readonly periodo: string;
  readonly altas: number;
  readonly visitas: number;
  readonly clientes: number;
  readonly canjes: number;
}

export interface VisitasSucursalPeriodo {
  readonly periodo: string;
  readonly sucursal: string;
  readonly visitas: number;
}

export interface CeldaHorario {
  /** 1 = lunes … 7 = domingo. */
  readonly dia: number;
  readonly hora: number;
  readonly visitas: number;
}

export interface FilaSucursalReporte {
  readonly slug: string;
  readonly nombre: string;
  readonly visitas: number;
  readonly clientes: number;
  readonly altas: number;
  readonly canjes: number;
}

export interface ReportePeriodo {
  readonly filtros: FiltrosReporte;
  readonly anterior: { readonly desde: string; readonly hasta: string };
  readonly actual: IndicadoresReporte;
  readonly previo: IndicadoresReporte;
  readonly serie: readonly PuntoReporte[];
  readonly porSucursal: readonly VisitasSucursalPeriodo[];
  readonly horarios: readonly CeldaHorario[];
  /** Clientes del periodo por número de visitas, en el orden de `CUBETAS_FRECUENCIA`. */
  readonly frecuencia: readonly { readonly cubeta: CubetaFrecuencia; readonly clientes: number }[];
  readonly sucursales: readonly FilaSucursalReporte[];
}

export interface OpcionesReporte {
  /** Hoy en la zona del negocio (AAAA-MM-DD). */
  readonly hoy: string;
  readonly sucursales: readonly { readonly slug: string; readonly nombre: string }[];
  /** Primer día con una tarjeta o una visita; null si el club está vacío. */
  readonly primerDia: string | null;
}

const iso = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);

function filtroSucursal(f: FiltrosReporte, columna: Prisma.Sql): Prisma.Sql {
  return f.sucursales.length > 0
    ? Prisma.sql`AND ${columna} IN (SELECT id FROM branch WHERE slug = ANY(${[...f.sucursales]}::text[]))`
    : Prisma.empty;
}

function agrupar(f: FiltrosReporte, columna: Prisma.Sql): Prisma.Sql {
  if (f.agrupar === 'SEMANA') return Prisma.sql`date_trunc('week', ${columna})::date`;
  if (f.agrupar === 'MES') return Prisma.sql`date_trunc('month', ${columna})::date`;
  return Prisma.sql`(${columna})::date`;
}

/** Sucursales del club y primer día con datos, para los filtros. */
export async function opcionesReporte(): Promise<OpcionesReporte> {
  const zona = (await negocioActual()).zonaHoraria;
  return transaccion(async (tx) => {
    const sucursales = await tx.branch.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });
    const [rango] = await tx.$queryRaw<{ hoy: string; primero: Date | null }[]>(Prisma.sql`
      SELECT to_char((now() AT TIME ZONE ${zona}::text)::date, 'YYYY-MM-DD') AS hoy, LEAST(
        (SELECT min(created_at AT TIME ZONE ${zona}::text)::date FROM loyalty_card),
        (SELECT min(purchase_date) FROM loyalty_accrual)
      ) AS primero`);
    return {
      hoy: rango?.hoy ?? iso(new Date()),
      sucursales: sucursales.map((s) => ({ slug: s.slug, nombre: s.name })),
      primerDia: rango?.primero ? iso(rango.primero) : null,
    };
  });
}

interface FilaIndicadores {
  altas: number;
  visitas: number;
  clientes: number;
  repiten: number;
  base: number;
  regresaron: number;
  ganados: number;
  canjeados: number;
}

async function indicadores(
  tx: Prisma.TransactionClient,
  f: FiltrosReporte,
  zona: string,
  desde: string,
  hasta: string,
): Promise<IndicadoresReporte> {
  const ant = periodoAnterior(desde, hasta);
  const visitas = (d: string, h: string) => Prisma.sql`
    SELECT card_id FROM loyalty_accrual a
     WHERE a.status = 'ACREDITADA' AND a.capture_source <> 'MIGRACION'
       AND a.purchase_date BETWEEN ${d}::date AND ${h}::date
       ${filtroSucursal(f, Prisma.sql`a.branch_id`)}`;
  const [x] = await tx.$queryRaw<FilaIndicadores[]>(Prisma.sql`
    WITH v AS (${visitas(desde, hasta)}),
         vp AS (${visitas(ant.desde, ant.hasta)})
    SELECT
      (SELECT count(*) FROM loyalty_card c
        WHERE c.is_active
          AND (c.created_at AT TIME ZONE ${zona}::text)::date BETWEEN ${desde}::date AND ${hasta}::date
          ${filtroSucursal(f, Prisma.sql`c.enrolled_branch_id`)})::int AS altas,
      (SELECT count(*) FROM v)::int AS visitas,
      (SELECT count(DISTINCT card_id) FROM v)::int AS clientes,
      (SELECT count(*) FROM (SELECT card_id FROM v GROUP BY 1 HAVING count(*) >= 2) r)::int AS repiten,
      (SELECT count(DISTINCT card_id) FROM vp)::int AS base,
      (SELECT count(DISTINCT card_id) FROM vp WHERE card_id IN (SELECT card_id FROM v))::int AS regresaron,
      (SELECT count(*) FROM loyalty_reward r
         LEFT JOIN loyalty_accrual a ON a.id = r.accrual_id
        WHERE (r.created_at AT TIME ZONE ${zona}::text)::date BETWEEN ${desde}::date AND ${hasta}::date
          ${filtroSucursal(f, Prisma.sql`a.branch_id`)})::int AS ganados,
      (SELECT count(*) FROM loyalty_reward r
        WHERE r.redeemed_at IS NOT NULL
          AND (r.redeemed_at AT TIME ZONE ${zona}::text)::date BETWEEN ${desde}::date AND ${hasta}::date
          ${filtroSucursal(f, Prisma.sql`r.redeemed_branch_id`)})::int AS canjeados`);
  return {
    altas: x?.altas ?? 0,
    visitas: x?.visitas ?? 0,
    clientes: x?.clientes ?? 0,
    repiten: x?.repiten ?? 0,
    baseRegreso: x?.base ?? 0,
    regresaron: x?.regresaron ?? 0,
    premiosGanados: x?.ganados ?? 0,
    premiosCanjeados: x?.canjeados ?? 0,
  };
}

/** Todo el reporte del periodo en una sola transacción (una conexión). */
export async function reportePeriodo(f: FiltrosReporte): Promise<ReportePeriodo> {
  const zona = (await negocioActual()).zonaHoraria;
  const anterior = periodoAnterior(f.desde, f.hasta);
  const alta = Prisma.sql`(c.created_at AT TIME ZONE ${zona}::text)`;
  const canje = Prisma.sql`(r.redeemed_at AT TIME ZONE ${zona}::text)`;
  const sucV = filtroSucursal(f, Prisma.sql`a.branch_id`);
  const valida = Prisma.sql`a.status = 'ACREDITADA' AND a.capture_source <> 'MIGRACION'
    AND a.purchase_date BETWEEN ${f.desde}::date AND ${f.hasta}::date ${sucV}`;

  return transaccion(async (tx) => {
    const actual = await indicadores(tx, f, zona, f.desde, f.hasta);
    const previo = await indicadores(tx, f, zona, anterior.desde, anterior.hasta);

    const serie = await tx.$queryRaw<
      (Omit<PuntoReporte, 'periodo'> & { periodo: Date })[]
    >(Prisma.sql`
      WITH al AS (
        SELECT ${agrupar(f, alta)} AS periodo, count(*)::int AS n FROM loyalty_card c
         WHERE c.is_active AND ${alta}::date BETWEEN ${f.desde}::date AND ${f.hasta}::date
           ${filtroSucursal(f, Prisma.sql`c.enrolled_branch_id`)}
         GROUP BY 1
      ),
      vi AS (
        SELECT ${agrupar(f, Prisma.sql`a.purchase_date`)} AS periodo, count(*)::int AS n,
               count(DISTINCT a.card_id)::int AS clientes
          FROM loyalty_accrual a WHERE ${valida}
         GROUP BY 1
      ),
      ca AS (
        SELECT ${agrupar(f, canje)} AS periodo, count(*)::int AS n FROM loyalty_reward r
         WHERE r.redeemed_at IS NOT NULL
           AND ${canje}::date BETWEEN ${f.desde}::date AND ${f.hasta}::date
           ${filtroSucursal(f, Prisma.sql`r.redeemed_branch_id`)}
         GROUP BY 1
      ),
      p AS (SELECT periodo FROM al UNION SELECT periodo FROM vi UNION SELECT periodo FROM ca)
      SELECT p.periodo, COALESCE(al.n, 0)::int AS altas, COALESCE(vi.n, 0)::int AS visitas,
             COALESCE(vi.clientes, 0)::int AS clientes, COALESCE(ca.n, 0)::int AS canjes
        FROM p LEFT JOIN al USING (periodo) LEFT JOIN vi USING (periodo) LEFT JOIN ca USING (periodo)
       ORDER BY 1`);

    const porSucursal = await tx.$queryRaw<
      { periodo: Date; sucursal: string; visitas: number }[]
    >(Prisma.sql`
      SELECT ${agrupar(f, Prisma.sql`a.purchase_date`)} AS periodo, b.slug AS sucursal,
             count(*)::int AS visitas
        FROM loyalty_accrual a JOIN branch b ON b.id = a.branch_id
       WHERE ${valida}
       GROUP BY 1, 2 ORDER BY 1, 2`);

    const horarios = await tx.$queryRaw<CeldaHorario[]>(Prisma.sql`
      SELECT extract(isodow FROM a.created_at AT TIME ZONE ${zona}::text)::int AS dia,
             extract(hour FROM a.created_at AT TIME ZONE ${zona}::text)::int AS hora,
             count(*)::int AS visitas
        FROM loyalty_accrual a
       WHERE ${valida}
         AND (a.created_at AT TIME ZONE ${zona}::text)::date = a.purchase_date
       GROUP BY 1, 2 ORDER BY 1, 2`);

    const veces = await tx.$queryRaw<{ veces: number; clientes: number }[]>(Prisma.sql`
      SELECT veces::int, count(*)::int AS clientes FROM (
        SELECT a.card_id, count(*) AS veces FROM loyalty_accrual a WHERE ${valida} GROUP BY 1
      ) x GROUP BY 1`);
    const porCubeta = new Map<CubetaFrecuencia, number>();
    for (const v of veces) {
      const c = cubetaDeVisitas(v.veces);
      if (c) porCubeta.set(c, (porCubeta.get(c) ?? 0) + v.clientes);
    }

    const sucursales = await tx.$queryRaw<FilaSucursalReporte[]>(Prisma.sql`
      SELECT b.slug, b.name AS nombre,
             (SELECT count(*) FROM loyalty_accrual a WHERE a.branch_id = b.id AND ${valida})::int AS visitas,
             (SELECT count(DISTINCT a.card_id) FROM loyalty_accrual a WHERE a.branch_id = b.id AND ${valida})::int AS clientes,
             (SELECT count(*) FROM loyalty_card c
               WHERE c.is_active AND c.enrolled_branch_id = b.id
                 AND ${alta}::date BETWEEN ${f.desde}::date AND ${f.hasta}::date)::int AS altas,
             (SELECT count(*) FROM loyalty_reward r
               WHERE r.redeemed_branch_id = b.id AND r.redeemed_at IS NOT NULL
                 AND ${canje}::date BETWEEN ${f.desde}::date AND ${f.hasta}::date)::int AS canjes
        FROM branch b
       WHERE b.is_active ${f.sucursales.length > 0 ? Prisma.sql`AND b.slug = ANY(${[...f.sucursales]}::text[])` : Prisma.empty}
       ORDER BY b.name`);

    return {
      filtros: f,
      anterior,
      actual,
      previo,
      serie: serie.map((p) => ({ ...p, periodo: iso(p.periodo) })),
      porSucursal: porSucursal.map((p) => ({ ...p, periodo: iso(p.periodo) })),
      horarios,
      frecuencia: CUBETAS_FRECUENCIA.map((cubeta) => ({
        cubeta,
        clientes: porCubeta.get(cubeta) ?? 0,
      })),
      sucursales,
    };
  });
}
