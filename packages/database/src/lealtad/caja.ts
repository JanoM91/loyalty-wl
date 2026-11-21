import type { Prisma } from '@prisma/client';
import {
  aplicarEstampas,
  describirPremio,
  claveTicket,
  decidirAcreditacion,
  enmascararContacto,
  esFechaValida,
  estampasAOtorgar,
  fechaLocal,
  inicioDelDia,
  importeElegible,
  normalizarCaja,
  normalizarFolio,
  proximoPremio,
  type MotivoRechazo,
  type PremioGenerado,
  type ProgramaLealtad,
} from '@wl/domain';

import { prisma, transaccion, negocioActual, esErrorUnico, camposDelError } from '../index';
import { estadoComercialDe } from '../negocio';
import { programaVigente } from './programa';

/**
 * Operación del programa en el mostrador: buscar la tarjeta, acreditar la
 * visita con su ticket y entregar premios.
 *
 * **Quién llama.** Las acciones de la caja en el panel, después de comprobar
 * la sesión y la sucursal de quien atiende. Estas funciones confían en el
 * `sucursalId` que reciben: decidirlo es trabajo de la capa de arriba, que es
 * la que sabe quién inició sesión.
 *
 * **Concurrencia.** Cada acreditación bloquea la fila de la tarjeta mientras
 * decide. Si dos tabletas registran a la misma persona a la vez, la segunda
 * espera y ve lo que hizo la primera. Las restricciones únicas de la base son
 * la última red.
 */

type Tx = Prisma.TransactionClient;

/** Origen de las visitas traídas de la tarjeta física. No cuentan para «una por día». */
export const ORIGEN_MIGRACION = 'MIGRACION';

export const fechaBD = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);
const fechaDeBD = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Vista de la tarjeta para quien atiende
// ---------------------------------------------------------------------------

export interface PremioCaja {
  readonly id: string;
  /** Clave del premio. */
  readonly tipo: string;
  /** Nombre y detalle tal como se prometieron al ganarlo. */
  readonly nombre: string;
  readonly incluye: string;
  readonly posicion: number;
  readonly ciclo: number;
  readonly generado: Date;
}

export interface VistaCaja {
  readonly codigo: string;
  readonly nombre: string | null;
  /** Contacto enmascarado. El personal no necesita verlo completo. */
  readonly contacto: string;
  readonly verificada: boolean;
  readonly estampas: number;
  readonly ciclo: number;
  readonly posiciones: number;
  readonly premiosDisponibles: readonly PremioCaja[];
  /** Ya tiene una visita (acreditada o pendiente) hoy en esta sucursal. */
  readonly acumuloHoyAqui: boolean;
  readonly proximo: { readonly faltan: number; readonly premio: string } | null;
  /** Ya se le pasaron las visitas de su tarjeta física (solo se hace una vez). */
  readonly migradaFisica: boolean;
  readonly tieneCorreo: boolean;
  readonly tieneCelular: boolean;
}

/** Nombre y detalle de un premio ganado: lo guardado al ganarlo, o el programa. */
export function describirPremioGanado(
  programa: ProgramaLealtad,
  r: { kind: string; title: string | null },
): { nombre: string; incluye: string } {
  const d = describirPremio(programa, r.kind);
  return { nombre: r.title ?? d.nombre, incluye: d.incluye };
}

