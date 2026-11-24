import { arcadeVigente, finDePeriodoPagado, type PeriodoPago } from '@wl/domain';

import { fijarPermisosArcade, plantillaArcade } from './arcade';
import { negocioPorId, type Negocio } from './negocio';
import { clienteDuenio, mezclarAjustes, type NegocioEnLista } from './plataforma';

/**
 * Ingresos: los pagos que se registran a mano en la ficha de un club.
 *
 * Hoy el cobro es por enlace de WhatsApp y la activación es manual. Cada
 * registro guarda lo cobrado (centavos, con IVA), hasta cuándo quedó pagado y
 * hasta cuándo lo estaba antes, para poder anularlo si fue un error. Los
 * pagos anteriores a esta tabla no tienen importe: solo existe su fecha.
 */

export type ConceptoPago = 'LITE' | 'ARCADE';

export interface PagoNuevo {
  readonly concepto: ConceptoPago;
  readonly periodo: PeriodoPago;
  /** Lo cobrado en centavos, con IVA. Cero: cortesía. */
  readonly centavos: number;
  readonly nota?: string;
}

export interface PagoRegistrado {
  readonly id: string;
  readonly clubId: string | null;
  readonly clubSlug: string;
  readonly clubNombre: string;
  readonly concepto: ConceptoPago;
  readonly periodo: PeriodoPago;
  readonly centavos: number;
  readonly hasta: Date;
  readonly antes: Date | null;
  readonly nota: string | null;
  readonly registro: string;
  readonly anulado: { readonly fecha: Date; readonly quien: string } | null;
  readonly fecha: Date;
}

type FilaPago = Awaited<
  ReturnType<ReturnType<typeof clienteDuenio>['platformPayment']['findFirstOrThrow']>
>;

function aPago(f: FilaPago): PagoRegistrado {
  return {
    id: f.id,
    clubId: f.tenantId,
    clubSlug: f.tenantSlug,
    clubNombre: f.tenantName,
    concepto: f.concept,
    periodo: f.period,
    centavos: f.amountCents,
    hasta: f.paidUntil,
    antes: f.previousUntil,
    nota: f.note,
    registro: f.registeredBy,
    anulado: f.voidedAt ? { fecha: f.voidedAt, quien: f.voidedBy ?? '' } : null,
    fecha: f.createdAt,
  };
}

const MAXIMO_CENTAVOS = 10_000_000_00;

/**
 * Registra un pago: suma un mes o un año al periodo del club (o del Arcade) y
 * lo anota con su importe. Devuelve hasta cuándo quedó pagado.
 */
export async function registrarPagoDeClub(
  negocio: Negocio,
  p: PagoNuevo,
  quien: string,
): Promise<{ ok: true; hasta: string; id: string } | { ok: false; error: string }> {
  if (!Number.isInteger(p.centavos) || p.centavos < 0 || p.centavos > MAXIMO_CENTAVOS) {
    return { ok: false, error: 'Escribe el importe cobrado en pesos (0 si fue cortesía).' };
  }
  let antes: string | null;
  let hasta: string;
  if (p.concepto === 'LITE') {
    antes = negocio.ajustes.pagadoHasta;
    hasta = finDePeriodoPagado(p.periodo, antes);
    await mezclarAjustes(negocio.id, { pagadoHasta: hasta });
  } else {
    const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
    antes = actual.pagadoHasta;
    hasta = finDePeriodoPagado(p.periodo, antes);
    await fijarPermisosArcade(negocio.id, { ...actual, activo: true, pagadoHasta: hasta });
  }
  const fila = await clienteDuenio().platformPayment.create({
    data: {
      tenantId: negocio.id,
      tenantSlug: negocio.slug,
      tenantName: negocio.nombre.slice(0, 160),
      concept: p.concepto,
      period: p.periodo,
      amountCents: p.centavos,
      paidUntil: new Date(hasta),
      previousUntil: antes ? new Date(antes) : null,
      note: p.nota?.trim().slice(0, 250) || null,
      registeredBy: quien.slice(0, 160),
    },
    select: { id: true },
  });
  return { ok: true, hasta, id: fila.id };
}

