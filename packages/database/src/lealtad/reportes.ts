import type { Prisma } from '@prisma/client';
import { enmascararContacto, fechaLocal, inicioDelDia, sumarDias } from '@wl/domain';

import { prisma, negocioActual } from '../index';
import { describirPremioGanado } from './caja';
import { programaVigente } from './programa';

/**
 * Consultas del panel de administración del programa.
 *
 * **Cobertura.** Todo lo que se cuenta aquí son compras identificadas con una
 * tarjeta. No son las ventas totales del negocio, y las pantallas lo dicen.
 */

export interface ResumenSucursal {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
  readonly participa: boolean;
  readonly desde: Date | null;
  readonly visitas: number;
  readonly clientesUnicos: number;
  readonly premiosEntregados: number;
  readonly altas: number;
}

export interface ResumenLealtad {
  readonly desde: string;
  readonly hasta: string;
  readonly tarjetas: number;
  readonly tarjetasNuevas: number;
  readonly verificadas: number;
  readonly conPromociones: number;
  readonly visitas: number;
  readonly clientesActivos: number;
  readonly premiosGenerados: number;
  readonly premiosEntregados: number;
  readonly premiosDisponibles: number;
  readonly pendientes: number;
  readonly porSucursal: readonly ResumenSucursal[];
  readonly porDia: readonly {
    readonly fecha: string;
    readonly visitas: number;
    readonly altas: number;
  }[];
}

