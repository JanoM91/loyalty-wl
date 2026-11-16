import { eliminarRegistro, registrarDispositivo } from '@wl/database';

import { negocioDeLaPeticion } from '@/lib/negocio';
import {
  esNuestroPassType,
  identificadorValido,
  noAutorizado,
  noEncontrado,
  tarjetaAutenticada,
} from '@/lib/wallet/apple/servicio';

/**
 * Registro de un iPhone para recibir avisos de una tarjeta.
 *
 * Apple llama aquí cuando la persona agrega el pase a Wallet (POST, con su
 * token de notificaciones en el cuerpo) y cuando lo quita (DELETE).
 * Documentación: PassKit Web Service Reference, "Registering a Device".
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> };

async function valida(deviceId: string, passTypeId: string): Promise<boolean> {
  return (
    esNuestroPassType(passTypeId) &&
    identificadorValido(deviceId) &&
    (await negocioDeLaPeticion()) !== null
  );
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { deviceId, passTypeId, serial } = await params;
  if (!(await valida(deviceId, passTypeId))) return noEncontrado();

  const cardId = await tarjetaAutenticada(req, serial);
  if (!cardId) return noAutorizado();

  let pushToken = '';
  try {
    const cuerpo = (await req.json()) as { pushToken?: unknown };
    pushToken = typeof cuerpo.pushToken === 'string' ? cuerpo.pushToken.trim() : '';
  } catch {
    /* sin cuerpo */
  }
  if (!/^[A-Za-z0-9]{16,255}$/.test(pushToken)) {
    return new Response(null, { status: 400 });
  }

  const r = await registrarDispositivo({ deviceLibraryId: deviceId, pushToken, cardId });
  return new Response(null, { status: r === 'CREADO' ? 201 : 200 });
}

export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const { deviceId, passTypeId, serial } = await params;
  if (!(await valida(deviceId, passTypeId))) return noEncontrado();

  const cardId = await tarjetaAutenticada(req, serial);
  if (!cardId) return noAutorizado();

  await eliminarRegistro(deviceId, cardId);
  return new Response(null, { status: 200 });
}
