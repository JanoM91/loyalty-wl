import type { Metadata } from 'next';
import { ROLES_USUARIOS } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio } from '@/lib/negocio';

import { FormularioDatos } from './FormularioDatos';

export const metadata: Metadata = { title: 'Datos del negocio' };
export const dynamic = 'force-dynamic';

/** «Datos del negocio»: contacto y datos para términos y privacidad. */
export default async function DatosPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/datos"
      titulo="Datos del negocio"
      descripcion="Cómo te contactan tus clientes y los datos que piden tus términos y tu aviso de privacidad."
    >
      <FormularioDatos marca={negocio.marca} />
    </MarcoPanel>
  );
}
