import { randomInt } from 'node:crypto';

import {
  PERMISOS_POR_OMISION,
  arcadeVigente,
  avanceReto,
  clavePeriodo,
  codigoCupon,
  configEfectiva,
  fechaLocal,
  finDePeriodoPagado,
  inicioDePeriodo,
  juegoPorId,
  juegosDeHoy,
  leerConfigArcade,
  leerPermisosArcade,
  leerPrecios,
  lunesDe,
  nombrePublico,
  normalizarCodigoCupon,
  puntajeCreible,
  racha,
  sumarDias,
  textoReto,
  type ConfigArcade,
  type IdJuego,
  type ModoLista,
  type PartidaResumen,
  type PeriodoPago,
  type PermisosArcade,
  type PreciosServicio,
  type Reto,
} from '@wl/domain';
import type { Prisma } from '@prisma/client';

import { esErrorUnico, prisma, transaccion } from './index';
import { estadoComercialDe, negocioActual, type Negocio } from './negocio';
import { clienteDuenio, mezclarAjustes } from './plataforma';

/**
 * Arcade del club: precios y permisos (plataforma), configuración del dueño,
 * partidas, retos, cupones y listas (negocio).
 */

// ---------------------------------------------------------------------------
// Plataforma: precios y plantilla de permisos
// ---------------------------------------------------------------------------

const CLAVE_PRECIOS = 'precios';
const CLAVE_PLANTILLA = 'arcade_plantilla';

async function leerAjustePlataforma(clave: string): Promise<unknown> {
  const fila = await clienteDuenio().platformSetting.findUnique({
    where: { key: clave },
    select: { value: true },
  });
  return fila?.value;
}

async function guardarAjustePlataforma(
  clave: string,
  valor: unknown,
  quien: string,
): Promise<void> {
  const value = valor as Prisma.InputJsonValue;
  await clienteDuenio().platformSetting.upsert({
    where: { key: clave },
    create: { key: clave, value, updatedBy: quien },
    update: { value, updatedBy: quien },
  });
}

/** Precios vigentes de Lite y del Arcade (con IVA). */
export async function preciosDelServicio(): Promise<PreciosServicio> {
  return leerPrecios(await leerAjustePlataforma(CLAVE_PRECIOS));
}

export async function guardarPreciosDelServicio(p: PreciosServicio, quien: string): Promise<void> {
  await guardarAjustePlataforma(CLAVE_PRECIOS, leerPrecios(p), quien);
}

/** Permisos con los que se activa el Arcade a un club nuevo. */
export async function plantillaArcade(): Promise<PermisosArcade> {
  const p = leerPermisosArcade(await leerAjustePlataforma(CLAVE_PLANTILLA));
  return p ? { ...p, activo: false, pagadoHasta: null } : PERMISOS_POR_OMISION;
}

export async function guardarPlantillaArcade(p: PermisosArcade, quien: string): Promise<void> {
  const limpia = leerPermisosArcade({ ...p, activo: false, pagadoHasta: null });
  await guardarAjustePlataforma(CLAVE_PLANTILLA, limpia, quien);
}

/** Fija los permisos del Arcade de un club (solo plataforma). */
export async function fijarPermisosArcade(negocioId: string, p: PermisosArcade): Promise<void> {
  await mezclarAjustes(negocioId, { arcade: leerPermisosArcade(p) });
}

/**
 * Registra el pago del Arcade por un mes o un año: lo activa y suma el
 * periodo. Si el club nunca lo tuvo, toma los permisos de la plantilla.
 */
export async function registrarPagoArcade(negocio: Negocio, periodo: PeriodoPago): Promise<string> {
  const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
  const hasta = finDePeriodoPagado(periodo, actual.pagadoHasta);
  await fijarPermisosArcade(negocio.id, { ...actual, activo: true, pagadoHasta: hasta });
  return hasta;
}

// ---------------------------------------------------------------------------
// Negocio: configuración
// ---------------------------------------------------------------------------

