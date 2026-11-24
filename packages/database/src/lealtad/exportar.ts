import { prisma, transaccion } from '../index';

/**
 * Descargas del panel del dueño (clientes y visitas, para Excel). Corren
 * dentro del negocio en contexto: RLS deja ver solo sus filas, también en el
 * SQL directo. Cada descarga queda en la bitácora del negocio, porque lleva
 * datos personales de sus clientes.
 */

/** Tope de renglones por archivo: más que eso, mejor pedírnoslo. */
export const RENGLONES_MAXIMOS_EXPORTAR = 50_000;

export interface ClienteParaExportar {
  readonly codigo: string;
  readonly nombre: string | null;
  readonly celular: string | null;
  readonly correo: string | null;
  readonly celularVerificado: boolean;
  readonly correoVerificado: boolean;
  /** Aceptó promociones y no se dio de baja. */
  readonly promociones: boolean;
  readonly sellos: number;
  readonly vuelta: number;
  readonly visitas: number;
  readonly ultimaVisita: Date | null;
  readonly premiosDisponibles: number;
  readonly premiosEntregados: number;
  readonly cumpleanos: string | null;
  readonly sucursalDeAlta: string | null;
  readonly alta: Date;
}

interface FilaCliente {
  public_code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  phone_verified_at: Date | null;
  email_verified_at: Date | null;
  marketing_opt_in: boolean;
  campaign_opt_out_at: Date | null;
  stamps: number;
  cycle: number;
  birth_day: number | null;
  birth_month: number | null;
  created_at: Date;
  sucursal: string | null;
  visitas: bigint;
  ultima: Date | null;
  disponibles: bigint;
  entregados: bigint;
}

/** Las tarjetas activas del club, de la más antigua a la más nueva. */
export async function clientesParaExportar(): Promise<ClienteParaExportar[]> {
  const filas = await transaccion(
    (tx) => tx.$queryRaw<FilaCliente[]>`
      SELECT c.public_code, c.name, c.phone, c.email, c.phone_verified_at, c.email_verified_at,
             c.marketing_opt_in, c.campaign_opt_out_at, c.stamps, c.cycle,
             c.birth_day, c.birth_month, c.created_at, b.name AS sucursal,
             COALESCE(v.visitas, 0)::bigint AS visitas, v.ultima,
             COALESCE(r.disponibles, 0)::bigint AS disponibles,
             COALESCE(r.entregados, 0)::bigint AS entregados
      FROM loyalty_card c
      LEFT JOIN branch b ON b.id = c.enrolled_branch_id
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS visitas, MAX(created_at) AS ultima
        FROM loyalty_accrual WHERE status = 'ACREDITADA' GROUP BY card_id
      ) v ON v.card_id = c.id
      LEFT JOIN (
        SELECT card_id,
               COUNT(*) FILTER (WHERE status = 'DISPONIBLE') AS disponibles,
               COUNT(*) FILTER (WHERE status = 'ENTREGADO') AS entregados
        FROM loyalty_reward GROUP BY card_id
      ) r ON r.card_id = c.id
      WHERE c.is_active
      ORDER BY c.created_at
      LIMIT ${RENGLONES_MAXIMOS_EXPORTAR}`,
  );
  return filas.map((f) => ({
    codigo: f.public_code,
    nombre: f.name,
    celular: f.phone,
    correo: f.email,
    celularVerificado: f.phone_verified_at !== null,
    correoVerificado: f.email_verified_at !== null,
    promociones: f.marketing_opt_in && f.campaign_opt_out_at === null,
    sellos: f.stamps,
    vuelta: f.cycle,
    visitas: Number(f.visitas),
    ultimaVisita: f.ultima,
    premiosDisponibles: Number(f.disponibles),
    premiosEntregados: Number(f.entregados),
    cumpleanos:
      f.birth_day && f.birth_month
        ? `${String(f.birth_day).padStart(2, '0')}/${String(f.birth_month).padStart(2, '0')}`
        : null,
    sucursalDeAlta: f.sucursal,
    alta: f.created_at,
  }));
}

export interface VisitaParaExportar {
  readonly fechaCompra: string;
  readonly registrada: Date;
  readonly sucursal: string;
  readonly codigo: string;
  readonly cliente: string | null;
  readonly estado: string;
  readonly folio: string;
  readonly sellos: number;
  readonly totalCentavos: number;
  readonly origen: string;
  readonly registro: string | null;
}

interface FilaVisita {
  purchase_date: Date;
  created_at: Date;
  sucursal: string;
  public_code: string;
  name: string | null;
  status: string;
  ticket_folio: string;
  stamps_awarded: number;
  total_cents: number;
  capture_source: string;
  registro: string | null;
}

/**
 * Visitas registradas en los últimos `dias` días (todas si es null), la más
 * reciente primero. Del cliente solo van su código y su nombre.
 */
export async function visitasParaExportar(
  dias: number | null,
  ahora: Date = new Date(),
): Promise<VisitaParaExportar[]> {
  const desde = dias ? new Date(ahora.getTime() - dias * 86_400_000) : new Date(0);
  const filas = await transaccion(
    (tx) => tx.$queryRaw<FilaVisita[]>`
      SELECT a.purchase_date, a.created_at, b.name AS sucursal, c.public_code, c.name,
             a.status, a.ticket_folio, a.stamps_awarded, a.total_cents, a.capture_source,
             u.name AS registro
      FROM loyalty_accrual a
      JOIN loyalty_card c ON c.id = a.card_id
      JOIN branch b ON b.id = a.branch_id
      LEFT JOIN user_account u ON u.id = a.created_by_id
      WHERE a.created_at >= ${desde}
      ORDER BY a.created_at DESC
      LIMIT ${RENGLONES_MAXIMOS_EXPORTAR}`,
  );
  return filas.map((f) => ({
    fechaCompra: f.purchase_date.toISOString().slice(0, 10),
    registrada: f.created_at,
    sucursal: f.sucursal,
    codigo: f.public_code,
    cliente: f.name,
    estado: f.status,
    folio: f.ticket_folio,
    sellos: f.stamps_awarded,
    totalCentavos: f.total_cents,
    origen: f.capture_source,
    registro: f.registro,
  }));
}

/** Anota la descarga en la bitácora del negocio. */
export async function anotarDescarga(
  userId: string,
  que: 'clientes' | 'visitas',
  renglones: number,
  ip: string | null,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action: `lealtad.exportar_${que}`,
      entityType: que === 'clientes' ? 'loyalty_card' : 'loyalty_accrual',
      metadata: { renglones },
      ipAddress: ip,
    },
  });
}
