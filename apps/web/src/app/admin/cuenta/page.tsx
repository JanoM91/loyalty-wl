import type { Metadata } from 'next';
import { ETIQUETA_ROL, LONGITUD_MINIMA_CONTRASENA, leerUsuario } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirSesion } from '@/lib/admin/sesion';
import { exigirNegocio } from '@/lib/negocio';
import { ConfirmarCorreo } from './ConfirmarCorreo';
import { FormularioCuenta } from './FormularioCuenta';
import { ResumenSemanal } from './ResumenSemanal';

export const metadata: Metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

/** Datos de la cuenta propia y cambio de contraseña. Cualquier rol entra. */
export default async function CuentaPage() {
  const sesion = await exigirSesion();
  const [yo, negocio] = await Promise.all([leerUsuario(sesion.userId), exigirNegocio()]);
  // El resumen semanal llega a los dueños de clubes del asistente o que pagan.
  const conResumen =
    (sesion.rol === 'DUENO' || sesion.rol === 'ADMIN') &&
    (negocio.ajustes.alta !== null || negocio.ajustes.pagadoHasta !== null);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/cuenta"
      titulo="Mi cuenta"
      descripcion="Tu nombre, correo y rol los cambia el dueño desde Equipo. La contraseña la cambias tú."
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

      {yo && !yo.correoVerificado && <ConfirmarCorreo email={sesion.email} />}

      {conResumen && <ResumenSemanal encendido={negocio.ajustes.avisos.resumenSemanal} />}

      <h2 className="mb-3 font-display text-lg text-ink">Cambiar contraseña</h2>
      <FormularioCuenta email={sesion.email} minimo={LONGITUD_MINIMA_CONTRASENA} />
    </MarcoPanel>
  );
}
