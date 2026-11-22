import {
  cumpleanosDelDia,
  fechaLocal,
  periodoDeRegalo,
  ventanaRegreso,
  vigenciaDeRegalo,
  type AjustesRegalos,
  type TipoRegalo,
} from '@wl/domain';

import { esErrorUnico, prisma } from './index';
import { negocioActual } from './negocio';
import { mezclarAjustes } from './plataforma';

/**
 * Regalos automáticos del club: «Te extrañamos» y cumpleaños. Las reglas de
 * cuándo toca cada uno viven en `@wl/domain` (`loyalty/regalos.ts`); aquí se
 * buscan las tarjetas, se dan los regalos y se entregan en caja.
 */

/** Guarda lo que eligió el dueño. */
export async function guardarRegalos(negocioId: string, regalos: AjustesRegalos): Promise<void> {
  await mezclarAjustes(negocioId, { regalos });
}

export interface CandidatoRegalo {
  readonly cardId: string;
  readonly correo: string | null;
  readonly nombre: string | null;
  /** Puede recibir el correo: aceptó promociones, correo verificado y entregable, sin baja. */
  readonly avisable: boolean;
}

/**
 * Tarjetas a las que hoy les toca «Te extrañamos»: pueden recibir promociones,
 * su última visita (o su alta, si nunca sumó una) fue hace `dias` días o más
 * y menos de 180, y no han recibido otro desde entonces ni en los últimos 90
 * días. Las más recientes primero: son las que más fácil regresan.
 */
export async function candidatosRegreso(
  dias: number,
  limite: number,
  ahora: Date = new Date(),
): Promise<CandidatoRegalo[]> {
  if (limite <= 0) return [];
  const zona = (await negocioActual()).zonaHoraria;
  const v = ventanaRegreso(fechaLocal(ahora, zona), dias, zona);
  const filas = await prisma.$queryRaw<{ id: string; email: string; name: string | null }[]>`
    WITH u AS (
      SELECT c.id, c.email, c.name, coalesce(
        (SELECT max(a.created_at) FROM loyalty_accrual a
          WHERE a.card_id = c.id AND a.status <> 'RECHAZADA'),
        c.created_at) AS ultima
      FROM loyalty_card c
      WHERE c.is_active AND c.marketing_opt_in AND c.email IS NOT NULL
        AND c.email_verified_at IS NOT NULL AND c.campaign_opt_out_at IS NULL
        AND c.email_undeliverable_at IS NULL
    )
    SELECT u.id, u.email, u.name FROM u
    WHERE u.ultima < ${v.antesDe} AND u.ultima > ${v.despuesDe}
      AND NOT EXISTS (
        SELECT 1 FROM club_gift g
        WHERE g.card_id = u.id AND g.kind = 'REGRESO'
          AND (g.created_at > u.ultima OR g.created_at >= ${v.sinRegaloDesde})
      )
    ORDER BY u.ultima DESC
    LIMIT ${limite}`;
  return filas.map((f) => ({ cardId: f.id, correo: f.email, nombre: f.name, avisable: true }));
}

/**
 * Tarjetas que cumplen años hoy (en la zona del club) y todavía no tienen su
 * regalo de este año. Todas reciben el regalo; solo a las avisables les llega
 * el correo.
 */
