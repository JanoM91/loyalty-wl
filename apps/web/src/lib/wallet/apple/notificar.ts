import { olvidarDispositivoPorToken, tokensPushDeTarjeta } from '@wl/database';

import { configAppleWallet } from './config';
import { enviarPushPase } from './push';

/**
 * Avisar a los iPhones que tienen el pase de una tarjeta que cambió.
 *
 * La llama `wallet/avisar.ts` después de responder a la caja (con `after()`
 * de Next), para que acreditar no espere a Apple. Si Wallet no está
 * configurado o la tarjeta no tiene el pase instalado, no hace nada. Nunca
 * lanza: un fallo aquí no debe convertirse en un error en el mostrador.
 * Devuelve a cuántos iPhones Apple aceptó el aviso.
 */

export async function avisarCambioDeTarjeta(cardId: string): Promise<number> {
  const config = configAppleWallet();
  if (!config) return 0;
  try {
    const tokens = await tokensPushDeTarjeta(cardId);
    const aceptados = await Promise.all(
      tokens.map(async (token) => {
        const r = await enviarPushPase(token, config);
        if (r.ok) return 1;
        console.warn(`[wallet] push a Apple falló (${r.motivo})`);
        if (r.tokenInvalido) await olvidarDispositivoPorToken(token);
        return 0;
      }),
    );
    return aceptados.reduce<number>((a, b) => a + b, 0);
  } catch (e) {
    console.warn('[wallet] no se pudo avisar del cambio', e);
    return 0;
  }
}
