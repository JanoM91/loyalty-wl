import type { Metadata } from 'next';
import { programaVigente, ROLES_USUARIOS } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio } from '@/lib/negocio';

import { FormularioMarca } from './FormularioMarca';
import { Logotipos } from './Logotipos';

export const metadata: Metadata = { title: 'Marca y datos' };
export const dynamic = 'force-dynamic';

/** El negocio viste su programa: nombre, diseño, colores y datos de contacto. */
export default async function MarcaPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const [negocio, programa] = await Promise.all([exigirNegocio(), programaVigente()]);
  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/marca"
      titulo="Marca y datos"
      descripcion="Así ven tu programa tus clientes. Los cambios se aplican al guardar."
    >
      <div className="grid gap-12">
        <FormularioMarca nombre={negocio.nombre} marca={negocio.marca} programa={programa} />
        <Logotipos marca={negocio.marca} activo={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
      </div>
    </MarcoPanel>
  );
}