export async function candidatosCumple(
  limite: number,
  ahora: Date = new Date(),
): Promise<CandidatoRegalo[]> {
  const zona = (await negocioActual()).zonaHoraria;
  const hoy = fechaLocal(ahora, zona);
  const filas = await prisma.loyaltyCard.findMany({
    where: {
      isActive: true,
      OR: cumpleanosDelDia(hoy).map((d) => ({ birthDay: d.dia, birthMonth: d.mes })),
      gifts: { none: { kind: 'CUMPLE', period: periodoDeRegalo('CUMPLE', hoy) } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      marketingOptIn: true,
      emailVerifiedAt: true,
      campaignOptOutAt: true,
      emailUndeliverableAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: Math.max(0, limite),
  });
  return filas.map((f) => ({
    cardId: f.id,
    correo: f.email,
    nombre: f.name,
    avisable: Boolean(
      f.email &&
      f.marketingOptIn &&
      f.emailVerifiedAt &&
      !f.campaignOptOutAt &&
      !f.emailUndeliverableAt,
    ),
  }));
}

export interface RegaloDado {
  readonly id: string;
  readonly vence: Date;
  /** Último día válido, "AAAA-MM-DD" en la zona del club. */
  readonly ultimoDia: string;
}

/** Da un regalo a la tarjeta. Null si ya tenía el de este periodo. */
export async function darRegalo(
  r: {
    readonly cardId: string;
    readonly tipo: TipoRegalo;
    readonly titulo: string;
    readonly vigencia: number;
  },
  ahora: Date = new Date(),
): Promise<RegaloDado | null> {
  const zona = (await negocioActual()).zonaHoraria;
  const hoy = fechaLocal(ahora, zona);
  const { vence, ultimoDia } = vigenciaDeRegalo(hoy, r.vigencia, zona);
  const periodo = periodoDeRegalo(r.tipo, hoy);
  const ya = await prisma.clubGift.findUnique({
    where: { cardId_kind_period: { cardId: r.cardId, kind: r.tipo, period: periodo } },
    select: { id: true },
  });
  if (ya) return null;
  try {
    const g = await prisma.clubGift.create({
      data: {
        cardId: r.cardId,
        kind: r.tipo,
        period: periodo,
        title: r.titulo.slice(0, 80),
        expiresAt: vence,
      },
      select: { id: true },
    });
    return { id: g.id, vence, ultimoDia };
  } catch (e) {
    if (esErrorUnico(e)) return null;
    throw e;
  }
}

/** Anota que salió el correo de estos regalos. */
export async function marcarRegalosAvisados(ids: readonly string[], cuando = new Date()) {
  if (ids.length === 0) return;
  await prisma.clubGift.updateMany({
    where: { id: { in: [...ids] } },
    data: { emailedAt: cuando },
  });
}

/**
 * Quita regalos recién dados que no se pudieron avisar (falló el envío): sin
 * el correo, un «Te extrañamos» no sirve; así se reintenta al día siguiente.
 */
export async function quitarRegalos(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.clubGift.deleteMany({
    where: { id: { in: [...ids] }, status: 'DISPONIBLE', emailedAt: null },
  });
}

/** Correos de regalos que salieron desde `desde`: cuentan para el tope de mensajes. */
export function correosDeRegalosDesde(desde: Date): Promise<number> {
  return prisma.clubGift.count({ where: { emailedAt: { gte: desde } } });
}

export interface RegaloTarjeta {
  readonly id: string;
  readonly tipo: TipoRegalo;
  readonly titulo: string;
  readonly dado: Date;
  readonly vence: Date;
  /** Último día válido, "AAAA-MM-DD" en la zona del club. */
  readonly ultimoDia: string;
}

/** Regalos de la tarjeta que todavía se pueden cobrar (sin entregar y sin vencer). */
export async function regalosDeTarjeta(
  cardId: string,
  ahora: Date = new Date(),
): Promise<RegaloTarjeta[]> {
  const zona = (await negocioActual()).zonaHoraria;
  const filas = await prisma.clubGift.findMany({
    where: { cardId, status: 'DISPONIBLE', expiresAt: { gt: ahora } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, kind: true, title: true, createdAt: true, expiresAt: true },
  });
  return filas.map((f) => ({
    id: f.id,
    tipo: f.kind === 'CUMPLE' ? 'CUMPLE' : 'REGRESO',
    titulo: f.title,
    dado: f.createdAt,
    vence: f.expiresAt,
    ultimoDia: fechaLocal(new Date(f.expiresAt.getTime() - 1), zona),
  }));
}

/** Nombre del regalo para la caja y la tarjeta: «Regalo de cumpleaños: un café». */
export function nombreDeRegalo(tipo: TipoRegalo, titulo: string): string {
  return `${tipo === 'CUMPLE' ? 'Regalo de cumpleaños' : 'Te extrañamos'}: ${titulo}`;
}

/**
 * Entrega un regalo en caja. Mismas reglas que un premio: tiene que ser de la
 * tarjeta escaneada, la tarjeta debe estar verificada y la entrega es única.
 * Además no debe estar vencido.
 */
export async function entregarRegalo(
  s: {
    readonly regaloId: string;
    readonly codigo: string;
    readonly sucursalId: string;
    readonly usuarioId: string;
  },
  ahora: Date = new Date(),
): Promise<
  | { readonly ok: true; readonly tipo: string; readonly nombre: string }
  | { readonly ok: false; readonly error: string }
> {
  const zona = (await negocioActual()).zonaHoraria;
  const regalo = await prisma.clubGift.findUnique({
    where: { id: s.regaloId },
    include: {
      card: { select: { publicCode: true, emailVerifiedAt: true, phoneVerifiedAt: true } },
      redeemedBranch: { select: { name: true } },
    },
  });
  if (!regalo || regalo.card.publicCode !== s.codigo) {
    return { ok: false, error: 'Ese regalo no pertenece a esta tarjeta.' };
  }
  const dia = (d: Date) => fechaLocal(d, zona);
  if (regalo.status !== 'DISPONIBLE') {
    return {
      ok: false,
      error: `Este regalo ya se entregó${regalo.redeemedAt ? ` el ${dia(regalo.redeemedAt)}` : ''}${regalo.redeemedBranch ? ` en ${regalo.redeemedBranch.name}` : ''}. La entrega es única.`,
    };
  }
  if (regalo.expiresAt <= ahora) {
    return {
      ok: false,
      error: `Este regalo venció el ${dia(new Date(regalo.expiresAt.getTime() - 1))}.`,
    };
  }
  if (!regalo.card.emailVerifiedAt && !regalo.card.phoneVerifiedAt) {
    return {
      ok: false,
      error:
        'Para canjear, el cliente debe verificar su correo desde su tarjeta, o su celular abriendo el enlace que le manden por WhatsApp desde la caja. El regalo se conserva.',
    };
  }
  const sucursal = await prisma.branch.findUnique({
    where: { id: s.sucursalId },
    select: { isActive: true, loyaltyEnabled: true },
  });
  if (!sucursal?.isActive || !sucursal.loyaltyEnabled) {
    return { ok: false, error: 'Esta sucursal todavía no entrega premios del programa.' };
  }

  // Igual que con los premios: la condición dentro del update garantiza la
  // entrega única aunque dos cajas lo intenten a la vez.
  const cambio = await prisma.clubGift.updateMany({
    where: { id: s.regaloId, status: 'DISPONIBLE', expiresAt: { gt: ahora } },
    data: {
      status: 'ENTREGADO',
      redeemedAt: ahora,
      redeemedBranchId: s.sucursalId,
      redeemedById: s.usuarioId,
    },
  });
  if (cambio.count === 0) {
    return { ok: false, error: 'Este regalo se acaba de entregar en otra caja.' };
  }
  await prisma.auditLog.create({
    data: {
      userId: s.usuarioId,
      action: 'regalos.entregar',
      entityType: 'club_gift',
      entityId: s.regaloId,
      metadata: { codigo: s.codigo, tipo: regalo.kind },
    },
  });
  const tipo: TipoRegalo = regalo.kind === 'CUMPLE' ? 'CUMPLE' : 'REGRESO';
  return { ok: true, tipo: `REGALO_${tipo}`, nombre: nombreDeRegalo(tipo, regalo.title) };
}

export interface CifrasRegalo {
  /** Regalos dados en el periodo. */
  readonly dados: number;
  /** A cuántos les llegó el correo. */
  readonly avisados: number;
  readonly entregados: number;
  /** Tarjetas que volvieron a sumar una visita después de recibir el regalo. */
  readonly regresaron: number;
}

const CERO: CifrasRegalo = { dados: 0, avisados: 0, entregados: 0, regresaron: 0 };

/** Cómo van los regalos dados desde `desde`, por tipo. */
export async function cifrasDeRegalos(desde: Date): Promise<Record<TipoRegalo, CifrasRegalo>> {
  const filas = await prisma.$queryRaw<
    { kind: string; dados: number; avisados: number; entregados: number; regresaron: number }[]
  >`
    SELECT g.kind,
      count(*)::int AS dados,
      count(g.emailed_at)::int AS avisados,
      count(g.redeemed_at)::int AS entregados,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM loyalty_accrual a
        WHERE a.card_id = g.card_id AND a.status <> 'RECHAZADA' AND a.created_at > g.created_at
      ))::int AS regresaron
    FROM club_gift g
    WHERE g.created_at >= ${desde}
    GROUP BY g.kind`;
  const de = (tipo: TipoRegalo): CifrasRegalo => {
    const f = filas.find((x) => x.kind === tipo);
    return f
      ? { dados: f.dados, avisados: f.avisados, entregados: f.entregados, regresaron: f.regresaron }
      : CERO;
  };
  return { REGRESO: de('REGRESO'), CUMPLE: de('CUMPLE') };
}

/** Clientes con su cumpleaños en la tarjeta: los que pueden recibir el regalo. */
export async function cumpleanosRegistrados(): Promise<number> {
  return prisma.loyaltyCard.count({
    where: { isActive: true, birthDay: { not: null }, birthMonth: { not: null } },
  });
}