const mismaFecha = (a: string | null, b: Date) => a !== null && Date.parse(a) === b.getTime();

/**
 * Anula un pago registrado. Si es el último pago vigente de ese concepto y la
 * fecha de pago del club sigue siendo la que dejó, la regresa a la de antes.
 * Si después hubo otro pago, solo lo anula (no se mueve ninguna fecha).
 */
export async function anularPagoDeClub(
  id: string,
  quien: string,
): Promise<{ ok: true; revertido: boolean; pago: PagoRegistrado } | { ok: false; error: string }> {
  const bd = clienteDuenio();
  const f = await bd.platformPayment.findUnique({ where: { id } }).catch(() => null);
  if (!f) return { ok: false, error: 'No encontramos ese pago.' };
  if (f.voidedAt) return { ok: false, error: 'Ese pago ya estaba anulado.' };

  let revertido = false;
  const negocio = f.tenantId ? await negocioPorId(f.tenantId) : null;
  if (negocio) {
    const posterior = await bd.platformPayment.count({
      where: {
        tenantId: negocio.id,
        concept: f.concept,
        voidedAt: null,
        createdAt: { gt: f.createdAt },
      },
    });
    const antes = f.previousUntil?.toISOString() ?? null;
    if (
      posterior === 0 &&
      f.concept === 'LITE' &&
      mismaFecha(negocio.ajustes.pagadoHasta, f.paidUntil)
    ) {
      await mezclarAjustes(negocio.id, { pagadoHasta: antes });
      revertido = true;
    }
    const arcade = negocio.ajustes.arcade;
    if (
      posterior === 0 &&
      f.concept === 'ARCADE' &&
      arcade &&
      mismaFecha(arcade.pagadoHasta, f.paidUntil)
    ) {
      await fijarPermisosArcade(negocio.id, {
        ...arcade,
        pagadoHasta: antes,
        activo: antes ? arcade.activo : false,
      });
      revertido = true;
    }
  }
  const anulado = await bd.platformPayment.update({
    where: { id },
    data: { voidedAt: new Date(), voidedBy: quien.slice(0, 160) },
  });
  return { ok: true, revertido, pago: aPago(anulado) };
}

/** Pagos registrados, del más reciente al más antiguo. */
export async function listarPagos(
  filtro: { readonly clubId?: string; readonly limite?: number } = {},
): Promise<PagoRegistrado[]> {
  const filas = await clienteDuenio().platformPayment.findMany({
    where: filtro.clubId ? { tenantId: filtro.clubId } : {},
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(filtro.limite ?? 100, 1), 1000),
  });
  return filas.map(aPago);
}

export interface IngresoDelMes {
  /** «2026-11». */
  readonly mes: string;
  readonly centavos: number;
  readonly pagos: number;
}

/**
 * Lo cobrado por mes (hora del centro de México), de los últimos `meses`
 * meses contando el actual. Los meses sin pagos salen en cero. Sin anulados.
 */
export async function ingresosPorMes(
  meses = 6,
  ahora: Date = new Date(),
): Promise<IngresoDelMes[]> {
  const filas = await clienteDuenio().$queryRaw<{ mes: string; centavos: bigint; pagos: bigint }[]>`
    SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM') AS mes,
           COALESCE(SUM(amount_cents), 0)::bigint AS centavos,
           COUNT(*)::bigint AS pagos
    FROM platform_payment
    WHERE voided_at IS NULL
      AND created_at >= (date_trunc('month', ${ahora}::timestamptz AT TIME ZONE 'America/Mexico_City')
                         - make_interval(months => ${meses - 1}::int)) AT TIME ZONE 'America/Mexico_City'
    GROUP BY 1`;
  const porMes = new Map(filas.map((f) => [f.mes, f]));
  const salida: IngresoDelMes[] = [];
  const [anio, mes] = mesDe(ahora);
  for (let i = meses - 1; i >= 0; i -= 1) {
    const fecha = new Date(Date.UTC(anio, mes - 1 - i, 1));
    const clave = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
    const f = porMes.get(clave);
    salida.push({ mes: clave, centavos: Number(f?.centavos ?? 0), pagos: Number(f?.pagos ?? 0) });
  }
  return salida;
}

