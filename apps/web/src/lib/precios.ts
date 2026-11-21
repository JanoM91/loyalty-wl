import { cache } from 'react';
import { preciosDelServicio } from '@wl/database';
import { PRECIOS_POR_OMISION, pesos, type PrecioPeriodo, type PreciosServicio } from '@wl/domain';

/**
 * Precios del servicio (Lite y Arcade) que fija club-lealtad en /plataforma.
 * Una lectura por petición. Si la base no responde, los de siempre: un precio
 * que falta no debe tumbar el sitio.
 */
export const precios = cache(async (): Promise<PreciosServicio> => {
  try {
    return await preciosDelServicio();
  } catch (e) {
    console.error('[precios] no se pudieron leer; van los de omisión', e);
    return PRECIOS_POR_OMISION;
  }
});

/** "$269 al mes o $2,699 al año"; null si no hay precio publicado. */
export function textoPrecio(p: PrecioPeriodo): string | null {
  if (p.mes !== null && p.anio !== null) return `${pesos(p.mes)} al mes o ${pesos(p.anio)} al año`;
  if (p.mes !== null) return `${pesos(p.mes)} al mes`;
  if (p.anio !== null) return `${pesos(p.anio)} al año`;
  return null;
}
