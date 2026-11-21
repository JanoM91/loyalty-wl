'use client';

import { useActionState, useState } from 'react';
import type { UserRole } from '@wl/database';

import {
  Alerta,
  BotonEnviar,
  Campo,
  EnlaceParaCompartir,
  claseEntrada,
} from '@/components/admin/Formulario';
import {
  darDeAlta,
  guardarUsuario,
  type EstadoAlta,
  type EstadoGuardar,
  type Entrega,
  type ValoresUsuario,
} from './acciones';

/**
 * Formularios de alta y edición de usuarios.
 *
 * Los roles y sucursales llegan como datos desde la página (servidor): este
 * archivo corre en el navegador y no puede importar nada que toque la base.
 */

export interface OpcionRol {
  readonly valor: UserRole;
  readonly etiqueta: string;
  readonly descripcion: string;
}

export interface OpcionSucursal {
  readonly id: string;
  readonly nombre: string;
}

function CamposUsuario({
  valores,
  roles,
  sucursales,
  rolBloqueado,
}: {
  valores: ValoresUsuario;
  roles: readonly OpcionRol[];
  sucursales: readonly OpcionSucursal[];
  /** La propia cuenta: su rol no se puede cambiar desde aquí. */
  rolBloqueado: boolean;
}) {
  const [rol, setRol] = useState(valores.rol);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nombre" etiqueta="Nombre">
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            maxLength={160}
            autoComplete="off"
            defaultValue={valores.nombre}
            className={claseEntrada}
          />
        </Campo>
        <Campo id="email" etiqueta="Correo" ayuda="Con este correo entra al panel.">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            spellCheck={false}
            defaultValue={valores.email}
            className={claseEntrada}
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Rol</legend>
        {rolBloqueado && (
          <>
            <input type="hidden" name="rol" value={valores.rol} />
            <p className="mt-1 text-xs text-muted">
              Tu propio rol no se cambia desde aquí: pídeselo a otra persona con rol Dueño.
            </p>
          </>
        )}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <label
              key={r.valor}
              className={[
                'flex cursor-pointer gap-3 rounded-sm border px-3 py-2.5 text-sm',
                rol === r.valor ? 'border-ink bg-cream' : 'border-rule bg-white',
                rolBloqueado ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name={rolBloqueado ? undefined : 'rol'}
                value={r.valor}
                required={!rolBloqueado}
                disabled={rolBloqueado}
                defaultChecked={valores.rol === r.valor}
                onChange={() => setRol(r.valor)}
                className="mt-1 accent-ink"
              />
              <span>
                <span className="block font-medium text-ink">{r.etiqueta}</span>
                <span className="block text-xs text-ink-soft">{r.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {rol === 'SUCURSAL' && (
        <Campo
          id="sucursal"
          etiqueta="Sucursal"
          ayuda="La caja de lealtad y la disponibilidad que use esta cuenta serán de esta sucursal."
        >
          <select
            id="sucursal"
            name="sucursal"
            required
            defaultValue={valores.sucursalId}
            className={claseEntrada}
          >
            <option value="">Elige una sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

const VACIO: ValoresUsuario = { email: '', nombre: '', rol: '', sucursalId: '', entrega: 'correo' };
const INICIAL_ALTA: EstadoAlta = { error: null, valores: null, creado: null };

export function AltaUsuario({
  roles,
  sucursales,
}: {
  roles: readonly OpcionRol[];
  sucursales: readonly OpcionSucursal[];
}) {
  const [estado, accion] = useActionState(darDeAlta, INICIAL_ALTA);

  if (estado.creado) {
    return <ResultadoAlta {...estado.creado} />;
  }

  const valores = estado.valores ?? VACIO;

  return (
    <form action={accion} className="max-w-2xl space-y-6">
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}

      <CamposUsuario valores={valores} roles={roles} sucursales={sucursales} rolBloqueado={false} />

      <fieldset>
        <legend className="text-sm font-medium text-ink">Cómo le llega el acceso</legend>
        <p className="mt-1 text-xs text-muted">
          La contraseña la elige la persona con un enlace de un solo uso. Nadie más la conoce.
        </p>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex gap-3">
            <input
              type="radio"
              name="entrega"
              value="correo"
              defaultChecked={valores.entrega !== 'enlace'}
              className="mt-1 accent-ink"
            />
            <span>
              <span className="block font-medium text-ink">Mandarle la invitación por correo</span>
              <span className="block text-xs text-ink-soft">
                Vence en 3 días. Al usarla queda confirmado su correo y podrá recuperar su
                contraseña sola si la olvida.
              </span>
            </span>
          </label>
          <label className="flex gap-3">
            <input
              type="radio"
              name="entrega"
              value="enlace"
              defaultChecked={valores.entrega === 'enlace'}
              className="mt-1 accent-ink"
            />
            <span>
              <span className="block font-medium text-ink">
                Crear un enlace para compartirlo yo
              </span>
              <span className="block text-xs text-ink-soft">
                Para mandarlo por WhatsApp o abrirlo en la tableta de caja. Úsalo si el correo no es
                un buzón que alguien revise.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <BotonEnviar texto="Dar de alta" enviando="Guardando…" />
    </form>
  );
}

function ResultadoAlta({ id, nombre, entrega }: { id: string; nombre: string; entrega: Entrega }) {
  return (
    <div className="max-w-2xl space-y-5">
      <ResultadoEntrega nombre={nombre} entrega={entrega} alta />
      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href={`/admin/usuarios/${id}`}
          className="inline-flex min-h-[44px] items-center rounded-sm bg-ink px-5 font-medium text-cream"
        >
          Ver su ficha
        </a>
        <a
          href="/admin/usuarios/nuevo"
          className="inline-flex min-h-[44px] items-center rounded-sm border border-ink px-5 font-medium text-ink"
        >
          Dar de alta a otra persona
        </a>
        <a
          href="/admin/usuarios"
          className="inline-flex min-h-[44px] items-center text-ink underline underline-offset-4"
        >
          Volver a Usuarios
        </a>
      </div>
    </div>
  );
}

/** Lo que pasó con el enlace, en palabras de quien lo generó. */
export function ResultadoEntrega({
  nombre,
  entrega,
  alta = false,
}: {
  nombre: string;
  entrega: Entrega;
  alta?: boolean;
}) {
  const quien = nombre.split(' ')[0] ?? nombre;
  const inicio = alta ? `Listo: ${nombre} ya tiene cuenta. ` : '';

  if (entrega.modo === 'correo') {
    return (
      <Alerta tono="ok">
        {inicio}Le mandamos el enlace a <b className="font-medium">{entrega.enviadoA}</b>. Vence en
        3 días y sirve una sola vez; si no le llega, que revise spam o crea aquí un enlace para
        compartir.
      </Alerta>
    );
  }
  if (entrega.modo === 'enlace') {
    return (
      <div>
        <Alerta tono="ok">
          {inicio}Mándale este enlace a {quien} para que elija su contraseña.
        </Alerta>
        <EnlaceParaCompartir enlace={entrega.enlace} vence={entrega.vence} />
      </div>
    );
  }
  return (
    <Alerta tono="error">
      {alta ? `${nombre} quedó dado de alta, pero ` : 'No se generó el enlace: '}
      {entrega.error}
    </Alerta>
  );
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

const INICIAL_GUARDAR: EstadoGuardar = { error: null, aviso: null, valores: null };

export function EdicionUsuario({
  id,
  guardados,
  roles,
  sucursales,
  esUnoMismo,
}: {
  id: string;
  guardados: ValoresUsuario;
  roles: readonly OpcionRol[];
  sucursales: readonly OpcionSucursal[];
  esUnoMismo: boolean;
}) {
  const [estado, accion] = useActionState(guardarUsuario, INICIAL_GUARDAR);
  // Si algo no pasó la validación se muestra lo que se escribió, no lo guardado.
  const valores = estado.valores ?? guardados;

  return (
    <form action={accion} className="max-w-2xl space-y-6">
      <input type="hidden" name="id" value={id} />
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.aviso && <Alerta tono="ok">{estado.aviso}</Alerta>}

      <CamposUsuario
        valores={valores}
        roles={roles}
        sucursales={sucursales}
        rolBloqueado={esUnoMismo}
      />

      <div>
        {esUnoMismo && <input type="hidden" name="activo" value="on" />}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name={esUnoMismo ? undefined : 'activo'}
            defaultChecked={valores.activo}
            disabled={esUnoMismo}
            className="mt-1 accent-ink"
          />
          <span>
            <span className="block font-medium text-ink">Cuenta activa</span>
            <span className="block text-xs text-ink-soft">
              {esUnoMismo
                ? 'No puedes desactivar tu propia cuenta.'
                : 'Al desactivarla, la persona sale del panel en la siguiente pantalla que abra y sus enlaces pendientes dejan de servir. Se puede volver a activar.'}
            </span>
          </span>
        </label>
      </div>

      <BotonEnviar texto="Guardar cambios" enviando="Guardando…" />
    </form>
  );
}
