import { serialesActualizados } from '@wl/database';

import { negocioDeLaPeticion } from '@/lib/negocio';
import {
  esNuestroPassType,
  identificadorValido,
  noEncontrado,
  sinContenido,
} from '@/lib/wallet/apple/servicio';

/**
 * Qué pases de este iPhone cambiaron desde la última vez, en este negocio.
 *
 * Es lo primero que Wallet pregunta al recibir un aviso (y de vez en cuando
 * por su cuenta). `passesUpdatedSince` es la etiqueta que le dimos la vez
 * anterior: usamos la fecha del último cambio en segundos. Si no hay nada
 * nuevo, 204.
 *
 * Esta ruta no lleva token: Apple la llama sin él. Solo revela ids de
 * tarjeta (sin datos personales) a quien conozca el identificador del iPhone.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ deviceId: string; passTypeId: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { deviceId, passTypeId } = await params;
  if (!esNuestroPassType(passTypeId) || !identificadorValido(deviceId)) return noEncontrado();
  if (!(await negocioDeLaPeticion())) return noEncontrado();

  const desdeTexto = new URL(req.url).searchParams.get('passesUpdatedSince');
  const desde =
    desdeTexto && /^\d{1,12}$/.test(desdeTexto) ? new Date(Number(desdeTexto) * 1000) : null;

  const r = await serialesActualizados(deviceId, desde);
  if (!r) return noEncontrado();
  if (r.seriales.length === 0 || !r.ultimaActualizacion) return sinContenido();

  return Response.json({
    lastUpdated: String(Math.floor(r.ultimaActualizacion.getTime() / 1000)),
    serialNumbers: r.seriales,
  });
}
