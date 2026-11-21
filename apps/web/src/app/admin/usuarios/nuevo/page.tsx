import type { Metadata } from 'next';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_USUARIOS } from '@wl/database';
import { exigirRol } from '@/lib/admin/sesion';
import { opcionesRol, opcionesSucursal } from '../datos';
import { AltaUsuario } from '../FormularioUsuario';

export const metadata: Metadata = { title: 'Nuevo usuario' };
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
      descripcion="Una cuenta por persona: así la bitácora dice quién hizo cada cosa. Para la tableta de caja de una sucursal, una cuenta con rol Sucursal."
      acciones={
        <a href="/admin/usuarios" className="text-sm text-ink underline underline-offset-4">
          Volver a Usuarios
        </a>
      }
    >
      <AltaUsuario roles={opcionesRol()} sucursales={sucursales} />
    </MarcoPanel>
  );
}
