import type { Metadata } from 'next';
import { ETIQUETA_ROL, listarUsuarios, ROLES_USUARIOS } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaLarga, hora } from '@/lib/lealtad/formato';
import { opcionesRol } from './datos';
import { ChipAcceso } from './EstadoAcceso';

export const metadata: Metadata = { title: 'Equipo' };
export const dynamic = 'force-dynamic';

/** Cuentas del panel. Solo administración las ve y las cambia. */
export default async function UsuariosPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const usuarios = await listarUsuarios();
  const roles = opcionesRol();

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/usuarios"
      titulo="Equipo"
      descripcion="Quién entra al panel y qué puede hacer. Cada persona elige su propia contraseña con un enlace de un solo uso."
      acciones={
        <a
          href="/admin/usuarios/nuevo"
          className="inline-flex min-h-[44px] items-center rounded-[14px] bg-ink px-5 text-sm font-semibold text-cream"
        >
          Invitar a alguien
        </a>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-rule bg-cream">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] text-muted">
              <th className="min-w-[200px] px-3 py-2 font-semibold">Persona</th>
              <th className="px-3 py-2 font-semibold">Rol</th>
              <th className="px-3 py-2 font-semibold">Acceso</th>
              <th className="px-3 py-2 font-semibold">Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-rule last:border-0 hover:bg-crumb ${u.activo ? '' : 'opacity-60'}`}
              >
                <td className="px-3 py-2.5">
                  <a
                    href={`/admin/usuarios/${u.id}`}
                    className="font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {u.nombre || 'Sin nombre'}
                  </a>
                  {u.id === sesion.userId && (
                    <span className="ml-1.5 text-xs text-muted">(tú)</span>
                  )}
                  <span className="block text-xs break-words text-muted">{u.email}</span>
                </td>
                <td className="px-3 py-2.5">
                  {ETIQUETA_ROL[u.rol]}
                  {u.sucursal && (
                    <span className="block text-xs text-muted">{u.sucursal.nombre}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <ChipAcceso usuario={u} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {u.ultimoAcceso ? (
                    <>
                      {fechaLarga(u.ultimoAcceso)}
                      <span className="block text-xs text-muted">{hora(u.ultimoAcceso)}</span>
                    </>
                  ) : (
                    <span className="text-muted">Nunca</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-2 font-display text-lg text-ink">Qué puede hacer cada rol</h2>
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        {roles.map((r) => (
          <div key={r.valor} className="contents">
            <dt className="font-medium text-ink">{r.etiqueta}</dt>
            <dd className="mb-1.5 text-ink-soft sm:mb-0">{r.descripcion}</dd>
          </div>
        ))}
      </dl>
    </MarcoPanel>
  );
}
