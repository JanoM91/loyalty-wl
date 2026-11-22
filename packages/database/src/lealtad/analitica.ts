import { prisma, negocioActual } from '../index';

/**
 * Analítica del programa de lealtad para Administración, Dueño y Gerencia.
 *
 * Son las consultas del tablero de lealtad del sistema de referencia
 * (oct-2026), en SQL directo para que cada número se pueda reproducir en la
 * base tal cual. Todo cuenta solo compras identificadas con tarjeta: no son
 * las ventas totales del negocio.
 *
 * Convenciones:
 * - «Visita»: acreditación ACREDITADA que no sea migración de tarjeta física,
 *   agrupada por la fecha del ticket.
 * - «Hoy» y los días son los de la zona horaria del negocio.
 * - «7 días» = hoy y los 6 anteriores; se compara con los 7 previos.
 * - «Con comprobante»: foto del ticket o folio real (los `SF-…` los pone el
 *   sistema cuando no se capturó).
 * - Apple Wallet cuenta dispositivos registrados (`wallet_registration`);
 *   Google Wallet, pases pedidos (`google_wallet_object_at`).
 */

export interface ResumenAnalitica {
  readonly hoy: string;
  readonly tarjetas: number;
  readonly tarjetas7d: number;
  readonly tarjetas7dPrev: number;
  readonly visitas: number;
  readonly visitas7d: number;
  readonly visitas7dPrev: number;
  readonly clientes7d: number;
  readonly recurrentes: number;
  readonly conVisitas: number;
  readonly verificadas: number;
  readonly optIn: number;
  readonly appleWallet: number;
  readonly googleWallet: number;
  readonly premiosGenerados: number;
  readonly premiosEntregados: number;
  readonly premiosDisponibles: number;
  readonly pendientesRevision: number;
  readonly visitasConComprobante: number;
  readonly estampasEnCirculacion: number;
  readonly tarjetasCercaPremio: number;
}

export interface DiaAnalitica {
  readonly dia: string;
  readonly visitas: number;
  readonly clientes: number;
  readonly altas: number;
}

export interface PasoVerificacion {
  readonly paso: string;
  readonly orden: number;
  readonly n: number;
}

export interface SucursalAnalitica {
  readonly sucursal: string;
  readonly estado: 'Participa' | 'No participa';
  readonly visitas7d: number;
  readonly visitas: number;
  readonly clientes: number;
  readonly altas: number;
  readonly conComprobante: number;
  readonly premiosEntregados: number;
  readonly pendientes: number;
}

export interface CategoriaCaptura {
  readonly grupo: 'comprobante' | 'origen';
  readonly categoria: string;
  readonly orden: number;
  readonly n: number;
}

export interface PremioAnalitica {
  readonly premio: string;
  readonly estampas: number;
  readonly generados: number;
  readonly entregados: number;
  readonly disponibles: number;
}

export interface AnaliticaLealtad {
  readonly resumen: ResumenAnalitica;
  /** Un renglón por día, del más viejo al más reciente (hoy al final). */
  readonly porDia: readonly DiaAnalitica[];
  readonly verificacion: readonly PasoVerificacion[];
  /** Tarjetas por número de estampas en el ciclo, de 0 a posiciones − 1. */
  readonly estampas: readonly { readonly estampas: number; readonly tarjetas: number }[];
  readonly porSucursal: readonly SucursalAnalitica[];
  readonly captura: readonly CategoriaCaptura[];
  readonly premios: readonly PremioAnalitica[];
}

interface FilaResumen {
  hoy: string;
  tarjetas: number;
  tarjetas_7d: number;
  tarjetas_7d_prev: number;
  visitas: number;
  visitas_7d: number;
  visitas_7d_prev: number;
  clientes_7d: number;
  recurrentes: number;
  con_visitas: number;
  verificadas: number;
  opt_in: number;
  apple_wallet: number;
  google_wallet: number;
  premios_generados: number;
  premios_entregados: number;
  premios_disponibles: number;
  pendientes_revision: number;
  visitas_con_comprobante: number;
  estampas_en_circulacion: number;
  tarjetas_cerca_premio: number;
}

