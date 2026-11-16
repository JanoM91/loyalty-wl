import type { Metadata } from 'next';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_CAJA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { FormularioAcceso } from './FormularioAcceso';

export const metadata: Metadata = { title: 'Reponer acceso a una tarjeta' };
export const dynamic = 'force-dynamic';

/**
 * Reponer el acceso a una tarjeta desde la caja o el panel.
 *
 * Para quien cambió de celular, cerró sesión o borró el navegador y no puede
 * recibir el enlace por correo (se dio de alta solo con celular, o ya no entra
 * a ese buzón). El personal genera un QR de un solo uso con la persona
 * enfrente; ella lo escanea y la tarjeta se abre en su celular.
 */
export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ tarjeta?: string }>;
}) {
  const sesion = await exigirRol(ROLES_CAJA);
  const { tarjeta } = await searchParams;

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad/caja"
      titulo="Reponer acceso a una tarjeta"
      descripcion="Para clientes que ya no tienen su tarjeta abierta en el celular."
      acciones={
        <a
          href="/admin/lealtad/caja"
          className="text-sm text-crust-dark underline underline-offset-4"
        >
          ← Volver a la caja
        </a>
      }
    >
      <FormularioAcceso inicial={tarjeta ?? ''} />
    </MarcoPanel>
  );
}