export interface ArcadeDelNegocio {
  /** Los clientes pueden jugar hoy. */
  readonly vigente: boolean;
  readonly permisos: PermisosArcade | null;
  /** La configuración con la que se juega (recortada a los permisos). */
  readonly config: ConfigArcade;
  /** Lo que guardó el dueño, sin recortar: para mostrarle su formulario. */
  readonly guardada: Partial<ConfigArcade>;
}

export async function arcadeDelNegocio(ahora: Date = new Date()): Promise<ArcadeDelNegocio> {
  const negocio = await negocioActual();
  const permisos = negocio.ajustes.arcade;
  const fila = await prisma.arcadeConfig.findUnique({
    where: { tenantId: negocio.id },
    select: { config: true },
  });
  const guardada = leerConfigArcade(fila?.config);
  const config = configEfectiva(
    guardada,
    permisos ?? PERMISOS_POR_OMISION,
    negocio.ajustes.alta?.giro,
  );
  const vigente =
    negocio.activo &&
    estadoComercialDe(negocio, ahora) !== 'PAUSADO' &&
    arcadeVigente(permisos, ahora);
  return { vigente, permisos, config, guardada };
}

export type ResultadoArcade =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Guarda la configuración del dueño. Rechaza lo que sus permisos no le dejan
 * (en vez de recortarlo en silencio) para que sepa por qué no se guardó.
 */
