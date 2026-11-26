import { origenArcade } from '@wl/domain';
import type { Negocio } from '@wl/database';

import type { TemaSinFuente } from '@/components/lealtad/arcade/Arcade';
import { exigirNegocio } from '@/lib/negocio';

/**
 * El Arcade del club en la tarjeta del cliente.
 *
 * Solo aparece si el club lo tiene pagado o sigue en su prueba (que lo
 * incluye): el cliente no ve una sección que el negocio no tiene.
 */
export async function arcadeVisible(): Promise<boolean> {
  const negocio = await exigirNegocio();
  return origenArcade(negocio.ajustes.arcade, negocio.ajustes.pruebaVence) !== null;
}

/** La inicial del negocio para charolas y reversos: la primera letra o número del nombre. */
function inicial(nombre: string): string {
  const letra = [...nombre.normalize('NFC')].find((c) => /[\p{L}\p{N}]/u.test(c));
  return (letra ?? '★').toLocaleUpperCase('es-MX');
}

/** Los colores de la marca y los productos del club, para pintar los juegos. */
export function temaArcade(
  negocio: Negocio,
  productos: readonly { icono: string }[],
  palabras: readonly string[],
): TemaSinFuente {
  const c = negocio.marca.colores;
  return {
    f: c.fondo,
    s: c.sobreFondo,
    a: c.acento,
    p: c.papel,
    t: c.tinta,
    inicial: inicial(negocio.nombre),
    prods: productos.map((p) => p.icono),
    palabras,
  };
}
