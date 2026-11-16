import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma, programaVigente } from '@wl/database';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { Portada } from '../../Portada';
import { exigirNegocio, ruta } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Únete al programa' };
export const dynamic = 'force-dynamic';

/**
 * Destino del código QR impreso en el mostrador de cada sucursal.
 *
 * Es la misma portada; lo único que cambia es que la tarjeta queda registrada
 * con la sucursal donde se creó, para saber qué mostrador afilia más.
 */
export default async function UnetePage({ params }: { params: Promise<{ sucursal: string }> }) {
  const { sucursal: slug } = await params;
  if (await tarjetaDeEsteNavegador()) redirect(await ruta('/lealtad/tarjeta'));

  const sucursal = await prisma.branch.findFirst({
    where: { slug },
    select: { slug: true, name: true, isActive: true },
  });
  if (!sucursal || !sucursal.isActive) notFound();

  return (
    <Portada
      sucursal={{ slug: sucursal.slug, nombre: sucursal.name }}
      programa={await programaVigente()}
      frase={(await exigirNegocio()).marca.frase}
    />
  );
}
