import {
  esNuestroPassType,
  noAutorizado,
  noEncontrado,
  responderPase,
  tarjetaAutenticada,
} from '@/lib/wallet/apple/servicio';
import { negocioDeLaPeticion } from '@/lib/negocio';

/**
 * La versión más reciente del pase.
 *
 * Wallet la pide después de que el registro le dijo que cambió. Si manda
 * `If-Modified-Since` y no hay nada nuevo, 304 y no se firma nada.
 *
 * Como todo el servicio web de PassKit, esta ruta se atiende dentro de un
 * negocio: el pase lleva la dirección `…/<negocio>/api/wallet/apple`.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ passTypeId: string; serial: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { passTypeId, serial } = await params;
  if (!esNuestroPassType(passTypeId) || !(await negocioDeLaPeticion())) return noEncontrado();

  const cardId = await tarjetaAutenticada(req, serial);
  if (!cardId) return noAutorizado();

  return responderPase(cardId, req);
}