/** Resumen de los últimos `dias` días, contando hoy. */
export async function resumenLealtad(dias = 7): Promise<ResumenLealtad> {
  const zona = (await negocioActual()).zonaHoraria;
  const hasta = fechaLocal(new Date(), zona);
  const desde = sumarDias(hasta, -(dias - 1));
  const desdeInstante = inicioDelDia(desde, zona);
  const desdeFecha = new Date(`${desde}T00:00:00.000Z`);

  const [
    tarjetas,
    tarjetasNuevas,
    verificadas,
    conPromociones,
    visitas,
    activos,
    premiosGenerados,
    premiosEntregados,
    premiosDisponibles,
    pendientes,
    sucursales,
  ] = await Promise.all([
    prisma.loyaltyCard.count({ where: { isActive: true } }),
    prisma.loyaltyCard.count({ where: { createdAt: { gte: desdeInstante } } }),
    prisma.loyaltyCard.count({
      where: {
        isActive: true,
        OR: [{ emailVerifiedAt: { not: null } }, { phoneVerifiedAt: { not: null } }],
      },
    }),
    prisma.loyaltyCard.count({ where: { isActive: true, marketingOptIn: true } }),
    prisma.loyaltyAccrual.count({
      where: { status: 'ACREDITADA', purchaseDate: { gte: desdeFecha } },
    }),
    prisma.loyaltyAccrual.groupBy({
      by: ['cardId'],
      where: { status: 'ACREDITADA', purchaseDate: { gte: desdeFecha } },
    }),
    prisma.loyaltyReward.count({ where: { createdAt: { gte: desdeInstante } } }),
    prisma.loyaltyReward.count({ where: { redeemedAt: { gte: desdeInstante } } }),
    prisma.loyaltyReward.count({ where: { status: 'DISPONIBLE' } }),
    prisma.loyaltyAccrual.count({ where: { status: 'PENDIENTE' } }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, loyaltyEnabled: true, loyaltySince: true },
    }),
  ]);

  const [visitasSucursal, unicosSucursal, entregasSucursal, altasSucursal, visitasDia, altasDia] =
    await Promise.all([
      prisma.loyaltyAccrual.groupBy({
        by: ['branchId'],
        where: { status: 'ACREDITADA', purchaseDate: { gte: desdeFecha } },
        _count: { _all: true },
      }),
      prisma.loyaltyAccrual.groupBy({
        by: ['branchId', 'cardId'],
        where: { status: 'ACREDITADA', purchaseDate: { gte: desdeFecha } },
      }),
      prisma.loyaltyReward.groupBy({
        by: ['redeemedBranchId'],
        where: { redeemedAt: { gte: desdeInstante } },
        _count: { _all: true },
      }),
      prisma.loyaltyCard.groupBy({
        by: ['enrolledBranchId'],
        where: { createdAt: { gte: desdeInstante } },
        _count: { _all: true },
      }),
      prisma.loyaltyAccrual.groupBy({
        by: ['purchaseDate'],
        where: { status: 'ACREDITADA', purchaseDate: { gte: desdeFecha } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ fecha: string; n: bigint }[]>`
        SELECT to_char(("created_at" AT TIME ZONE ${zona}::text)::date, 'YYYY-MM-DD') AS fecha,
               COUNT(*) AS n
        FROM "loyalty_card"
        WHERE "created_at" >= ${desdeInstante}
        GROUP BY 1`,
    ]);

  const unicos = new Map<string, number>();
  for (const u of unicosSucursal) unicos.set(u.branchId, (unicos.get(u.branchId) ?? 0) + 1);

  const porDia = Array.from({ length: dias }, (_, i) => {
    const fecha = sumarDias(desde, i);
    return {
      fecha,
      visitas:
        visitasDia.find((v) => v.purchaseDate.toISOString().slice(0, 10) === fecha)?._count._all ??
        0,
      altas: Number(altasDia.find((a) => a.fecha === fecha)?.n ?? 0),
    };
  });

  return {
    desde,
    hasta,
    tarjetas,
    tarjetasNuevas,
    verificadas,
    conPromociones,
    visitas,
    clientesActivos: activos.length,
    premiosGenerados,
    premiosEntregados,
    premiosDisponibles,
    pendientes,
    porSucursal: sucursales.map((s) => ({
      id: s.id,
      slug: s.slug,
      nombre: s.name,
      participa: s.loyaltyEnabled,
      desde: s.loyaltySince,
      visitas: visitasSucursal.find((v) => v.branchId === s.id)?._count._all ?? 0,
      clientesUnicos: unicos.get(s.id) ?? 0,
      premiosEntregados:
        entregasSucursal.find((e) => e.redeemedBranchId === s.id)?._count._all ?? 0,
      altas: altasSucursal.find((a) => a.enrolledBranchId === s.id)?._count._all ?? 0,
    })),
    porDia,
  };
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------

export type FiltroTarjetas = 'todas' | 'con-premio' | 'sin-verificar' | 'inactivas-21';

export interface FilaTarjeta {
  readonly codigo: string;
  readonly nombre: string | null;
  readonly contacto: string;
  readonly verificada: boolean;
  readonly estampas: number;
  readonly ciclo: number;
  readonly premiosDisponibles: number;
  readonly ultimaVisita: Date | null;
  readonly alta: Date;
  readonly sucursalAlta: string | null;
}

export async function listarTarjetas(opciones: {
  readonly busqueda?: string;
  readonly filtro?: FiltroTarjetas;
  readonly limite?: number;
}): Promise<FilaTarjeta[]> {
  const q = opciones.busqueda?.trim() ?? '';
  const where: Prisma.LoyaltyCardWhereInput = { isActive: true };

  if (q) {
    const digitos = q.replace(/\D/g, '');
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { publicCode: { contains: q.toUpperCase() } },
      { email: { contains: q.toLowerCase() } },
      ...(digitos.length >= 4 ? [{ phone: { endsWith: digitos } }] : []),
    ];
  }

  if (opciones.filtro === 'con-premio') where.rewards = { some: { status: 'DISPONIBLE' } };
  if (opciones.filtro === 'sin-verificar') {
    where.emailVerifiedAt = null;
    where.phoneVerifiedAt = null;
  }
  if (opciones.filtro === 'inactivas-21') {
    const limite = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    where.accruals = { none: { createdAt: { gte: limite } } };
  }

  const tarjetas = await prisma.loyaltyCard.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opciones.limite ?? 100,
    include: {
      enrolledBranch: { select: { name: true } },
      _count: { select: { rewards: { where: { status: 'DISPONIBLE' } } } },
      accruals: {
        where: { status: 'ACREDITADA' },
        orderBy: { purchaseDate: 'desc' },
        take: 1,
        select: { purchaseDate: true },
      },
    },
  });

  return tarjetas.map((t) => ({
    codigo: t.publicCode,
    nombre: t.name,
    contacto: enmascararContacto(t.email ?? t.phone),
    verificada: t.emailVerifiedAt !== null || t.phoneVerifiedAt !== null,
    estampas: t.stamps,
    ciclo: t.cycle,
    premiosDisponibles: t._count.rewards,
    ultimaVisita: t.accruals[0]?.purchaseDate ?? null,
    alta: t.createdAt,
    sucursalAlta: t.enrolledBranch?.name ?? null,
  }));
}

export interface DetalleTarjeta extends FilaTarjeta {
  readonly promociones: boolean;
  readonly promocionesDesde: Date | null;
  readonly terminos: string;
  readonly visitas: readonly {
    readonly fecha: Date;
    readonly sucursal: string;
    readonly folio: string;
    readonly estado: string;
    readonly estampas: number;
    readonly nota: string | null;
  }[];
  readonly premios: readonly {
    readonly tipo: string;
    readonly nombre: string;
    readonly posicion: number;
    readonly ciclo: number;
    readonly disponible: boolean;
    readonly generado: Date;
    readonly entregado: Date | null;
    readonly sucursal: string | null;
  }[];
}

