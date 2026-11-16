import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/admin/sesion';

export const dynamic = 'force-dynamic';

/**
 * Inicio del panel: el programa de lealtad. Las cuentas de sucursal no llegan
 * aquí; `exigirSesion()` las manda a la caja.
 */
export default async function AdminInicioPage() {
  await exigirSesion();
  redirect('/admin/lealtad');
}
