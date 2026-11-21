/**
 * Medición de la campaña con el pixel de Meta.
 *
 * Apagada mientras no exista `NEXT_PUBLIC_META_PIXEL_ID` (se lee al
 * construir: cambiarla pide volver a publicar). Solo corre en las páginas del
 * sitio club-lealtad.com, nunca en las tarjetas ni en los paneles de los
 * clubes: esos datos son de cada negocio y de sus clientes.
 *
 * Al encenderla, el aviso de privacidad muestra solo los apartados de
 * medición (ver `app/privacidad/page.tsx`).
 */

export const PIXEL_META: string | null =
  (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '').replace(/\D/g, '') || null;

export const MEDICION_ACTIVA = PIXEL_META !== null;

/** Eventos estándar de Meta; cualquier otro va como evento propio. */
const ESTANDAR = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'Contact',
  'CompleteRegistration',
  'StartTrial',
]);

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Carga el pixel una sola vez (código base de Meta, sin `eval`). */
export function cargarPixel(): boolean {
  if (!PIXEL_META || typeof window === 'undefined') return false;
  if (window.fbq) return true;
  const fbq: Fbq = (...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  };
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq ??= fbq;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  fbq('init', PIXEL_META);
  return true;
}

/**
 * Registra un evento del embudo. `id` evita contarlo dos veces si la página
 * se recarga (Meta deduplica por `eventID`).
 */
export function medir(evento: string, datos: Record<string, unknown> = {}, id?: string): void {
  if (!cargarPixel()) return;
  window.fbq!(
    ESTANDAR.has(evento) ? 'track' : 'trackCustom',
    evento,
    datos,
    id ? { eventID: id } : {},
  );
}
