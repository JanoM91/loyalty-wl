import type { UsoDelClub } from '@wl/domain';

import { clienteDuenio } from './plataforma';

/**
 * Uso de los clubes para el panel de plataforma: visitas, tarjetas nuevas y
 * último acceso del dueño, de todos los clubes en una sola consulta.
 *
 * Corre con el rol dueño (sin RLS) porque cruza negocios, y devuelve solo
 * conteos y fechas: ningún dato de clientes.
 */

export interface UsoDeClub extends UsoDelClub {
  readonly clubId: string;
  readonly tarjetas30: number;
  readonly premios30: number;
}

interface FilaUso {
  id: string;
  creado: Date;
  tarjetas: bigint;
  tarjetas30: bigint;
  ultima_tarjeta: Date | null;
  visitas7: bigint;
  visitas7_previas: bigint;
  visitas30: bigint;
  ultima_visita: Date | null;
  premios30: bigint;
  ultimo_acceso: Date | null;
  con_contrasena: boolean | null;
}

/** Uso de cada club (todos, o los de `ids`), indexado por su id. */
export async function usoDeClubes(ids?: readonly string[]): Promise<Map<string, UsoDeClub>> {
  const filtro = ids && ids.length > 0 ? [...ids] : null;
  if (ids && ids.length === 0) return new Map();
  const filas = await clienteDuenio().$queryRaw<FilaUso[]>`
    SELECT t.id,
           t.created_at AS creado,
           COALESCE(c.tarjetas, 0)::bigint AS tarjetas,
           COALESCE(c.tarjetas30, 0)::bigint AS tarjetas30,
           c.ultima AS ultima_tarjeta,
           COALESCE(v.visitas7, 0)::bigint AS visitas7,
           COALESCE(v.visitas7_previas, 0)::bigint AS visitas7_previas,
           COALESCE(v.visitas30, 0)::bigint AS visitas30,
           v.ultima AS ultima_visita,
           COALESCE(r.premios30, 0)::bigint AS premios30,
           u.ultimo AS ultimo_acceso,
           u.con_contrasena
    FROM tenant t
    LEFT JOIN (
      SELECT tenant_id,
             COUNT(*) FILTER (WHERE is_active) AS tarjetas,
             COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS tarjetas30,
             MAX(created_at) AS ultima
      FROM loyalty_card GROUP BY tenant_id
    ) c ON c.tenant_id = t.id
    LEFT JOIN (
      SELECT tenant_id,
             COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS visitas7,
             COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days'
                                AND created_at < now() - interval '7 days') AS visitas7_previas,
             COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS visitas30,
             MAX(created_at) AS ultima
      FROM loyalty_accrual WHERE status = 'ACREDITADA' GROUP BY tenant_id
    ) v ON v.tenant_id = t.id
    LEFT JOIN (
      SELECT tenant_id, COUNT(*) AS premios30
      FROM loyalty_reward
      WHERE status = 'ENTREGADO' AND redeemed_at >= now() - interval '30 days'
      GROUP BY tenant_id
    ) r ON r.tenant_id = t.id
    LEFT JOIN (
      SELECT tenant_id,
             MAX(last_login_at) AS ultimo,
             BOOL_OR(password_hash IS NOT NULL) AS con_contrasena
      FROM user_account
      WHERE is_active AND role IN ('ADMIN', 'DUENO', 'GERENTE')
      GROUP BY tenant_id
    ) u ON u.tenant_id = t.id
    WHERE ${filtro}::uuid[] IS NULL OR t.id = ANY(${filtro}::uuid[])`;
  return new Map(
    filas.map((f) => [
      f.id,
      {
        clubId: f.id,
        creado: f.creado,
        tarjetas: Number(f.tarjetas),
        tarjetas30: Number(f.tarjetas30),
        ultimaTarjeta: f.ultima_tarjeta,
        visitas7: Number(f.visitas7),
        visitas7Previas: Number(f.visitas7_previas),
        visitas30: Number(f.visitas30),
        ultimaVisita: f.ultima_visita,
        premios30: Number(f.premios30),
        ultimoAcceso: f.ultimo_acceso,
        duenioConContrasena: Boolean(f.con_contrasena),
      },
    ]),
  );
}
