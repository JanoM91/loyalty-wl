import { headers } from 'next/headers';

import { Cargando } from '@/components/Cargando';
import { CABECERA_NEGOCIO } from '@/lib/negocio';

/**
 * Mientras carga una página: el sitio de club-lealtad lleva su logotipo en
 * movimiento; la página de inicio de un club, la variante con sus colores.
 * Solo lee la cabecera del negocio (sin ir a la base) para no retrasarse.
 */
export default async function Cargandose() {
  const negocio = (await headers()).get(CABECERA_NEGOCIO);
  return <Cargando variante={negocio ? 'negocio' : 'club'} />;
}
