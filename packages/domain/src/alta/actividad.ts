/**
 * Uso de cada club, para saber a quién llamar.
 *
 * El panel de plataforma junta, por club, sus visitas y su última actividad.
 * Aquí se decide, sin base de datos, si un club pide una llamada y por qué.
 * Los umbrales son una primera versión: cámbialos aquí cuando haya datos de
 * clubes reales.
 */

export interface UsoDelClub {
  /** Cuándo se creó el club. */
  readonly creado: Date;
  readonly tarjetas: number;
  /** Visitas acreditadas en los últimos 7 días y en los 7 anteriores. */
  readonly visitas7: number;
  readonly visitas7Previas: number;
  readonly visitas30: number;
  readonly ultimaVisita: Date | null;
  readonly ultimaTarjeta: Date | null;
  /** Último acceso al panel de alguien que lo dirige (dueño o gerencia). */
  readonly ultimoAcceso: Date | null;
  /** Alguien que lo dirige ya fijó su contraseña. */
  readonly duenioConContrasena: boolean;
}

export type MotivoDeLlamada =
  /** El dueño nunca entró a su panel. */
  | 'sin-entrar'
  /** Entró, pero ningún cliente tiene tarjeta. */
  | 'sin-tarjetas'
  /** Tiene clientes, pero la caja no ha sumado visitas en dos semanas. */
  | 'sin-visitas'
  /** Las visitas de esta semana cayeron a menos de la mitad que la anterior. */
  | 'bajando';

export const TEXTO_MOTIVO: Record<MotivoDeLlamada, string> = {
  'sin-entrar': 'El dueño no ha entrado a su panel',
  'sin-tarjetas': 'Ningún cliente tiene tarjeta todavía',
  'sin-visitas': 'Sin visitas en 14 días',
  bajando: 'Las visitas cayeron a menos de la mitad',
};

const DIA = 86_400_000;

/** Días completos desde `fecha` hasta `ahora`; null si no hay fecha. */
export function diasDesde(fecha: Date | null, ahora: Date = new Date()): number | null {
  if (!fecha) return null;
  return Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / DIA));
}

/**
 * El motivo más urgente para llamar a un club, o null si va bien. A un club
 * recién creado se le da tiempo: un día para entrar, dos para su primera
 * tarjeta y una semana para que la caja agarre ritmo.
 */
export function motivoDeLlamada(u: UsoDelClub, ahora: Date = new Date()): MotivoDeLlamada | null {
  const edad = diasDesde(u.creado, ahora) ?? 0;
  if ((!u.duenioConContrasena || !u.ultimoAcceso) && edad >= 1) return 'sin-entrar';
  if (u.tarjetas === 0 && edad >= 2) return 'sin-tarjetas';
  if (u.tarjetas > 0 && edad >= 7) {
    const sinVisita = diasDesde(u.ultimaVisita, ahora);
    if (sinVisita === null || sinVisita >= 14) return 'sin-visitas';
  }
  // Solo cuenta con volumen: de 3 a 1 visita no dice mucho.
  if (u.visitas7Previas >= 6 && u.visitas7 * 2 < u.visitas7Previas) return 'bajando';
  return null;
}

/** La fecha más reciente en la que pasó algo en el club (visita, tarjeta o acceso). */
export function ultimaActividad(u: UsoDelClub): Date | null {
  const fechas = [u.ultimaVisita, u.ultimaTarjeta, u.ultimoAcceso].filter(
    (f): f is Date => f !== null,
  );
  if (fechas.length === 0) return null;
  return new Date(Math.max(...fechas.map((f) => f.getTime())));
}
