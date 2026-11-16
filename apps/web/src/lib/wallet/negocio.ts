import { prisma, programaVigente, type Negocio } from '@wl/database';
import type { ProgramaLealtad } from '@wl/domain';

import type { MarcaImagen, ProgramaImagen } from './imagenes';

/**
 * Lo que los pases toman del negocio: marca, programa y sucursales. Un solo
 * lugar para que Apple y Google muestren lo mismo.
 */

export function marcaDeImagen(negocio: Negocio): MarcaImagen {
  const c = negocio.marca.colores;
  return {
    nombre: negocio.nombre,
    fondo: c.fondo,
    sobreFondo: c.sobreFondo,
    acento: c.acento,
    logoUrl: negocio.marca.logoClaroUrl,
    iconoUrl: negocio.marca.iconoUrl,
  };
}

export function programaDeImagen(programa: ProgramaLealtad): ProgramaImagen {
  return { posiciones: programa.posiciones, hitos: programa.hitos.map((h) => h.posicion) };
}

/** Correo o WhatsApp de ayuda que el negocio publicó, o null. */
export function ayudaDelNegocio(negocio: Negocio): string | null {
  const { correo, whatsapp } = negocio.marca.contacto;
  if (correo) return correo;
  if (whatsapp) return `WhatsApp +${whatsapp}`;
  return null;
}

export async function sucursalesParticipantes(): Promise<string[]> {
  const filas = await prisma.branch.findMany({
    where: { isActive: true, loyaltyEnabled: true },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return filas.map((f) => f.name);
}

export { programaVigente };