/** Días de la serie diaria. */
export const DIAS_ANALITICA = 28;

export async function analiticaLealtad(dias = DIAS_ANALITICA): Promise<AnaliticaLealtad> {
  const zona = (await negocioActual()).zonaHoraria;
  const [resumen, porDia, verificacion, estampas, porSucursal, captura, premios] =
    await Promise.all([
      prisma.$queryRaw<FilaResumen[]>`
        WITH hoy AS (SELECT (now() AT TIME ZONE ${zona}::text)::date AS d),
        c AS (SELECT lc.id, lc.stamps, lc.email, lc.email_verified_at, lc.phone, lc.phone_verified_at, lc.marketing_opt_in, lc.google_wallet_object_at, lc.created_at, (lc.created_at AT TIME ZONE ${zona}::text)::date AS alta
              FROM loyalty_card lc WHERE lc.is_active),
        a AS (SELECT card_id, branch_id, purchase_date, photo_url, ticket_folio, note, capture_source FROM loyalty_accrual WHERE status = 'ACREDITADA' AND capture_source <> 'MIGRACION'),
        vt AS (SELECT card_id, count(*) AS n FROM a GROUP BY card_id)
        SELECT
          to_char((SELECT d FROM hoy), 'YYYY-MM-DD') AS hoy,
          (SELECT count(*) FROM c)::int AS tarjetas,
          (SELECT count(*) FROM c, hoy WHERE alta > hoy.d - 7)::int AS tarjetas_7d,
          (SELECT count(*) FROM c, hoy WHERE alta > hoy.d - 14 AND alta <= hoy.d - 7)::int AS tarjetas_7d_prev,
          (SELECT count(*) FROM a)::int AS visitas,
          (SELECT count(*) FROM a, hoy WHERE purchase_date > hoy.d - 7)::int AS visitas_7d,
          (SELECT count(*) FROM a, hoy WHERE purchase_date > hoy.d - 14 AND purchase_date <= hoy.d - 7)::int AS visitas_7d_prev,
          (SELECT count(DISTINCT card_id) FROM a, hoy WHERE purchase_date > hoy.d - 7)::int AS clientes_7d,
          (SELECT count(*) FROM vt WHERE n >= 2)::int AS recurrentes,
          (SELECT count(*) FROM vt)::int AS con_visitas,
          (SELECT count(*) FROM c WHERE email_verified_at IS NOT NULL OR phone_verified_at IS NOT NULL)::int AS verificadas,
          (SELECT count(*) FROM c WHERE marketing_opt_in)::int AS opt_in,
          (SELECT count(DISTINCT card_id) FROM wallet_registration)::int AS apple_wallet,
          (SELECT count(*) FROM c WHERE google_wallet_object_at IS NOT NULL)::int AS google_wallet,
          (SELECT count(*) FROM loyalty_reward)::int AS premios_generados,
          (SELECT count(*) FROM loyalty_reward WHERE redeemed_at IS NOT NULL)::int AS premios_entregados,
          (SELECT count(*) FROM loyalty_reward WHERE redeemed_at IS NULL)::int AS premios_disponibles,
          (SELECT count(*) FROM loyalty_accrual WHERE status = 'PENDIENTE')::int AS pendientes_revision,
          (SELECT count(*) FROM a WHERE photo_url IS NOT NULL OR ticket_folio NOT LIKE 'SF-%')::int AS visitas_con_comprobante,
          (SELECT coalesce(sum(stamps), 0) FROM c)::int AS estampas_en_circulacion,
          (SELECT count(*) FROM c WHERE stamps IN (4, 9))::int AS tarjetas_cerca_premio`,
      prisma.$queryRaw<DiaAnalitica[]>`
        WITH hoy AS (SELECT (now() AT TIME ZONE ${zona}::text)::date AS d),
        dias AS (SELECT (hoy.d - g)::date AS dia FROM hoy, generate_series((${dias}::int) - 1, 0, -1) AS g),
        c AS (SELECT (created_at AT TIME ZONE ${zona}::text)::date AS alta FROM loyalty_card WHERE is_active),
        a AS (SELECT purchase_date, card_id FROM loyalty_accrual WHERE status = 'ACREDITADA' AND capture_source <> 'MIGRACION')
        SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
          (SELECT count(*) FROM a WHERE a.purchase_date = d.dia)::int AS visitas,
          (SELECT count(DISTINCT card_id) FROM a WHERE a.purchase_date = d.dia)::int AS clientes,
          (SELECT count(*) FROM c WHERE c.alta = d.dia)::int AS altas
        FROM dias d ORDER BY d.dia`,
      prisma.$queryRaw<PasoVerificacion[]>`
        WITH c AS (SELECT id, stamps, email, email_verified_at, phone, phone_verified_at FROM loyalty_card WHERE is_active)
        SELECT paso, orden, n::int AS n FROM (VALUES
          ('Tarjetas activas', 1, (SELECT count(*) FROM c)),
          ('Con correo', 2, (SELECT count(*) FROM c WHERE email IS NOT NULL)),
          ('Correo verificado', 3, (SELECT count(*) FROM c WHERE email_verified_at IS NOT NULL)),
          ('Solo celular', 4, (SELECT count(*) FROM c WHERE email IS NULL AND phone IS NOT NULL)),
          ('Con correo sin verificar', 5, (SELECT count(*) FROM c WHERE email IS NOT NULL AND email_verified_at IS NULL)),
          ('Verificadas (correo o celular)', 6, (SELECT count(*) FROM c WHERE email_verified_at IS NOT NULL OR phone_verified_at IS NOT NULL))
        ) AS v(paso, orden, n) ORDER BY orden`,
      prisma.$queryRaw<{ estampas: number; tarjetas: number }[]>`
        WITH p AS (SELECT positions FROM loyalty_program WHERE is_active ORDER BY activated_at DESC NULLS LAST LIMIT 1),
        pos AS (SELECT g AS estampas FROM p, generate_series(0, p.positions - 1) AS g)
        SELECT pos.estampas::int AS estampas,
          (SELECT count(*) FROM loyalty_card c WHERE c.is_active AND c.stamps = pos.estampas)::int AS tarjetas
        FROM pos ORDER BY 1`,
      prisma.$queryRaw<SucursalAnalitica[]>`
        WITH hoy AS (SELECT (now() AT TIME ZONE ${zona}::text)::date AS d),
        a AS (SELECT card_id, branch_id, purchase_date, photo_url, ticket_folio, note, capture_source FROM loyalty_accrual WHERE status = 'ACREDITADA' AND capture_source <> 'MIGRACION')
        SELECT b.name AS sucursal,
          CASE WHEN b.loyalty_enabled AND b.is_active THEN 'Participa' ELSE 'No participa' END AS estado,
          (SELECT count(*) FROM a, hoy WHERE a.branch_id = b.id AND a.purchase_date > hoy.d - 7)::int AS "visitas7d",
          (SELECT count(*) FROM a WHERE a.branch_id = b.id)::int AS visitas,
          (SELECT count(DISTINCT card_id) FROM a WHERE a.branch_id = b.id)::int AS clientes,
          (SELECT count(*) FROM loyalty_card c WHERE c.is_active AND c.enrolled_branch_id = b.id)::int AS altas,
          (SELECT count(*) FROM a WHERE a.branch_id = b.id AND (a.photo_url IS NOT NULL OR a.ticket_folio NOT LIKE 'SF-%'))::int AS "conComprobante",
          (SELECT count(*) FROM loyalty_reward r WHERE r.redeemed_branch_id = b.id)::int AS "premiosEntregados",
          (SELECT count(*) FROM loyalty_accrual x WHERE x.branch_id = b.id AND x.status = 'PENDIENTE')::int AS pendientes
        FROM branch b WHERE b.is_active ORDER BY visitas DESC, b.name`,
      prisma.$queryRaw<CategoriaCaptura[]>`
        WITH a AS (SELECT card_id, branch_id, purchase_date, photo_url, ticket_folio, note, capture_source FROM loyalty_accrual WHERE status = 'ACREDITADA' AND capture_source <> 'MIGRACION')
        SELECT grupo, categoria, orden, n FROM (
          SELECT 'comprobante' AS grupo, 'Folio y foto' AS categoria, 1 AS orden, count(*)::int AS n FROM a WHERE photo_url IS NOT NULL AND ticket_folio NOT LIKE 'SF-%'
          UNION ALL SELECT 'comprobante', 'Solo folio', 2, count(*)::int FROM a WHERE photo_url IS NULL AND ticket_folio NOT LIKE 'SF-%'
          UNION ALL SELECT 'comprobante', 'Solo foto', 3, count(*)::int FROM a WHERE photo_url IS NOT NULL AND ticket_folio LIKE 'SF-%'
          UNION ALL SELECT 'comprobante', 'Sin comprobante', 4, count(*)::int FROM a WHERE photo_url IS NULL AND ticket_folio LIKE 'SF-%'
          UNION ALL SELECT 'origen', 'Con QR en caja', 1, count(*)::int FROM a WHERE (note IS NULL OR (note NOT LIKE 'Sin tarjeta:%' AND note NOT LIKE 'Alta en caja%')) AND capture_source = 'MANUAL'
          UNION ALL SELECT 'origen', 'Sin tarjeta (por contacto)', 2, count(*)::int FROM a WHERE note LIKE 'Sin tarjeta:%'
          UNION ALL SELECT 'origen', 'Alta en caja', 3, count(*)::int FROM a WHERE note LIKE 'Alta en caja%'
          UNION ALL SELECT 'origen', 'Lectura con IA', 4, count(*)::int FROM a WHERE capture_source = 'IA'
        ) t ORDER BY grupo, orden`,
      prisma.$queryRaw<PremioAnalitica[]>`
        SELECT coalesce(r.title, r.kind) AS premio, r.milestone::int AS estampas,
          count(*)::int AS generados,
          count(*) FILTER (WHERE r.redeemed_at IS NOT NULL)::int AS entregados,
          count(*) FILTER (WHERE r.redeemed_at IS NULL)::int AS disponibles
        FROM loyalty_reward r GROUP BY 1, 2 ORDER BY 2`,
    ]);

  const r = resumen[0];
  if (!r) throw new Error('La analítica de lealtad no devolvió el resumen.');

  return {
    resumen: {
      hoy: r.hoy,
      tarjetas: r.tarjetas,
      tarjetas7d: r.tarjetas_7d,
      tarjetas7dPrev: r.tarjetas_7d_prev,
      visitas: r.visitas,
      visitas7d: r.visitas_7d,
      visitas7dPrev: r.visitas_7d_prev,
      clientes7d: r.clientes_7d,
      recurrentes: r.recurrentes,
      conVisitas: r.con_visitas,
      verificadas: r.verificadas,
      optIn: r.opt_in,
      appleWallet: r.apple_wallet,
      googleWallet: r.google_wallet,
      premiosGenerados: r.premios_generados,
      premiosEntregados: r.premios_entregados,
      premiosDisponibles: r.premios_disponibles,
      pendientesRevision: r.pendientes_revision,
      visitasConComprobante: r.visitas_con_comprobante,
      estampasEnCirculacion: r.estampas_en_circulacion,
      tarjetasCercaPremio: r.tarjetas_cerca_premio,
    },
    porDia,
    verificacion,
    estampas,
    porSucursal,
    captura,
    premios,
  };
}
