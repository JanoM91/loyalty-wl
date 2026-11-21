import { firmarEnlace, leerEnlace } from '@/lib/enlaces-firmados';

/**
 * Enlaces de los mensajes del negocio a sus clientes. La baja va firmada con
 * la tarjeta y el negocio: no se guarda en la base y no sirve en otro club.
 */

export function urlBaja(origenClub: string, negocioId: string, cardId: string): string | null {
  const token = firmarEnlace('baja', negocioId, cardId);
  return token ? `${origenClub}/lealtad/baja/${token}` : null;
}

/** La tarjeta del enlace de baja, si la firma es buena. */
export function tarjetaDeLaBaja(negocioId: string, token: string): Promise<string | null> {
  return leerEnlace('baja', negocioId, token);
}