export async function vistaCaja(codigo: string, sucursalId: string): Promise<VistaCaja | null> {
  const t = await prisma.loyaltyCard.findFirst({
    where: { publicCode: codigo },
    include: {
      rewards: { where: { status: 'DISPONIBLE' }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!t || !t.isActive) return null;

  const hoy = await prisma.loyaltyAccrual.findFirst({
    where: {
      cardId: t.id,
      branchId: sucursalId,
      purchaseDate: fechaBD(fechaLocal(new Date(), (await negocioActual()).zonaHoraria)),
      captureSource: { not: ORIGEN_MIGRACION },
    },
    select: { id: true, status: true },
  });

  const programa = await programaVigente();
  const p = proximoPremio(t.stamps, programa);

  return {
    codigo: t.publicCode,
    nombre: t.name,
    contacto: enmascararContacto(t.email ?? t.phone),
    verificada: t.emailVerifiedAt !== null || t.phoneVerifiedAt !== null,
    estampas: t.stamps,
    ciclo: t.cycle,
    posiciones: programa.posiciones,
    premiosDisponibles: t.rewards.map((r) => ({
      id: r.id,
      tipo: r.kind,
      ...describirPremioGanado(programa, r),
      posicion: r.milestone,
      ciclo: r.cycle,
      generado: r.createdAt,
    })),
    acumuloHoyAqui: Boolean(hoy && hoy.status !== 'RECHAZADA'),
    proximo: p ? { faltan: p.faltan, premio: describirPremio(programa, p.premio).nombre } : null,
    migradaFisica: t.physicalMigratedAt !== null,
    tieneCorreo: t.email !== null,
    tieneCelular: t.phone !== null,
  };
}

// ---------------------------------------------------------------------------
// Acreditar una visita
// ---------------------------------------------------------------------------

export interface TicketCaja {
  readonly folio: string;
  readonly caja: string;
  /** "AAAA-MM-DD", la fecha impresa en el ticket. */
  readonly fecha: string;
  readonly totalCentavos: number;
  readonly propinaCentavos: number;
  readonly descuentoCentavos: number;
  readonly fotoUrl: string | null;
  readonly origen: 'MANUAL' | 'IA';
}

export interface SolicitudCaja {
  readonly codigo: string;
  readonly sucursalId: string;
  readonly usuarioId: string;
  readonly ticket: TicketCaja;
  /**
   * Qué hacer si el ticket no es de hoy: dejarlo pendiente como contingencia
   * (dentro de 48 h) o mandarlo a revisión central (más viejo). Sin esto, la
   * función solo informa y no guarda nada, para que la caja pregunte primero.
   */
  readonly registrarComo?: 'CONTINGENCIA' | 'REVISION';
  readonly nota?: string | null;
}

export type ResultadoCaja =
  | {
      readonly tipo: 'ACREDITADA';
      readonly estampas: number;
      readonly antes: { readonly estampas: number; readonly ciclo: number };
      readonly despues: { readonly estampas: number; readonly ciclo: number };
      readonly premios: readonly PremioGenerado[];
    }
  | { readonly tipo: 'PENDIENTE'; readonly razon: 'CONTINGENCIA' | 'REVISION' }
  | { readonly tipo: 'PREGUNTAR_CONTINGENCIA'; readonly diasAtras: number }
  | { readonly tipo: 'RECHAZADA'; readonly motivo: MotivoRechazo | 'TARJETA_NO_ENCONTRADA' };

export interface FilaTarjetaBloqueada {
  id: string;
  stamps: number;
  cycle: number;
  is_active: boolean;
}

export async function bloquearTarjeta(
  tx: Tx,
  codigo: string,
): Promise<FilaTarjetaBloqueada | null> {
  const filas = await tx.$queryRaw<FilaTarjetaBloqueada[]>`
    SELECT "id", "stamps", "cycle", "is_active"
    FROM "loyalty_card"
    WHERE "public_code" = ${codigo}
    FOR UPDATE`;
  const fila = filas[0];
  return fila && fila.is_active ? fila : null;
}

/** Suma estampas, crea premios y deja la acreditación como ACREDITADA. */
export async function sumarEstampas(
  tx: Tx,
  tarjeta: FilaTarjetaBloqueada,
  accrualId: string | null,
  cantidad: number,
  programa: ProgramaLealtad,
): Promise<{
  antes: FilaTarjetaBloqueada;
  despues: { estampas: number; ciclo: number };
  premios: readonly PremioGenerado[];
}> {
  const r = aplicarEstampas({ estampas: tarjeta.stamps, ciclo: tarjeta.cycle }, cantidad, programa);

  await tx.loyaltyCard.update({
    where: { id: tarjeta.id },
    // walletUpdatedAt: el pase de Apple Wallet debe reflejar este cambio.
    data: { stamps: r.saldo.estampas, cycle: r.saldo.ciclo, walletUpdatedAt: new Date() },
  });

  if (r.premios.length > 0) {
    await tx.loyaltyReward.createMany({
      data: r.premios.map((p) => ({
        cardId: tarjeta.id,
        kind: p.premio,
        title: describirPremio(programa, p.premio).nombre.slice(0, 80),
        milestone: p.posicion,
        cycle: p.ciclo,
        accrualId,
      })),
      skipDuplicates: true,
    });
  }

  return { antes: tarjeta, despues: r.saldo, premios: r.premios };
}

/**
 * Folio de respaldo cuando la caja no lo captura.
 *
 * Regla por omisión (`comprobanteConQr = PEDIDO`): la foto, el folio y el total
 * se piden siempre pero no son obligatorios; que falten no impide que el
 * cliente sume su visita. Esa visita queda anotada como captura incompleta y
 * no se puede cruzar con la compra. Un negocio puede exigir el comprobante. El folio inventado lleva la hora para que no choque con otro del
 * mismo día y sea reconocible en el panel ("SF-" = sin folio).
 */
function folioDeRespaldo(): string {
  const ahora = new Date();
  const hhmmss = ahora.toISOString().slice(11, 19).replace(/:/g, '');
  const azar = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SF-${hhmmss}${azar}`;
}

/** Qué datos del ticket faltaron, para dejarlo anotado en la acreditación. */
function faltantes(t: TicketCaja): string[] {
  const f: string[] = [];
  if (normalizarFolio(t.folio) === '') f.push('sin folio');
  if (t.totalCentavos <= 0) f.push('sin total');
  if (!t.fotoUrl) f.push('sin foto');
  return f;
}

export async function acreditarVisita(s: SolicitudCaja): Promise<ResultadoCaja> {
  const negocio = await negocioActual();
  // Con la prueba vencida la caja no sella; las tarjetas siguen guardadas.
  if (estadoComercialDe(negocio) === 'PAUSADO') {
    return { tipo: 'RECHAZADA', motivo: 'PROGRAMA_PAUSADO' };
  }
  const hoy = fechaLocal(new Date(), negocio.zonaHoraria);
  const programa = await programaVigente();
  // Sin ticket por regla del negocio, no es una captura incompleta.
  const faltaron = negocio.ajustes.comprobanteConQr === 'NO_PEDIR' ? [] : faltantes(s.ticket);
  // El negocio puede exigir el comprobante también con el QR a la vista.
  if (
    negocio.ajustes.comprobanteConQr === 'OBLIGATORIO' &&
    normalizarFolio(s.ticket.folio) === '' &&
    !s.ticket.fotoUrl
  ) {
    return { tipo: 'RECHAZADA', motivo: 'FALTA_FOLIO' };
  }
  const ticket: TicketCaja =
    normalizarFolio(s.ticket.folio) === '' ? { ...s.ticket, folio: folioDeRespaldo() } : s.ticket;

  try {
    return await transaccion(async (tx) => {
      const tarjeta = await bloquearTarjeta(tx, s.codigo);
      if (!tarjeta) return { tipo: 'RECHAZADA', motivo: 'TARJETA_NO_ENCONTRADA' } as const;

      const sucursal = await tx.branch.findUnique({
        where: { id: s.sucursalId },
        select: { isActive: true, loyaltyEnabled: true },
      });
      const participa = Boolean(sucursal?.isActive && sucursal.loyaltyEnabled);

      const fechaOk = esFechaValida(ticket.fecha);
      const clave = claveTicket(s.sucursalId, ticket.caja, ticket.fecha, ticket.folio);

      const [mismaFecha, mismoTicket] = await Promise.all([
        fechaOk
          ? tx.loyaltyAccrual.findFirst({
              where: {
                cardId: tarjeta.id,
                branchId: s.sucursalId,
                purchaseDate: fechaBD(ticket.fecha),
                captureSource: { not: ORIGEN_MIGRACION },
              },
              select: { id: true },
            })
          : null,
        tx.loyaltyAccrual.findFirst({ where: { ticketKey: clave }, select: { id: true } }),
      ]);

      const decision = decidirAcreditacion(
        {
          hoy,
          fechaCompra: ticket.fecha,
          folio: ticket.folio,
          sucursalParticipa: participa,
          yaAcumuloEnFecha: Boolean(mismaFecha),
          ticketDuplicado: Boolean(mismoTicket),
        },
        programa,
      );

      const elegible = importeElegible(ticket.totalCentavos, ticket.propinaCentavos);
      const base = {
        cardId: tarjeta.id,
        branchId: s.sucursalId,
        purchaseDate: fechaBD(ticket.fecha),
        ticketFolio: ticket.folio.trim().slice(0, 40),
        ticketRegister: normalizarCaja(ticket.caja).slice(0, 10),
        ticketKey: clave,
        totalCents: Math.max(0, Math.round(ticket.totalCentavos)),
        tipCents: Math.max(0, Math.round(ticket.propinaCentavos)),
        discountCents: Math.max(0, Math.round(ticket.descuentoCentavos)),
        eligibleCents: elegible,
        programVersion: programa.version,
        captureSource: ticket.origen,
        photoUrl: ticket.fotoUrl,
        createdById: s.usuarioId,
      };

      // Pendientes: contingencia (ayer, antier) o revisión central (más viejo).
      const pendiente =
        (decision.tipo === 'CONTINGENCIA' && s.registrarComo === 'CONTINGENCIA') ||
        (decision.tipo === 'RECHAZAR' &&
          decision.motivo === 'FUERA_DE_VENTANA' &&
          s.registrarComo === 'REVISION');

      if (pendiente) {
        const razon = decision.tipo === 'CONTINGENCIA' ? 'CONTINGENCIA' : 'REVISION';
        const acreditacion = await tx.loyaltyAccrual.create({
          data: {
            ...base,
            status: 'PENDIENTE',
            note: [razon === 'CONTINGENCIA' ? 'Contingencia' : 'Fuera de plazo', s.nota?.trim()]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 300),
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            userId: s.usuarioId,
            action: razon === 'CONTINGENCIA' ? 'lealtad.contingencia' : 'lealtad.revision',
            entityType: 'loyalty_accrual',
            entityId: acreditacion.id,
            metadata: { codigo: s.codigo, fecha: ticket.fecha, folio: ticket.folio },
          },
        });
        return { tipo: 'PENDIENTE', razon } as const;
      }

      if (decision.tipo === 'CONTINGENCIA') {
        return { tipo: 'PREGUNTAR_CONTINGENCIA', diasAtras: decision.diasAtras } as const;
      }
      if (decision.tipo === 'RECHAZAR') {
        return { tipo: 'RECHAZADA', motivo: decision.motivo } as const;
      }

      const cantidad = estampasAOtorgar(programa, elegible);
      const acreditacion = await tx.loyaltyAccrual.create({
        data: {
          ...base,
          status: 'ACREDITADA',
          stampsAwarded: cantidad,
          // La nota de la caja (p. ej. «Sin tarjeta: dijo llamarse …») y lo que
          // faltó del ticket, juntos; vacío si no hay nada que anotar.
          note:
            [
              s.nota?.trim(),
              faltaron.length > 0 ? `Captura incompleta: ${faltaron.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 300) || null,
        },
        select: { id: true },
      });
      const r = await sumarEstampas(tx, tarjeta, acreditacion.id, cantidad, programa);

      await tx.auditLog.create({
        data: {
          userId: s.usuarioId,
          action: 'lealtad.acreditar',
          entityType: 'loyalty_accrual',
          entityId: acreditacion.id,
          metadata: {
            codigo: s.codigo,
            estampas: cantidad,
            premios: r.premios.length,
            ...(faltaron.length > 0 ? { faltaron } : {}),
          },
        },
      });

      return {
        tipo: 'ACREDITADA',
        estampas: cantidad,
        antes: { estampas: r.antes.stamps, ciclo: r.antes.cycle },
        despues: r.despues,
        premios: r.premios,
      } as const;
    });
  } catch (e) {
    // Dos tabletas con el mismo ticket o la misma tarjeta en el mismo instante:
    // la base rechaza la segunda. Se traduce al mismo mensaje que la regla.
    if (esErrorUnico(e)) {
      const campos = camposDelError(e);
      return {
        tipo: 'RECHAZADA',
        motivo: campos.includes('ticket_key') ? 'TICKET_DUPLICADO' : 'YA_ACUMULO_EN_FECHA',
      };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Entregar un premio
// ---------------------------------------------------------------------------

export type ResultadoEntrega =
  | { readonly ok: true; readonly tipo: string; readonly nombre: string }
  | { readonly ok: false; readonly error: string };

export async function entregarPremio(s: {
  readonly premioId: string;
  readonly codigo: string;
  readonly sucursalId: string;
  readonly usuarioId: string;
}): Promise<ResultadoEntrega> {
  const premio = await prisma.loyaltyReward.findUnique({
    where: { id: s.premioId },
    include: {
      card: { select: { publicCode: true, emailVerifiedAt: true, phoneVerifiedAt: true } },
      redeemedBranch: { select: { name: true } },
    },
  });

  // El premio tiene que ser de la tarjeta que se escaneó. Sin esta comprobación
  // bastaría conocer el id de un premio ajeno para entregarlo.
  if (!premio || premio.card.publicCode !== s.codigo) {
    return { ok: false, error: 'Ese premio no pertenece a esta tarjeta.' };
  }
  if (premio.status !== 'DISPONIBLE') {
    const cuando = premio.redeemedAt ? fechaDeBD(premio.redeemedAt) : '';
    return {
      ok: false,
      error: `Este premio ya se entregó${cuando ? ` el ${cuando}` : ''}${premio.redeemedBranch ? ` en ${premio.redeemedBranch.name}` : ''}. La entrega es única.`,
    };
  }
  if (!premio.card.emailVerifiedAt && !premio.card.phoneVerifiedAt) {
    return {
      ok: false,
      error:
        'Para canjear, el cliente debe verificar su correo desde su tarjeta, o su celular abriendo el enlace que le manden por WhatsApp desde la caja. El premio se conserva.',
    };
  }

  const sucursal = await prisma.branch.findUnique({
    where: { id: s.sucursalId },
    select: { isActive: true, loyaltyEnabled: true },
  });
  if (!sucursal?.isActive || !sucursal.loyaltyEnabled) {
    return { ok: false, error: 'Esta sucursal todavía no entrega premios del programa.' };
  }

  // La condición `status: DISPONIBLE` dentro del update es la que garantiza la
  // entrega única: si otra tableta lo entregó un instante antes, aquí cambian
  // cero filas.
  const cambio = await prisma.loyaltyReward.updateMany({
    where: { id: s.premioId, status: 'DISPONIBLE' },
    data: {
      status: 'ENTREGADO',
      redeemedAt: new Date(),
      redeemedBranchId: s.sucursalId,
      redeemedById: s.usuarioId,
    },
  });
  if (cambio.count === 0) {
    return { ok: false, error: 'Este premio se acaba de entregar en otra caja.' };
  }

  // El pase de Apple Wallet muestra los premios listos: hay que avisarle.
  await prisma.loyaltyCard.update({
    where: { id: premio.cardId },
    data: { walletUpdatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: s.usuarioId,
      action: 'lealtad.entregar',
      entityType: 'loyalty_reward',
      entityId: s.premioId,
      metadata: { codigo: s.codigo, premio: premio.kind },
    },
  });

  const nombre = describirPremioGanado(await programaVigente(), premio).nombre;
  return { ok: true, tipo: premio.kind, nombre };
}

// ---------------------------------------------------------------------------
// Incidencias y operaciones del día
// ---------------------------------------------------------------------------

/** Deja constancia de un problema para que lo revise administración. */
export async function reportarIncidencia(s: {
  readonly usuarioId: string;
  readonly sucursalId: string;
  readonly codigo: string | null;
  readonly detalle: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: s.usuarioId,
      action: 'lealtad.incidencia',
      entityType: 'branch',
      entityId: s.sucursalId,
      metadata: { codigo: s.codigo, detalle: s.detalle.slice(0, 500), estado: 'ABIERTA' },
    },
  });
}

