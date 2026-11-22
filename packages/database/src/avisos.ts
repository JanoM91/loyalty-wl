import { fechaLocal, leerAvisos, type AvisosDelClub } from '@wl/domain';
import type { Prisma } from '@prisma/client';

import { prisma } from './index';
import { negocioActual, type Negocio } from './negocio';
import {
  borradoAutomaticoEncendido,
  clienteDuenio,
  listarNegocios,
  mezclarAjustes,
} from './plataforma';

/**
 * Datos para los correos al dueño: fin de prueba, pausa, borrado y resumen
 * semanal. Las reglas de cuándo toca cada uno viven en `@wl/domain`
 * (`avisoDeCiclo`); aquí se leen los clubes, sus dueños y sus números.
 */

/**
 * Clubes con dueño real: los del asistente y los que pagan. Los de
 * demostración que dio de alta Exkalibur (sin alta ni pago) no reciben nada.
 * Los suspendidos tampoco.
 */
export async function clubesParaAvisos(): Promise<{
  readonly clubes: readonly Negocio[];
  readonly borradoAutomatico: boolean;
}> {
  const [lista, borradoAutomatico] = await Promise.all([
    listarNegocios(),
    borradoAutomaticoEncendido(),
  ]);
  const clubes = lista
    .map((f) => f.negocio)
    .filter((n) => n.activo && (n.ajustes.alta !== null || n.ajustes.pagadoHasta !== null));
  return { clubes, borradoAutomatico };
}

/** Dueños activos del club, con su correo. */
export async function dueniosDelClub(
  negocioId: string,
): Promise<readonly { readonly email: string; readonly nombre: string }[]> {
  const filas = await clienteDuenio().userAccount.findMany({
    where: { tenantId: negocioId, role: 'DUENO', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { email: true, name: true },
  });
  return filas
    .filter((f) => f.email.includes('@'))
    .map((f) => ({ email: f.email, nombre: f.name.trim() }));
}

async function avisosGuardados(negocioId: string): Promise<Record<string, unknown>> {
  const fila = await clienteDuenio().tenant.findUniqueOrThrow({
    where: { id: negocioId },
    select: { settings: true },
  });
  const s = fila.settings as Prisma.JsonObject | null;
  const a = s && typeof s === 'object' && !Array.isArray(s) ? s.avisos : null;
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
}

/** Anota que un aviso ya salió (o cambia la preferencia del resumen). */
export async function marcarAvisos(
  negocioId: string,
  cambios: Partial<Omit<AvisosDelClub, 'resumenSemanal'>> & { resumenSemanal?: boolean },
): Promise<AvisosDelClub> {
  const actual = await avisosGuardados(negocioId);
  const nuevos = { ...actual, ...cambios };
  await mezclarAjustes(negocioId, { avisos: nuevos });
  return leerAvisos(nuevos);
}

export interface CifrasDelClub {
  /** Tarjetas activas hoy (en total). */
  readonly tarjetas: number;
  readonly tarjetasNuevas: number;
  readonly visitas: number;
  /** Clientes distintos que sumaron al menos una visita. */
  readonly clientes: number;
  readonly premiosGanados: number;
  readonly premiosEntregados: number;
  readonly partidas: number;
  readonly promocionesGanadas: number;
}

/**
 * Números del club en curso entre `desde` (incluido) y `hasta` (excluido).
 * Las visitas se cuentan por día local del club, como en el panel.
 */
export async function cifrasDelClub(desde: Date, hasta: Date): Promise<CifrasDelClub> {
  const zona = (await negocioActual()).zonaHoraria;
  const dia = (d: Date) => new Date(`${fechaLocal(d, zona)}T00:00:00.000Z`);
  const [desdeDia, hastaDia] = [dia(desde), dia(hasta)];
  const entre = { gte: desde, lt: hasta };
  const [
    tarjetas,
    tarjetasNuevas,
    visitas,
    clientes,
    premiosGanados,
    premiosEntregados,
    partidas,
    promociones,
  ] = await Promise.all([
    prisma.loyaltyCard.count({ where: { isActive: true } }),
    prisma.loyaltyCard.count({ where: { createdAt: entre } }),
    prisma.loyaltyAccrual.count({
      where: { status: 'ACREDITADA', purchaseDate: { gte: desdeDia, lt: hastaDia } },
    }),
    prisma.loyaltyAccrual.groupBy({
      by: ['cardId'],
      where: { status: 'ACREDITADA', purchaseDate: { gte: desdeDia, lt: hastaDia } },
    }),
    prisma.loyaltyReward.count({ where: { createdAt: entre } }),
    prisma.loyaltyReward.count({ where: { redeemedAt: entre } }),
    prisma.arcadePlay.count({
      where: { day: { gte: desdeDia, lt: hastaDia }, endedAt: { not: null } },
    }),
    prisma.arcadeCoupon.count({ where: { createdAt: entre } }),
  ]);
  return {
    tarjetas,
    tarjetasNuevas,
    visitas,
    clientes: clientes.length,
    premiosGanados,
    premiosEntregados,
    partidas,
    promocionesGanadas: promociones,
  };
}
