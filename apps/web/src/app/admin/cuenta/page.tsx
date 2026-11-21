import type { Metadata } from 'next';
import { ETIQUETA_ROL, LONGITUD_MINIMA_CONTRASENA, leerUsuario } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirSesion } from '@/lib/admin/sesion';
import { FormularioCuenta } from './FormularioCuenta';

export const metadata: Metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

/** Datos de la cuenta propia y cambio de contraseña. Cualquier rol entra. */
export default async function CuentaPage() {
  const sesion = await exigirSesion();
  const yo = await leerUsuario(sesion.userId);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/cuenta"
      titulo="Mi cuenta"
      descripcion="Tu nombre, correo y rol los cambia administración. La contraseña la cambias tú."
    >
      <dl className="mb-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Nombre</dt>
        <dd className="text-ink">{sesion.nombre || 'Sin nombre'}</dd>
        <dt className="text-muted">Correo</dt>
        <dd className="break-all text-ink">{sesion.email}</dd>
        <dt className="text-muted">Rol</dt>
        <dd className="text-ink">
          {ETIQUETA_ROL[sesion.rol]}
          {yo?.sucursal ? ` · ${yo.sucursal.nombre}` : ''}
        </dd>
      </dl>

      <h2 className="mb-3 font-display text-lg text-ink">Cambiar contraseña</h2>
      <FormularioCuenta email={sesion.email} minimo={LONGITUD_MINIMA_CONTRASENA} />
    </MarcoPanel>
  );
}
