import { autenticarPase } from '@wl/database';

import { configAppleWallet } from './config';
import { generarPase, TIPO_MIME_PASE } from './pase';

/**
 * Piezas comunes del servicio web de PassKit.
 *
 * Apple llama a cuatro direcciones bajo `webServiceURL`/v1 y en todas, salvo
 * el registro de errores, manda `Authorization: ApplePass <token>`. El token
 * es el de la tarjeta (`authenticationToken` del pase). Si no coincide, Apple
 * espera 401 y deja de intentar.
 */

export const sinContenido = () => new Response(null, { status: 204 });
export const noAutorizado = () => new Response(null, { status: 401 });
export const noEncontrado = () => new Response(null, { status: 404 });
export const noDisponible = () => new Response(null, { status: 503 });

/** Comprueba que el pase que pide Apple es de nuestro tipo. */
export function esNuestroPassType(passTypeId: string): boolean {
  return configAppleWallet()?.passTypeId === passTypeId;
}

/** El token de la cabecera `Authorization: ApplePass …`, o null. */
export function tokenDeCabecera(req: Request): string | null {
  const valor = req.headers.get('authorization') ?? '';
  const m = /^ApplePass\s+(\S+)$/i.exec(valor);
  return m?.[1] ?? null;
}

/** La tarjeta (serial) autenticada con el token de la petición, o null. */
export async function tarjetaAutenticada(req: Request, serial: string): Promise<string | null> {
  const token = tokenDeCabecera(req);
  if (!token) return null;
  return autenticarPase(serial, token);
}

/** Los identificadores que manda Apple son cadenas cortas sin espacios. */
export function identificadorValido(s: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(s);
}

/**
 * Responde con el pase, o 304 si Apple ya tiene la versión más reciente.
 *
 * `If-Modified-Since` llega con precisión de segundos; se compara así.
 */
export async function responderPase(
  cardId: string,
  req: Request,
  comoDescarga = false,
): Promise<Response> {
  const pase = await generarPase(cardId);
  if (!pase) return noDisponible();

  const segundos = Math.floor(pase.actualizado.getTime() / 1000);
  const desde = req.headers.get('if-modified-since');
  if (desde) {
    const t = Date.parse(desde);
    if (!Number.isNaN(t) && Math.floor(t / 1000) >= segundos) {
      return new Response(null, { status: 304 });
    }
  }

  const cabeceras: Record<string, string> = {
    'Content-Type': TIPO_MIME_PASE,
    'Last-Modified': new Date(segundos * 1000).toUTCString(),
    'Cache-Control': 'private, no-store',
  };
  if (comoDescarga) {
    cabeceras['Content-Disposition'] = `attachment; filename="${pase.negocio}-${pase.codigo}.pkpass"`;
  }
  return new Response(new Uint8Array(pase.archivo), { status: 200, headers: cabeceras });
}
