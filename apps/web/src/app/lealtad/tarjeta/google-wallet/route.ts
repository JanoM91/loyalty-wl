import { redirect } from 'next/navigation';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { ruta } from '@/lib/negocio';
import { enlaceGoogleWallet } from '@/lib/wallet/google/api';
import { googleWalletConfigurado } from '@/lib/wallet/google/config';

/**
 * «Agregar a Google Wallet» para la tarjeta de este navegador.
 *
 * Crea (o actualiza) el objeto en Google y manda a la persona a la página de
 * guardar de Google Wallet. Si no hay sesión, de vuelta a la portada. La
 * constancia por tarjeta es `google_wallet_object_at`.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!googleWalletConfigurado()) return new Response(null, { status: 404 });
  const cardId = await tarjetaDeEsteNavegador();
  if (!cardId) redirect(await ruta('/lealtad'));

  let enlace: string | null = null;
  try {
    enlace = await enlaceGoogleWallet(cardId);
  } catch (e) {
    console.error('[wallet] Google Wallet falló', e);
    return new Response(
      'No pudimos preparar tu tarjeta para Google Wallet. Inténtalo de nuevo en un momento.',
      { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
  if (!enlace) return new Response(null, { status: 404 });
  redirect(enlace);
}
