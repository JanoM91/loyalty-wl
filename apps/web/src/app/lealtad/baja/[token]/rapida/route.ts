import { darDeBajaPromociones } from '@wl/database';

import { tarjetaDeLaBaja } from '@/lib/mensajes';
import { exigirNegocio } from '@/lib/negocio';

/**
 * Baja de un toque (`List-Unsubscribe-Post`): Gmail y otros la mandan por
 * POST desde su botón «Cancelar suscripción», sin abrir la página.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const [{ token }, negocio] = await Promise.all([params, exigirNegocio()]);
  const cardId = await tarjetaDeLaBaja(negocio.id, token);
  if (!cardId) return new Response('Enlace no válido', { status: 404 });
  await darDeBajaPromociones(cardId);
  return new Response('Listo', { status: 200 });
}