export interface OperacionCaja {
  readonly cuando: Date;
  readonly quien: string;
  readonly que: string;
  readonly bien: boolean;
}

/** Lo que pasó hoy en la caja de una sucursal, lo más reciente primero. */
export async function operacionesDeHoy(sucursalId: string, limite = 8): Promise<OperacionCaja[]> {
  const zona = (await negocioActual()).zonaHoraria;
  const desde = inicioDelDia(fechaLocal(new Date(), zona), zona);

  const [visitas, entregas] = await Promise.all([
    prisma.loyaltyAccrual.findMany({
      where: { branchId: sucursalId, createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        createdAt: true,
        status: true,
        stampsAwarded: true,
        captureSource: true,
        card: { select: { name: true, publicCode: true } },
      },
    }),
    prisma.loyaltyReward.findMany({
      where: { redeemedBranchId: sucursalId, redeemedAt: { gte: desde } },
      orderBy: { redeemedAt: 'desc' },
      take: limite,
      select: {
        redeemedAt: true,
        kind: true,
        title: true,
        card: { select: { name: true, publicCode: true } },
      },
    }),
  ]);
  const programa = await programaVigente();

  const ops: OperacionCaja[] = [
    ...visitas.map((v) => ({
      cuando: v.createdAt,
      quien: v.card.name ?? `Tarjeta ${v.card.publicCode}`,
      que:
        v.captureSource === ORIGEN_MIGRACION
          ? `Tarjeta física migrada · +${v.stampsAwarded} ${v.stampsAwarded === 1 ? 'estampa' : 'estampas'}`
          : v.status === 'ACREDITADA'
            ? `Visita acreditada · +${v.stampsAwarded} ${v.stampsAwarded === 1 ? 'estampa' : 'estampas'}`
            : v.status === 'PENDIENTE'
              ? 'Pendiente de revisión'
              : 'Visita rechazada',
      bien: v.status === 'ACREDITADA',
    })),
    ...entregas.map((e) => ({
      cuando: e.redeemedAt ?? new Date(0),
      quien: e.card.name ?? `Tarjeta ${e.card.publicCode}`,
      que: `Premio entregado · ${describirPremioGanado(programa, e).nombre}`,
      bien: true,
    })),
  ];

  return ops.sort((a, b) => b.cuando.getTime() - a.cuando.getTime()).slice(0, limite);
}

