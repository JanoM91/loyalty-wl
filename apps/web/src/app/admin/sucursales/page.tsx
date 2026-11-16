import type { Metadata } from 'next';
import { prisma } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { FichaSucursal, type DatosSucursal } from './FichaSucursal';
import { NuevaSucursal } from './NuevaSucursal';

export const metadata: Metadata = { title: 'Sucursales' };
export const dynamic = 'force-dynamic';

export default async function SucursalesAdminPage() {
  const sesion = await exigirRol(['ADMIN', 'DUENO', 'GERENTE']);

  /**
   * Se consulta directo y no con `findActiveBranches`, que es la consulta del
   * sitio público: aquella no trae el código postal, y un formulario que no
   * carga un campo lo borra al guardar.
   */
  const sucursales = await prisma.branch.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      name: true,
      addressLine: true,
      neighborhood: true,
      postalCode: true,
      phone: true,
      whatsapp: true,
    },
    orderBy: { name: 'asc' },
  });

  const filas: DatosSucursal[] = sucursales.map((s) => ({
    slug: s.slug,
    nombre: s.name,
    calle: s.addressLine,
    colonia: s.neighborhood,
    cp: s.postalCode,
    telefono: s.phone ?? '',
    // Se muestra sin el 52 inicial: es como dicta su número quien lo dicta.
    whatsapp: s.whatsapp?.replace(/^52/, '') ?? '',
  }));

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/sucursales"
      titulo="Sucursales"
      descripcion="Dirección, teléfono y WhatsApp de cada sucursal."
    >
      <div className="space-y-5">
        {filas.map((s) => (
          <FichaSucursal key={s.slug} sucursal={s} />
        ))}
        {(sesion.rol === 'ADMIN' || sesion.rol === 'DUENO') && <NuevaSucursal />}
      </div>
    </MarcoPanel>
  );
}
