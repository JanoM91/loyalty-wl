import { estadoComercial, fechaDeBorrado, pausadoDesde } from './prueba';

/**
 * Avisos por correo al dueño de un club del asistente (o de un club que ya
 * paga): cuándo le toca cada uno y cómo se recuerda que ya salió.
 *
 * - «Por vencer»: 2 días antes del fin de la prueba, o 3 antes del fin del
 *   periodo pagado.
 * - «Pausa»: en los primeros 3 días de pausa (prueba o pago vencido).
 * - «Borrado»: en los 5 días previos al borrado, solo si el borrado
 *   automático está encendido (si no, nada se borra y el aviso mentiría).
 * - Resumen semanal: cada lunes, a los clubes que no están en pausa.
 *
 * Cada aviso guarda la fecha que lo provocó (fin de prueba o de pago): así
 * sale una vez por ciclo, y vuelve a salir si el club paga y vuelve a vencer.
 */

const DIA = 24 * 60 * 60 * 1000;

export const DIAS_AVISO_PRUEBA = 2;
export const DIAS_AVISO_PAGO = 3;
/** Días de pausa en los que todavía se manda el aviso de pausa. */
export const DIAS_AVISO_PAUSA = 3;
export const DIAS_AVISO_BORRADO = 5;

export interface AvisosDelClub {
  /** Fecha (fin de prueba o de pago) del último aviso «por vencer». */
  readonly porVencer: string | null;
  readonly pausa: string | null;
  readonly borrado: string | null;
  /** Lunes (AAAA-MM-DD) del último resumen semanal. */
  readonly semana: string | null;
  /** El dueño puede apagar el resumen semanal. Encendido por omisión. */
  readonly resumenSemanal: boolean;
}

export const AVISOS_POR_OMISION: AvisosDelClub = {
  porVencer: null,
  pausa: null,
  borrado: null,
  semana: null,
  resumenSemanal: true,
};

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

export function leerAvisos(json: unknown): AvisosDelClub {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return AVISOS_POR_OMISION;
  const a = json as Record<string, unknown>;
  return {
    porVencer: texto(a.porVencer),
    pausa: texto(a.pausa),
    borrado: texto(a.borrado),
    semana: texto(a.semana),
    resumenSemanal: a.resumenSemanal !== false,
  };
}

export type TipoAviso = 'por-vencer' | 'pausa' | 'borrado';

export interface AvisoPendiente {
  readonly tipo: TipoAviso;
  /** Fecha que lo provoca; se guarda para no repetirlo. */
  readonly referencia: string;
  /** ¿El ciclo es de pago (true) o de prueba (false)? */
  readonly pagado: boolean;
  /** Fin de la prueba o del pago (por vencer y pausa) o día del borrado. */
  readonly fecha: Date;
}

/** El aviso que le toca hoy al club, o null. */
export function avisoDeCiclo(
  club: {
    readonly pruebaVence: string | null;
    readonly pagadoHasta: string | null;
    readonly avisos: AvisosDelClub;
    readonly borradoAutomatico: boolean;
  },
  ahora: Date = new Date(),
): AvisoPendiente | null {
  const { pruebaVence, pagadoHasta, avisos } = club;
  const referencia = pagadoHasta ?? pruebaVence;
  if (!referencia) return null;
  const fin = Date.parse(referencia);
  if (Number.isNaN(fin)) return null;
  const pagado = pagadoHasta !== null;
  const estado = estadoComercial(pruebaVence, ahora, pagadoHasta);

  if (estado !== 'PAUSADO') {
    const umbral = (pagado ? DIAS_AVISO_PAGO : DIAS_AVISO_PRUEBA) * DIA;
    if (fin - ahora.getTime() <= umbral && avisos.porVencer !== referencia) {
      return { tipo: 'por-vencer', referencia, pagado, fecha: new Date(fin) };
    }
    return null;
  }

  const desde = pausadoDesde(pruebaVence, pagadoHasta, ahora);
  if (desde && ahora.getTime() - desde.getTime() < DIAS_AVISO_PAUSA * DIA) {
    return avisos.pausa === referencia
      ? null
      : { tipo: 'pausa', referencia, pagado, fecha: new Date(fin) };
  }

  const borrar = fechaDeBorrado(pruebaVence, pagadoHasta, ahora);
  if (
    club.borradoAutomatico &&
    borrar &&
    borrar.getTime() > ahora.getTime() &&
    borrar.getTime() - ahora.getTime() <= DIAS_AVISO_BORRADO * DIA &&
    avisos.borrado !== referencia
  ) {
    return { tipo: 'borrado', referencia, pagado, fecha: borrar };
  }
  return null;
}
