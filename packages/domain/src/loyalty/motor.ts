/**
 * Motor del programa de lealtad.
 *
 * Aquí se decide, sin tocar la base, si una visita se acredita, cuántas
 * estampas da y qué premios genera. La caja y el panel solo consultan los
 * datos y guardan lo que este archivo resuelve: si la regla cambia, cambia
 * aquí y en ningún otro lado.
 *
 * Reglas de la versión aprobada:
 *
 * 1. Una acreditación por tarjeta, sucursal y **fecha de compra**. Una
 *    segunda compra el mismo día en la misma sucursal no suma; en otra
 *    sucursal sí.
 * 2. Un ticket se acredita una sola vez y a una sola tarjeta.
 * 3. El ticket de hoy se acredita al momento. El de ayer o antier entra como
 *    contingencia (queda pendiente y lo confirma administración). Uno más
 *    viejo va a revisión central.
 * 4. Los premios se generan al pasar por su posición, se acumulan y no se
 *    descuentan de las estampas. Al llenar la tarjeta empieza un ciclo nuevo
 *    y lo que sobra pasa a ese ciclo (9 + 3 → premio de la 10 y tarjeta nueva
 *    con 2).
 */

import { sumarDias } from '../shared/fecha';
import { describirPremio, type ProgramaLealtad, type PremioLealtad, type Tramo } from './programa';

// ---------------------------------------------------------------------------
// Estampas
// ---------------------------------------------------------------------------

/** Lo que cuenta para estampas: el total menos la propina. Nunca negativo. */
export function importeElegible(totalCentavos: number, propinaCentavos = 0): number {
  return Math.max(0, Math.round(totalCentavos) - Math.round(propinaCentavos));
}

/** Estampas que corresponden a un importe según los tramos. */
export function estampasPorImporte(centavos: number, tramos: readonly Tramo[]): number {
  const tramo = tramos.find(
    (t) => centavos >= t.desdeCentavos && (t.hastaCentavos === null || centavos < t.hastaCentavos),
  );
  return tramo ? tramo.estampas : 0;
}

/** Estampas que otorga una visita válida con el programa dado. */
export function estampasAOtorgar(programa: ProgramaLealtad, elegibleCentavos: number): number {
  if (programa.modalidad === 'VISITA') return 1;
  return estampasPorImporte(elegibleCentavos, programa.tramos);
}

export interface Saldo {
  /** Estampas en la tarjeta actual, de 0 a posiciones − 1. */
  readonly estampas: number;
  /** Número de tarjeta, empezando en 1. */
  readonly ciclo: number;
}

export interface PremioGenerado {
  readonly premio: PremioLealtad;
  readonly posicion: number;
  readonly ciclo: number;
}

export interface ResultadoEstampas {
  readonly saldo: Saldo;
  readonly premios: readonly PremioGenerado[];
  readonly ciclosCompletados: number;
}

/**
 * Suma estampas a un saldo y devuelve el saldo nuevo y los premios ganados.
 *
 * Avanza de una en una a propósito: con la modalidad por importe una sola
 * visita puede dar varias estampas y cruzar un premio y el fin de la tarjeta
 * en el mismo movimiento.
 */
export function aplicarEstampas(
  saldo: Saldo,
  cantidad: number,
  programa: ProgramaLealtad,
): ResultadoEstampas {
  let estampas = saldo.estampas;
  let ciclo = saldo.ciclo;
  let ciclosCompletados = 0;
  const premios: PremioGenerado[] = [];

  for (let i = 0; i < Math.max(0, Math.floor(cantidad)); i++) {
    estampas += 1;
    for (const hito of programa.hitos) {
      if (hito.posicion === estampas) {
        premios.push({ premio: hito.premio, posicion: hito.posicion, ciclo });
      }
    }
    if (estampas >= programa.posiciones) {
      estampas -= programa.posiciones;
      ciclo += 1;
      ciclosCompletados += 1;
    }
  }

  return { saldo: { estampas, ciclo }, premios, ciclosCompletados };
}

