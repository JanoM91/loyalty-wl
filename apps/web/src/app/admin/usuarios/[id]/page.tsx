import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { leerUsuario, ROLES_USUARIOS } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaLarga, hora } from '@/lib/lealtad/formato';
import { opcionesRol, opcionesSucursal } from '../datos';
import { estadoAcceso } from '../EstadoAcceso';
import { EdicionUsuario } from '../FormularioUsuario';
import { AccesoUsuario } from './AccesoUsuario';

export const metadata: Metadata = { title: 'Usuario' };
export const dynamic = 'force-dynamic';

const instante = (d: Date) => `${fechaLarga(d)}, ${hora(d)}`;

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const { id } = await params;
  const [u, sucursales] = await Promise.all([leerUsuario(id), opcionesSucursal()]);
  if (!u) notFound();

  const esUnoMismo = u.id === sesion.userId;
  const estado = estadoAcceso(u);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/usuarios"
      miga={{ texto: 'Equipo', ruta: '/admin/usuarios' }}
      titulo={u.nombre}
      descripcion={u.email}
      acciones={
        <a href="/admin/usuarios" className="text-sm text-ink underline underline-offset-4">
          Volver a Usuarios
        </a>
      }
    >
      <section className="mb-8 rounded-sm border border-rule bg-cream px-5 py-5">
        <h2 className="font-display text-lg text-ink">Acceso</h2>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">{estado.texto}.</span> {estado.detalle}
          {u.enlaceVigenteHasta && ` El enlace vigente vence el ${instante(u.enlaceVigenteHasta)}.`}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {u.correoVerificado
            ? 'Correo confirmado: si olvida su contraseña, puede pedir un enlace desde la pantalla de acceso.'
            : 'Correo sin confirmar: si olvida su contraseña, no puede recuperarla sola; tendrás que mandarle un enlace desde aquí. Se confirma cuando usa un enlace que le llegó por correo.'}
        </p>
        <div className="mt-4">
          {u.activo ? (
            <AccesoUsuario
              id={u.id}
              nombre={u.nombre}
              email={u.email}
              tieneContrasena={u.tieneContrasena}
            />
          ) : (
            <p className="text-sm text-muted">Activa la cuenta para poder mandarle un enlace.</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-display text-lg text-ink">Datos y rol</h2>
        <EdicionUsuario
          id={u.id}
          guardados={{
            email: u.email,
            nombre: u.nombre,
            rol: u.rol,
            sucursalId: u.sucursal?.id ?? '',
            activo: u.activo,
          }}
          roles={opcionesRol()}
          sucursales={sucursales}
          esUnoMismo={esUnoMismo}
        />
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg text-ink">Actividad</h2>
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted">Alta</dt>
          <dd>{instante(u.alta)}</dd>
          <dt className="text-muted">Contraseña elegida</dt>
          <dd>
            {u.contrasenaDesde
              ? instante(u.contrasenaDesde)
              : u.tieneContrasena
                ? 'Antes de este registro'
                : 'Todavía no'}
          </dd>
          <dt className="text-muted">Último acceso</dt>
          <dd>{u.ultimoAcceso ? instante(u.ultimoAcceso) : 'Nunca'}</dd>
        </dl>
      </section>
    </MarcoPanel>
  );
}
