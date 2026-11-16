import {
  idDeTarjetaPorAcreditacion,
  idDeTarjetaPorCodigo,
  marcarTarjetasActualizadas,
  tarjetasConPase,
} from '@wl/database';

import { appleWalletConfigurado } from './apple/config';
import { avisarCambioDeTarjeta as avisarApple } from './apple/notificar';
import { actualizarObjetoGoogle } from './google/api';
import { googleWalletConfigurado } from './google/config';

/**
 * Un solo punto para avisar a los pases (Apple y Google) de que una tarjeta
 * cambió. Se llama después de responder a la caja, con `after()` de Next,
 * dentro de la petición del negocio. Nunca lanza.
 */

export async function avisarCambioDeTarjeta(cardId: string): Promise<void> {
  try {
    await Promise.all([
      appleWalletConfigurado() ? avisarApple(cardId) : Promise.resolve(0),
      googleWalletConfigurado() ? actualizarObjetoGoogle(cardId) : Promise.resolve(),
    ]);
  } catch (e) {
    console.warn('[wallet] no se pudo avisar a los pases', e);
  }
}

function hayAlgunPase(): boolean {
  return appleWalletConfigurado() || googleWalletConfigurado();
}

/** Variante para la caja, que conoce el código de la tarjeta y no su id. */
export async function avisarCambioPorCodigo(codigo: string): Promise<void> {
  if (!hayAlgunPase()) return;
  const id = await idDeTarjetaPorCodigo(codigo).catch(() => null);
  if (id) await avisarCambioDeTarjeta(id);
}

/** Variante para la revisión de pendientes, que conoce la acreditación. */
export async function avisarCambioPorAcreditacion(accrualId: string): Promise<void> {
  if (!hayAlgunPase()) return;
  const id = await idDeTarjetaPorAcreditacion(accrualId).catch(() => null);
  if (id) await avisarCambioDeTarjeta(id);
}

/**
 * Pide a todos los pases instalados del negocio que se actualicen. Sirve
 * cuando cambia algo que todos muestran: la marca (colores, logotipo, nombre).
 * De a 10 a la vez; nunca lanza.
 */
export async function actualizarTodosLosPases(): Promise<number> {
  if (!hayAlgunPase()) return 0;
  try {
    const ids = await tarjetasConPase();
    await marcarTarjetasActualizadas(ids);
    for (let i = 0; i < ids.length; i += 10) {
      await Promise.all(ids.slice(i, i + 10).map((id) => avisarCambioDeTarjeta(id)));
    }
    return ids.length;
  } catch (e) {
    console.warn('[wallet] no se pudieron actualizar los pases', e);
    return 0;
  }
}
