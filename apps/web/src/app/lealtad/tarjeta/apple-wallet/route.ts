import { redirect } from 'next/navigation';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { ruta } from '@/lib/negocio';
import { appleWalletConfigurado } from '@/lib/wallet/apple/config';
import { responderPase } from '@/lib/wallet/apple/servicio';

/**
 * Descarga del pase para la tarjeta de este navegador.
 *
 * Es la dirección del botón «Agregar a Apple Wallet». Safari reconoce el tipo
 * de archivo y abre la hoja de Wallet. Si no hay sesión, de vuelta a la
 * portada, igual que las páginas de la tarjeta. La instalación real queda en
 * `wallet_registration` cuando el iPhone registra el pase.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (!appleWalletConfigurado()) return new Response(null, { status: 404 });
  const cardId = await tarjetaDeEsteNavegador();
  if (!cardId) redirect(await ruta('/lealtad'));
  try {
    return await responderPase(cardId, req, true);
  } catch (e) {
    console.error('[wallet] no se pudo firmar el pase de Apple', e);
    return new Response(
      'No pudimos preparar tu tarjeta para Apple Wallet. Inténtalo de nuevo en un momento.',
      { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
}