export interface ProximoPremio {
  readonly faltan: number;
  readonly premio: PremioLealtad;
  readonly posicion: number;
}

/** El siguiente premio de la tarjeta actual, o null si ya no queda ninguno. */
export function proximoPremio(estampas: number, programa: ProgramaLealtad): ProximoPremio | null {
  const hito = [...programa.hitos]
    .sort((a, b) => a.posicion - b.posicion)
    .find((h) => h.posicion > estampas);
  return hito
    ? { faltan: hito.posicion - estampas, premio: hito.premio, posicion: hito.posicion }
    : null;
}

/** "Te falta 1 estampa para tu premio." Lo comparten la tarjeta y la caja. */
export function textoProximoPremio(estampas: number, programa: ProgramaLealtad): string {
  const p = proximoPremio(estampas, programa);
  if (!p) return 'Tarjeta completa.';
  const cuantas = p.faltan === 1 ? 'falta 1 estampa' : `faltan ${p.faltan} estampas`;
  return `Te ${cuantas} para tu ${describirPremio(programa, p.premio).nombre.toLowerCase()}.`;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

/**
 * Folio limpio para comparar duplicados: mayúsculas, solo letras y números.
 *
 * "c2-12044", "C2 12044" y "C2-12044" son el mismo ticket; si se guardaran
 * tal como se escribieron, el mismo ticket podría acreditarse tres veces.
 */
export function normalizarFolio(folio: string): string {
  return folio
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Caja o serie del ticket, con la misma limpieza. Vacía equivale a "1". */
export function normalizarCaja(caja: string): string {
  const limpia = normalizarFolio(caja);
  return limpia === '' ? '1' : limpia;
}

/**
 * Identidad de un ticket: sucursal, caja, fecha y folio.
 *
 * La base guarda este valor con restricción de unicidad. Es lo que impide, aun
 * con dos tabletas registrando a la vez, que un ticket sume dos veces.
 */
export function claveTicket(
  sucursalId: string,
  caja: string,
  fecha: string,
  folio: string,
): string {
  return `${sucursalId}|${normalizarCaja(caja)}|${fecha}|${normalizarFolio(folio)}`;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Es "AAAA-MM-DD" y existe en el calendario? */
export function esFechaValida(fecha: string): boolean {
  if (!FECHA_ISO.test(fecha)) return false;
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Días de calendario entre dos fechas "AAAA-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// ---------------------------------------------------------------------------
// Decisión de acreditación
// ---------------------------------------------------------------------------

export type MotivoRechazo =
  | 'SUCURSAL_NO_PARTICIPA'
  | 'FALTA_FECHA'
  | 'FECHA_FUTURA'
  | 'YA_ACUMULO_EN_FECHA'
  | 'FALTA_FOLIO'
  | 'TICKET_DUPLICADO'
  | 'FUERA_DE_VENTANA'
  | 'PROGRAMA_PAUSADO';

export type Decision =
  | { readonly tipo: 'ACREDITAR' }
  | { readonly tipo: 'CONTINGENCIA'; readonly diasAtras: number }
  | { readonly tipo: 'RECHAZAR'; readonly motivo: MotivoRechazo };

export interface SolicitudAcreditacion {
  /** Fecha local de hoy en la zona del negocio, "AAAA-MM-DD". */
  readonly hoy: string;
  readonly fechaCompra: string;
  readonly folio: string;
  readonly sucursalParticipa: boolean;
  /** Ya existe una acreditación (o un pendiente) de esta tarjeta, aquí, en esa fecha. */
  readonly yaAcumuloEnFecha: boolean;
  /** Ya existe un registro con la misma clave de ticket. */
  readonly ticketDuplicado: boolean;
}

/**
 * Decide qué pasa con una visita.
 *
 * El orden de las comprobaciones importa: primero lo que no tiene remedio en
 * caja (sucursal fuera del programa, fecha imposible), después lo que se
 * corrige escribiendo (folio) y al final lo que depende del calendario.
 */
export function decidirAcreditacion(s: SolicitudAcreditacion, programa: ProgramaLealtad): Decision {
  if (!s.sucursalParticipa) return { tipo: 'RECHAZAR', motivo: 'SUCURSAL_NO_PARTICIPA' };
  if (!esFechaValida(s.fechaCompra)) return { tipo: 'RECHAZAR', motivo: 'FALTA_FECHA' };

  const diasAtras = diasEntre(s.fechaCompra, s.hoy);
  if (diasAtras < 0) return { tipo: 'RECHAZAR', motivo: 'FECHA_FUTURA' };

  if (s.yaAcumuloEnFecha) return { tipo: 'RECHAZAR', motivo: 'YA_ACUMULO_EN_FECHA' };
  if (normalizarFolio(s.folio) === '') return { tipo: 'RECHAZAR', motivo: 'FALTA_FOLIO' };
  if (s.ticketDuplicado) return { tipo: 'RECHAZAR', motivo: 'TICKET_DUPLICADO' };

  if (diasAtras === 0) return { tipo: 'ACREDITAR' };
  if (diasAtras <= programa.ventanaContingenciaDias) return { tipo: 'CONTINGENCIA', diasAtras };
  return { tipo: 'RECHAZAR', motivo: 'FUERA_DE_VENTANA' };
}

/** Fecha más antigua que todavía entra como contingencia. */
export function inicioVentanaContingencia(hoy: string, programa: ProgramaLealtad): string {
  return sumarDias(hoy, -programa.ventanaContingenciaDias);
}

export interface TextoRechazo {
  readonly titulo: string;
  readonly detalle: string;
}

/** Lo que ve quien atiende la caja. Dice qué pasó y qué hacer. */
export function textoRechazo(motivo: MotivoRechazo, fechaCompra?: string): TextoRechazo {
  const fecha = fechaCompra && esFechaValida(fechaCompra) ? formatoFechaCorta(fechaCompra) : '';
  switch (motivo) {
    case 'SUCURSAL_NO_PARTICIPA':
      return {
        titulo: 'Sucursal fuera del programa',
        detalle: 'Esta sucursal todavía no acredita ni entrega premios.',
      };
    case 'FALTA_FECHA':
      return {
        titulo: 'Falta la fecha',
        detalle: 'Escribe la fecha de compra tal como aparece en el ticket.',
      };
    case 'FECHA_FUTURA':
      return {
        titulo: 'Fecha posterior a hoy',
        detalle: 'La fecha de compra no puede ser posterior a hoy. Revísala en el ticket.',
      };
    case 'YA_ACUMULO_EN_FECHA':
      return {
        titulo: 'Ya acumuló ese día aquí',
        detalle: `Esta tarjeta ya sumó una visita en esta sucursal${fecha ? ` el ${fecha}` : ''}. Se acredita una por sucursal y día.`,
      };
    case 'FALTA_FOLIO':
      return {
        titulo: 'Falta el folio',
        detalle: 'Escribe el folio del ticket para poder revisar que no se haya registrado antes.',
      };
    case 'TICKET_DUPLICADO':
      return {
        titulo: 'Ticket ya registrado',
        detalle:
          'Este ticket ya se acreditó. Un ticket cuenta una sola vez y para una sola tarjeta.',
      };
    case 'FUERA_DE_VENTANA':
      return {
        titulo: 'Ticket fuera de plazo',
        detalle: `La compra${fecha ? ` del ${fecha}` : ''} ya está fuera de plazo. Envíala a revisión central.`,
      };
    case 'PROGRAMA_PAUSADO':
      return {
        titulo: 'Programa en pausa',
        detalle:
          'El periodo de prueba terminó. Las tarjetas de tus clientes están guardadas; al activar tu plan se vuelve a sellar.',
      };
  }
}

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** "2026-09-17" → "17 sep 2026". */
export function formatoFechaCorta(fecha: string): string {
  if (!esFechaValida(fecha)) return fecha;
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}
