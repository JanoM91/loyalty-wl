import { appleWalletConfigurado } from './apple/config';
import { googleWalletConfigurado } from './google/config';

/** ¿Hay al menos un Wallet listo? Sin él, los textos hablan solo de la pantalla de inicio. */
export function walletActivo(): boolean {
  return appleWalletConfigurado() || googleWalletConfigurado();
}