export async function guardarConfigArcade(
  entrada: unknown,
  userId: string,
): Promise<ResultadoArcade> {
  const negocio = await negocioActual();
  const p = negocio.ajustes.arcade;
  if (!p?.activo) return { ok: false, error: 'Tu club no tiene el Arcade activo.' };
  const c = leerConfigArcade(entrada);
  const juegos = c.juegos ?? [];
  if (juegos.length === 0) return { ok: false, error: 'Elige al menos un juego.' };
  if (juegos.some((j) => !p.juegos.includes(j) || !juegoPorId(j)?.disponible)) {
    return { ok: false, error: 'Elegiste un juego que tu plan no incluye.' };
  }
  if (juegos.length > p.maxJuegosActivos) {
    return { ok: false, error: `Tu plan permite hasta ${p.maxJuegosActivos} juegos activos.` };
  }
  if ((c.partidasDia ?? 1) > p.maxPartidasDia) {
    return { ok: false, error: `Tu plan permite hasta ${p.maxPartidasDia} partidas al día.` };
  }
  if ((c.retos?.length ?? 0) > p.maxRetos) {
    return { ok: false, error: `Tu plan permite hasta ${p.maxRetos} retos.` };
  }
  if (c.lista && !p.listas.includes(c.lista.modo)) {
    return { ok: false, error: 'Ese tipo de lista no está incluido en tu plan.' };
  }
  const config = c as Prisma.InputJsonValue;
  await prisma.arcadeConfig.upsert({
    where: { tenantId: negocio.id },
    create: { config, updatedById: userId },
    update: { config, updatedById: userId },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Partidas
// ---------------------------------------------------------------------------

const comoFecha = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const aDia = (d: Date) => d.toISOString().slice(0, 10);

export type InicioPartida =
  | { readonly ok: true; readonly id: string; readonly semilla: number; readonly quedanHoy: number }
  | { readonly ok: false; readonly error: string };

/** Abre una partida si hoy se puede: Arcade vigente, juego del día y tope diario. */
export async function iniciarPartida(
  cardId: string,
  juego: string,
  ahora = new Date(),
): Promise<InicioPartida> {
  const negocio = await negocioActual();
  const { vigente, config } = await arcadeDelNegocio(ahora);
  if (!vigente) return { ok: false, error: 'El Arcade de este club no está disponible.' };
  const hoy = fechaLocal(ahora, negocio.zonaHoraria);
  if (!juegosDeHoy(config, hoy).includes(juego as IdJuego)) {
    return { ok: false, error: 'Ese juego no está disponible hoy.' };
  }
  const jugadas = await prisma.arcadePlay.count({ where: { cardId, day: comoFecha(hoy) } });
  if (jugadas >= config.partidasDia) {
    return { ok: false, error: 'Ya jugaste tus partidas de hoy. Vuelve mañana.' };
  }
  const partida = await prisma.arcadePlay.create({
    data: { cardId, game: juego, day: comoFecha(hoy), seed: randomInt(1, 2_147_483_647) },
    select: { id: true, seed: true },
  });
  return {
    ok: true,
    id: partida.id,
    semilla: partida.seed,
    quedanHoy: config.partidasDia - jugadas - 1,
  };
}

export interface CuponArcade {
  readonly codigo: string;
  readonly titulo: string;
  readonly estado: 'DISPONIBLE' | 'CANJEADO' | 'VENCIDO';
  readonly vence: Date;
  readonly ganado: Date;
  readonly canjeado: Date | null;
}

export type FinPartida =
  | {
      readonly ok: true;
      readonly puntos: number;
      /** El puntaje no cuadra con el tiempo jugado: no cuenta para retos ni listas. */
      readonly sospechosa: boolean;
      readonly cuponesNuevos: readonly CuponArcade[];
    }
  | { readonly ok: false; readonly error: string };

/** Partidas válidas de una tarjeta desde `desde` (día civil), para medir retos. */
async function partidasValidas(cardId: string, desde: string): Promise<PartidaResumen[]> {
  const filas = await prisma.arcadePlay.findMany({
    where: { cardId, day: { gte: comoFecha(desde) }, suspicious: false, endedAt: { not: null } },
    select: { day: true, game: true, score: true, level: true },
  });
  return filas.map((f) => ({
    dia: aDia(f.day),
    juego: f.game,
    puntos: f.score ?? 0,
    nivel: f.level ?? 1,
  }));
}

const enPeriodo = (r: Reto, dia: string) => (p: PartidaResumen) =>
  p.dia >= inicioDePeriodo(r.periodo, dia) && p.dia <= dia;

/** Cierra la partida con su puntaje y entrega los cupones de los retos que se cumplieron. */
export async function terminarPartida(
  cardId: string,
  partidaId: string,
  puntos: number,
  nivel: number,
  ahora = new Date(),
): Promise<FinPartida> {
  const negocio = await negocioActual();
  const cerrada = await transaccion(async (tx) => {
    const p = await tx.arcadePlay.findFirst({
      where: { id: partidaId, cardId, endedAt: null },
      select: { id: true, game: true, startedAt: true, day: true },
    });
    if (!p) return null;
    const segundos = (ahora.getTime() - p.startedAt.getTime()) / 1000;
    const creible = puntajeCreible(p.game as IdJuego, puntos, nivel, segundos);
    await tx.arcadePlay.update({
      where: { id: p.id },
      data: {
        endedAt: ahora,
        score: Number.isInteger(puntos) ? Math.max(0, Math.min(puntos, 2_000_000_000)) : 0,
        level: Number.isInteger(nivel) ? Math.max(1, Math.min(nivel, 1000)) : 1,
        suspicious: !creible,
      },
    });
    return { creible, dia: aDia(p.day) };
  });
  if (!cerrada) return { ok: false, error: 'Esta partida ya terminó o no existe.' };
  if (!cerrada.creible) return { ok: true, puntos, sospechosa: true, cuponesNuevos: [] };

  const { config, vigente } = await arcadeDelNegocio(ahora);
  if (!vigente || config.retos.length === 0)
    return { ok: true, puntos, sospechosa: false, cuponesNuevos: [] };
  const dia = cerrada.dia;
  const desde = config.retos.reduce((m, r) => {
    const i = inicioDePeriodo(r.periodo, dia);
    return i < m ? i : m;
  }, dia);
  const [partidas, yaGanados] = await Promise.all([
    partidasValidas(cardId, desde),
    prisma.arcadeCoupon.findMany({
      where: { cardId, period: { in: config.retos.map((r) => clavePeriodo(r.periodo, dia)) } },
      select: { challengeId: true, period: true },
    }),
  ]);
  const nuevos: CuponArcade[] = [];
  for (const reto of config.retos) {
    const clave = clavePeriodo(reto.periodo, dia);
    if (yaGanados.some((g) => g.challengeId === reto.id && g.period === clave)) continue;
    if (avanceReto(reto, partidas.filter(enPeriodo(reto, dia))) < reto.meta) continue;
    const cupon = await entregarCupon(
      negocio,
      cardId,
      reto,
      clavePeriodo(reto.periodo, dia),
      ahora,
    );
    if (cupon) nuevos.push(cupon);
  }
  return { ok: true, puntos, sospechosa: false, cuponesNuevos: nuevos };
}

/** Crea el cupón del reto en el periodo, si no existe ya. Null si ya se había ganado. */
async function entregarCupon(
  negocio: Negocio,
  cardId: string,
  reto: Reto,
  periodo: string,
  ahora: Date,
): Promise<CuponArcade | null> {
  const vence = new Date(ahora.getTime() + reto.vigenciaDias * 24 * 60 * 60 * 1000);
  for (let intento = 0; intento < 6; intento += 1) {
    const codigo = codigoCupon(negocio.prefijoCodigo);
    try {
      await prisma.arcadeCoupon.create({
        data: {
          cardId,
          challengeId: reto.id,
          period: periodo,
          code: codigo,
          title: reto.premio,
          expiresAt: vence,
        },
      });
      return {
        codigo,
        titulo: reto.premio,
        estado: 'DISPONIBLE',
        vence,
        ganado: ahora,
        canjeado: null,
      };
    } catch (e) {
      if (!esErrorUnico(e)) throw e;
      // ¿Ya tenía el cupón de este reto y periodo? Entonces no hay nada que dar.
      const ya = await prisma.arcadeCoupon.findFirst({
        where: { cardId, challengeId: reto.id, period: periodo },
        select: { id: true },
      });
      if (ya) return null;
      // Si no, chocó el código: se intenta con otro.
    }
  }
  throw new Error('No se pudo generar un código de cupón único.');
}

// ---------------------------------------------------------------------------
// Lo que ve el cliente
// ---------------------------------------------------------------------------

const estadoCupon = (c: { status: string; expiresAt: Date }, ahora: Date): CuponArcade['estado'] =>
  c.status === 'CANJEADO'
    ? 'CANJEADO'
    : c.expiresAt.getTime() <= ahora.getTime()
      ? 'VENCIDO'
      : 'DISPONIBLE';

export async function cuponesArcadeDeTarjeta(
  cardId: string,
  ahora = new Date(),
): Promise<CuponArcade[]> {
  const filas = await prisma.arcadeCoupon.findMany({
    where: { cardId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      code: true,
      title: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      redeemedAt: true,
    },
  });
  return filas.map((c) => ({
    codigo: c.code,
    titulo: c.title,
    estado: estadoCupon(c, ahora),
    vence: c.expiresAt,
    ganado: c.createdAt,
    canjeado: c.redeemedAt,
  }));
}

export interface RetoConAvance {
  readonly id: string;
  readonly texto: string;
  readonly premio: string;
  readonly meta: number;
  readonly avance: number;
  readonly periodo: 'semana' | 'mes';
  /** Ya ganó el cupón de este periodo. */
  readonly ganado: boolean;
}

export interface ArcadeDeLaTarjeta {
  readonly vigente: boolean;
  readonly hoy: string;
  readonly juegos: readonly IdJuego[];
  readonly modo: 'fijos' | 'semana';
  readonly partidasDia: number;
  readonly jugadasHoy: number;
  readonly racha: number;
  readonly retos: readonly RetoConAvance[];
  readonly cupones: readonly CuponArcade[];
  readonly productos: ConfigArcade['productos'];
  readonly palabras: ConfigArcade['palabras'];
  readonly lista: ConfigArcade['lista'];
}

export async function arcadeDeLaTarjeta(
  cardId: string,
  ahora = new Date(),
): Promise<ArcadeDeLaTarjeta> {
  const negocio = await negocioActual();
  const { vigente, config } = await arcadeDelNegocio(ahora);
  const hoy = fechaLocal(ahora, negocio.zonaHoraria);
  const desde = [
    sumarDias(hoy, -62),
    ...config.retos.map((r) => inicioDePeriodo(r.periodo, hoy)),
  ].sort()[0]!;
  const [partidas, jugadasHoy, cupones, ganados] = await Promise.all([
    partidasValidas(cardId, desde),
    prisma.arcadePlay.count({ where: { cardId, day: comoFecha(hoy) } }),
    cuponesArcadeDeTarjeta(cardId, ahora),
    prisma.arcadeCoupon.findMany({
      where: { cardId, period: { in: config.retos.map((r) => clavePeriodo(r.periodo, hoy)) } },
      select: { challengeId: true, period: true },
    }),
  ]);
  const retos = config.retos.map((r) => ({
    id: r.id,
    texto: textoReto(r),
    premio: r.premio,
    meta: r.meta,
    avance: Math.min(r.meta, avanceReto(r, partidas.filter(enPeriodo(r, hoy)))),
    periodo: r.periodo,
    ganado: ganados.some(
      (g) => g.challengeId === r.id && g.period === clavePeriodo(r.periodo, hoy),
    ),
  }));
  return {
    vigente,
    hoy,
    juegos: juegosDeHoy(config, hoy),
    modo: config.modo,
    partidasDia: config.partidasDia,
    jugadasHoy,
    racha: racha(
      partidas.map((p) => p.dia),
      hoy,
    ),
    retos,
    cupones,
    productos: config.productos,
    palabras: config.palabras,
    lista: config.lista,
  };
}

export interface FilaLista {
  readonly nombre: string;
  /** Puntos o días de racha; null si la lista no los muestra. */
  readonly valor: number | null;
  readonly esTuya: boolean;
}

/** La lista de la semana según el modo que eligió el dueño. */
export async function listaArcade(
  cardId: string | null,
  ahora = new Date(),
): Promise<{ modo: ModoLista; filas: FilaLista[] }> {
  const negocio = await negocioActual();
  const { config } = await arcadeDelNegocio(ahora);
  const { modo, tamano, mostrarPuntos } = config.lista;
  const hoy = fechaLocal(ahora, negocio.zonaHoraria);
  const lunes = comoFecha(lunesDe(hoy));
  const validas = { suspicious: false, endedAt: { not: null } } as const;
  let orden: { cardId: string; valor: number | null }[] = [];

  if (modo === 'ranking') {
    const g = await prisma.arcadePlay.groupBy({
      by: ['cardId'],
      where: { ...validas, day: { gte: lunes } },
      _max: { score: true },
      orderBy: { _max: { score: 'desc' } },
      take: tamano,
    });
    orden = g.map((f) => ({ cardId: f.cardId, valor: mostrarPuntos ? (f._max.score ?? 0) : null }));
  } else if (modo === 'aleatoria') {
    const g = await prisma.arcadePlay.groupBy({
      by: ['cardId'],
      where: { ...validas, day: { gte: lunes } },
    });
    const ids = g.map((f) => f.cardId);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const k = randomInt(0, i + 1);
      [ids[i], ids[k]] = [ids[k]!, ids[i]!];
    }
    orden = ids.slice(0, tamano).map((id) => ({ cardId: id, valor: null }));
  } else if (modo === 'rachas') {
    const filas = await prisma.arcadePlay.findMany({
      where: { ...validas, day: { gte: comoFecha(sumarDias(hoy, -60)) } },
      select: { cardId: true, day: true },
    });
    const porTarjeta = new Map<string, string[]>();
    for (const f of filas)
      porTarjeta.set(f.cardId, [...(porTarjeta.get(f.cardId) ?? []), aDia(f.day)]);
    orden = [...porTarjeta]
      .map(([id, dias]) => ({ cardId: id, valor: racha(dias, hoy) }))
      .filter((f) => f.valor >= 2)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, tamano)
      .map((f) => ({ ...f, valor: mostrarPuntos ? f.valor : null }));
  }

  if (orden.length === 0) return { modo, filas: [] };
  const tarjetas = await prisma.loyaltyCard.findMany({
    where: { id: { in: orden.map((o) => o.cardId) } },
    select: { id: true, name: true, publicCode: true },
  });
  const porId = new Map(tarjetas.map((t) => [t.id, t]));
  return {
    modo,
    filas: orden.map((o) => {
      const t = porId.get(o.cardId);
      return {
        nombre: nombrePublico(t?.name ?? null, t?.publicCode ?? '····'),
        valor: o.valor,
        esTuya: o.cardId === cardId,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Caja: cobrar cupones
// ---------------------------------------------------------------------------

export interface CuponEnCaja extends CuponArcade {
  readonly tarjeta: { readonly codigo: string; readonly nombre: string | null };
}

export async function buscarCuponArcade(
  codigo: string,
  ahora = new Date(),
): Promise<CuponEnCaja | null> {
  const c = await prisma.arcadeCoupon.findFirst({
    where: { code: normalizarCodigoCupon(codigo) },
    select: {
      code: true,
      title: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      redeemedAt: true,
      card: { select: { publicCode: true, name: true } },
    },
  });
  if (!c) return null;
  return {
    codigo: c.code,
    titulo: c.title,
    estado: estadoCupon(c, ahora),
    vence: c.expiresAt,
    ganado: c.createdAt,
    canjeado: c.redeemedAt,
    tarjeta: { codigo: c.card.publicCode, nombre: c.card.name },
  };
}

/** Marca el cupón como cobrado. Solo si está disponible y vigente. */
export async function canjearCuponArcade(
  codigo: string,
  sucursalId: string,
  userId: string,
  ahora = new Date(),
): Promise<ResultadoArcade> {
  const code = normalizarCodigoCupon(codigo);
  const r = await prisma.arcadeCoupon.updateMany({
    where: { code, status: 'DISPONIBLE', expiresAt: { gt: ahora } },
    data: {
      status: 'CANJEADO',
      redeemedAt: ahora,
      redeemedBranchId: sucursalId,
      redeemedById: userId,
    },
  });
  if (r.count === 1) return { ok: true };
  const c = await buscarCuponArcade(code, ahora);
  if (!c) return { ok: false, error: 'No existe un cupón con ese código.' };
  if (c.estado === 'CANJEADO') return { ok: false, error: 'Ese cupón ya se cobró.' };
  return { ok: false, error: 'Ese cupón ya venció.' };
}

/** Cifras de la semana para el panel. */
export async function resumenArcade(ahora = new Date()): Promise<{
  partidas: number;
  jugadores: number;
  cuponesGanados: number;
  cuponesCobrados: number;
}> {
  const negocio = await negocioActual();
  const lunes = lunesDe(fechaLocal(ahora, negocio.zonaHoraria));
  const desde = comoFecha(lunes);
  const [partidas, jugadores, ganados, cobrados] = await Promise.all([
    prisma.arcadePlay.count({ where: { day: { gte: desde }, endedAt: { not: null } } }),
    prisma.arcadePlay.groupBy({ by: ['cardId'], where: { day: { gte: desde } } }),
    prisma.arcadeCoupon.count({ where: { createdAt: { gte: desde } } }),
    prisma.arcadeCoupon.count({ where: { redeemedAt: { gte: desde } } }),
  ]);
  return {
    partidas,
    jugadores: jugadores.length,
    cuponesGanados: ganados,
    cuponesCobrados: cobrados,
  };
}