export async function detalleTarjeta(codigo: string): Promise<DetalleTarjeta | null> {
  const t = await prisma.loyaltyCard.findFirst({
    where: { publicCode: codigo },
    include: {
      enrolledBranch: { select: { name: true } },
      accruals: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { branch: { select: { name: true } } },
      },
      rewards: {
        orderBy: { createdAt: 'desc' },
        include: { redeemedBranch: { select: { name: true } } },
      },
    },
  });
  if (!t) return null;
  const programa = await programaVigente();

  return {
    codigo: t.publicCode,
    nombre: t.name,
    contacto: enmascararContacto(t.email ?? t.phone),
    verificada: t.emailVerifiedAt !== null || t.phoneVerifiedAt !== null,
    estampas: t.stamps,
    ciclo: t.cycle,
    premiosDisponibles: t.rewards.filter((r) => r.status === 'DISPONIBLE').length,
    ultimaVisita: t.accruals.find((a) => a.status === 'ACREDITADA')?.purchaseDate ?? null,
    alta: t.createdAt,
    sucursalAlta: t.enrolledBranch?.name ?? null,
    promociones: t.marketingOptIn,
    promocionesDesde: t.marketingOptInAt,
    terminos: t.termsVersion,
    visitas: t.accruals.map((a) => ({
      fecha: a.purchaseDate,
      sucursal: a.branch.name,
      folio: a.ticketFolio,
      estado: a.status,
      estampas: a.stampsAwarded,
      nota: a.note,
    })),
    premios: t.rewards.map((r) => ({
      tipo: r.kind,
      nombre: describirPremioGanado(programa, r).nombre,
      posicion: r.milestone,
      ciclo: r.cycle,
      disponible: r.status === 'DISPONIBLE',
      generado: r.createdAt,
      entregado: r.redeemedAt,
      sucursal: r.redeemedBranch?.name ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pendientes e incidencias
// ---------------------------------------------------------------------------

export interface Pendiente {
  readonly id: string;
  readonly creada: Date;
  readonly fechaCompra: Date;
  readonly sucursal: string;
  readonly folio: string;
  readonly caja: string;
  readonly totalCentavos: number;
  readonly nota: string | null;
  readonly fotoUrl: string | null;
  readonly codigo: string;
  readonly nombre: string | null;
  readonly registro: string | null;
}

export async function listarPendientes(limite = 200): Promise<Pendiente[]> {
  const filas = await prisma.loyaltyAccrual.findMany({
    where: { status: 'PENDIENTE' },
    orderBy: { createdAt: 'asc' },
    take: limite,
    include: {
      branch: { select: { name: true } },
      card: { select: { publicCode: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  return filas.map((a) => ({
    id: a.id,
    creada: a.createdAt,
    fechaCompra: a.purchaseDate,
    sucursal: a.branch.name,
    folio: a.ticketFolio,
    caja: a.ticketRegister,
    totalCentavos: a.totalCents,
    nota: a.note,
    fotoUrl: a.photoUrl,
    codigo: a.card.publicCode,
    nombre: a.card.name,
    registro: a.createdBy?.name ?? null,
  }));
}

export interface EntradaBitacora {
  readonly cuando: Date;
  readonly quien: string;
  readonly accion: string;
  readonly detalle: string;
}

const ACCIONES: Record<string, string> = {
  'lealtad.acreditar': 'Visita acreditada',
  'lealtad.contingencia': 'Contingencia registrada',
  'lealtad.revision': 'Enviado a revisión central',
  'lealtad.entregar': 'Premio entregado',
  'lealtad.aprobar': 'Pendiente aprobado',
  'lealtad.rechazar': 'Pendiente rechazado',
  'lealtad.incidencia': 'Incidencia reportada',
  'lealtad.sucursal': 'Participación de sucursal',
};

/** Últimos movimientos del programa en la bitácora inmutable. */
export async function bitacoraLealtad(limite = 30): Promise<EntradaBitacora[]> {
  const filas = await prisma.auditLog.findMany({
    where: { action: { startsWith: 'lealtad.' } },
    orderBy: { createdAt: 'desc' },
    take: limite,
    include: { user: { select: { name: true } } },
  });
  return filas.map((f) => {
    const m = (f.metadata ?? {}) as Record<string, unknown>;
    const partes = [
      m.codigo,
      m.detalle,
      m.motivo,
      m.sucursal,
      m.participa === undefined ? null : m.participa ? 'participa' : 'no participa',
    ]
      .filter((x) => x !== null && x !== undefined && x !== '')
      .map(String);
    return {
      cuando: f.createdAt,
      quien: f.user?.name ?? 'Sistema',
      accion: ACCIONES[f.action] ?? f.action,
      detalle: partes.join(' · '),
    };
  });
}

/** Enciende o apaga el programa en una sucursal. Queda en la bitácora. */
export async function cambiarParticipacion(
  slug: string,
  participa: boolean,
  adminId: string,
): Promise<void> {
  const negocio = await negocioActual();
  const previa = await prisma.branch.findFirst({ where: { slug }, select: { id: true } });
  if (!previa) throw new Error(`No existe la sucursal «${slug}».`);
  const sucursal = await prisma.branch.update({
    where: { id: previa.id },
    data: {
      loyaltyEnabled: participa,
      ...(participa
        ? { loyaltySince: new Date(`${fechaLocal(new Date(), negocio.zonaHoraria)}T00:00:00.000Z`) }
        : {}),
    },
    select: { id: true, name: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'lealtad.sucursal',
      entityType: 'branch',
      entityId: sucursal.id,
      metadata: { sucursal: sucursal.name, participa },
    },
  });
}