/** Año y mes (1–12) en el centro de México. */
function mesDe(ahora: Date): [number, number] {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(ahora);
  const anio = Number(partes.find((p) => p.type === 'year')?.value);
  const mes = Number(partes.find((p) => p.type === 'month')?.value);
  return [anio, mes];
}

export interface Recurrente {
  /** Ingreso mensual equivalente de lo que hoy está pagado (año ÷ 12), en centavos. */
  readonly centavosAlMes: number;
  /** Clubes que entran en la cuenta. */
  readonly clubes: number;
  /** Clubes pagados sin un pago registrado con importe (anteriores a esta tabla). */
  readonly sinImporte: number;
}

/**
 * Ingreso mensual recurrente estimado: por cada club con Lite (o Arcade)
 * pagado y vigente, su último pago registrado convertido a mes. Es una
 * estimación: supone que cada club renueva igual que la última vez.
 */
export async function ingresoRecurrente(
  lista: readonly NegocioEnLista[],
  ahora: Date = new Date(),
): Promise<Recurrente> {
  const vigentes = lista.filter((f) => f.negocio.activo);
  const ids = vigentes.map((f) => f.negocio.id);
  if (ids.length === 0) return { centavosAlMes: 0, clubes: 0, sinImporte: 0 };
  const ultimos = await clienteDuenio().platformPayment.findMany({
    where: { tenantId: { in: ids }, voidedAt: null },
    orderBy: { createdAt: 'desc' },
    distinct: ['tenantId', 'concept'],
    select: { tenantId: true, concept: true, period: true, amountCents: true },
  });
  const clave = (id: string | null, c: ConceptoPago) => `${id}|${c}`;
  const porClave = new Map(ultimos.map((u) => [clave(u.tenantId, u.concept), u]));
  let centavos = 0;
  let clubes = 0;
  let sinImporte = 0;
  for (const { negocio } of vigentes) {
    const pagado = negocio.ajustes.pagadoHasta;
    const lite = pagado !== null && Date.parse(pagado) > ahora.getTime();
    const arcade = arcadeVigente(negocio.ajustes.arcade, ahora);
    if (!lite && !arcade) continue;
    let cuenta = false;
    for (const [vigente, concepto] of [
      [lite, 'LITE'],
      [arcade, 'ARCADE'],
    ] as const) {
      if (!vigente) continue;
      const u = porClave.get(clave(negocio.id, concepto));
      if (!u) {
        if (concepto === 'LITE') sinImporte += 1;
        continue;
      }
      centavos += u.period === 'ANIO' ? Math.round(u.amountCents / 12) : u.amountCents;
      cuenta = true;
    }
    if (cuenta) clubes += 1;
  }
  return { centavosAlMes: centavos, clubes, sinImporte };
}

export interface Renovacion {
  readonly fila: NegocioEnLista;
  readonly concepto: ConceptoPago;
  readonly vence: Date;
  /** Días que faltan; negativo si ya venció. */
  readonly dias: number;
}

const DIA = 86_400_000;

/**
 * Periodos pagados (Lite y Arcade) que vencen en los próximos `dias` días o
 * que vencieron en los últimos 7, del más urgente al menos. Sin consultas:
 * sale de la lista de clubes.
 */
export function renovacionesProximas(
  lista: readonly NegocioEnLista[],
  dias = 30,
  ahora: Date = new Date(),
): Renovacion[] {
  const salida: Renovacion[] = [];
  for (const fila of lista) {
    if (!fila.negocio.activo) continue;
    const fechas: [ConceptoPago, string | null][] = [
      ['LITE', fila.negocio.ajustes.pagadoHasta],
      ['ARCADE', fila.negocio.ajustes.arcade?.pagadoHasta ?? null],
    ];
    for (const [concepto, iso] of fechas) {
      if (!iso) continue;
      const vence = new Date(iso);
      if (Number.isNaN(vence.getTime())) continue;
      const faltan = Math.ceil((vence.getTime() - ahora.getTime()) / DIA);
      if (faltan > dias || faltan < -7) continue;
      salida.push({ fila, concepto, vence, dias: faltan });
    }
  }
  return salida.sort((a, b) => a.vence.getTime() - b.vence.getTime());
}
