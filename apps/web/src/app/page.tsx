import { redirect } from 'next/navigation';
import { negociosActivos, prisma, programaVigente } from '@wl/database';

import { InicioNegocio } from '@/components/inicio/InicioNegocio';
import { InicioPlataforma } from '@/components/inicio/InicioPlataforma';
import { negocioDeLaPeticion, ruta } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

/**
 * Inicio, según la instalación:
 * - Privada (`WL_NEGOCIO_UNICO`): la página de inicio del negocio.
 * - Compartida, en la dirección de un negocio (`/cafe`): su programa.
 * - Compartida, en la raíz: la página del servicio.
 */
export default async function Inicio() {
  const negocio = await negocioDeLaPeticion();

  if (!negocio) {
    const negocios = await negociosActivos();
    return (
      <InicioPlataforma
        negocios={negocios.map((n) => ({ slug: n.slug, nombre: n.nombre, frase: n.marca.frase }))}
      />
    );
  }

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
