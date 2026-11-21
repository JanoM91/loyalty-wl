import type { Metadata } from 'next';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_USUARIOS } from '@wl/database';
import { exigirRol } from '@/lib/admin/sesion';
import { opcionesRol, opcionesSucursal } from '../datos';
import { AltaUsuario } from '../FormularioUsuario';

export const metadata: Metadata = { title: 'Invitar a alguien' };
export const dynamic = 'force-dynamic';

export default async function NuevoUsuarioPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const sucursales = await opcionesSucursal();

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/usuarios"
      miga={{ texto: 'Equipo', ruta: '/admin/usuarios' }}
      titulo="Invitar a alguien"
      descripcion="Una cuenta por persona, así sabes quién sumó cada sello. A quien solo atiende la caja, dale el rol Sucursal."
    >
      <AltaUsuario roles={opcionesRol()} sucursales={sucursales} />
    </MarcoPanel>
  );
}
