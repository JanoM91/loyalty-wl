import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma, programaVigente } from '@wl/database';

import { InicioNegocio } from '@/components/inicio/InicioNegocio';
import { Inicio as InicioDelServicio } from '@/components/sitio/Inicio';
import { negocioDeLaPeticion, ruta } from '@/lib/negocio';
import { metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

/** La página del servicio sí se indexa; las de los negocios siguen sin indexarse. */
export async function generateMetadata(): Promise<Metadata> {
  if (await negocioDeLaPeticion()) return {};
  return metadatosDelSitio(
    'Programa de lealtad digital para tu negocio',
    'La tarjeta de sellos de tu negocio en el celular de tus clientes. Sin app y sin papel. Con juegos que dan promociones y mensajes a tus clientes.',
  );
}

/**
 * Inicio, según la instalación:
 * - Privada (`WL_NEGOCIO_UNICO`): la página de inicio del negocio.
 * - Compartida, en la dirección de un negocio (`/cafe`): su programa.
 * - Compartida, en la raíz: la página del servicio.
 */
export default async function Inicio() {
  const negocio = await negocioDeLaPeticion();

  if (!negocio) return <InicioDelServicio />;

  if (!process.env.WL_NEGOCIO_UNICO) redirect(await ruta('/lealtad'));

  const [programa, sucursales] = await Promise.all([
    programaVigente(),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, addressLine: true, neighborhood: true, city: true, phone: true },
    }),
  ]);
  return (
    <InicioNegocio
      negocio={negocio}
      programa={programa}
      sucursales={sucursales.map((s) => ({
        nombre: s.name,
        direccion: [s.addressLine, s.neighborhood, s.city].filter(Boolean).join(', '),
        telefono: s.phone,
      }))}
    />
  );
}
