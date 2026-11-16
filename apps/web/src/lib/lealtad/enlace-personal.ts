import { enlacePersonalDeTarjeta } from '@wl/database';
import { origenDeLaPeticion } from '@/lib/negocio';

/**
 * Direcciones del enlace personal permanente («Mi tarjeta»). Las reglas viven
 * en `@wl/database` (`lealtad/enlace-personal.ts`).
 */

export interface ExtrasEnlace {
  /** Enlace de un solo uso que verifica el contacto (bienvenida de la caja). */
  readonly a?: string | null;
}

export async function urlEnlacePersonal(token: string, extras: ExtrasEnlace = {}): Promise<string> {
  const q = new URLSearchParams();
  if (extras.a) q.set('a', extras.a);
  const s = q.toString();
  return `${await origenDeLaPeticion()}/lealtad/mi/${token}${s ? `?${s}` : ''}`;
}

/** La dirección del enlace personal de la tarjeta (lo crea si hace falta). */
export async function urlPersonalDeTarjeta(
  cardId: string,
  extras: ExtrasEnlace = {},
): Promise<string | null> {
  const token = await enlacePersonalDeTarjeta(cardId);
  return token ? urlEnlacePersonal(token, extras) : null;
}