// ---------------------------------------------------------------------------
// Revisión central de pendientes
// ---------------------------------------------------------------------------

export type ResultadoRevision =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/** Confirma una visita pendiente: suma sus estampas con la regla vigente. */
export async function aprobarPendiente(
  accrualId: string,
  adminId: string,
): Promise<ResultadoRevision> {
  return transaccion(async (tx) => {
    const acreditacion = await tx.loyaltyAccrual.findUnique({
      where: { id: accrualId },
      select: {
        id: true,
        status: true,
        eligibleCents: true,
        card: { select: { publicCode: true } },
      },
    });
    if (!acreditacion || acreditacion.status !== 'PENDIENTE') {
      return { ok: false, error: 'Esta visita ya no está pendiente.' } as const;
    }

    const tarjeta = await bloquearTarjeta(tx, acreditacion.card.publicCode);
    if (!tarjeta) return { ok: false, error: 'La tarjeta ya no está activa.' } as const;

    const programa = await programaVigente();
    const cantidad = estampasAOtorgar(programa, acreditacion.eligibleCents);
    const cambio = await tx.loyaltyAccrual.updateMany({
      where: { id: accrualId, status: 'PENDIENTE' },
      data: {
        status: 'ACREDITADA',
        stampsAwarded: cantidad,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    if (cambio.count === 0) return { ok: false, error: 'Otra persona ya la revisó.' } as const;

    const r = await sumarEstampas(tx, tarjeta, accrualId, cantidad, programa);
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'lealtad.aprobar',
        entityType: 'loyalty_accrual',
        entityId: accrualId,
        metadata: { estampas: cantidad, premios: r.premios.length },
      },
    });
    return { ok: true } as const;
  });
}

/** Descarta una visita pendiente. El motivo es obligatorio y queda en bitácora. */
export async function rechazarPendiente(
  accrualId: string,
  adminId: string,
  motivo: string,
): Promise<ResultadoRevision> {
  const razon = motivo.trim();
  if (razon.length < 5) return { ok: false, error: 'Escribe el motivo del rechazo.' };

  const cambio = await prisma.loyaltyAccrual.updateMany({
    where: { id: accrualId, status: 'PENDIENTE' },
    data: {
      status: 'RECHAZADA',
      note: razon.slice(0, 300),
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });
  if (cambio.count === 0) return { ok: false, error: 'Esta visita ya no está pendiente.' };

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'lealtad.rechazar',
      entityType: 'loyalty_accrual',
      entityId: accrualId,
      metadata: { motivo: razon.slice(0, 300) },
    },
  });
  return { ok: true };
}
