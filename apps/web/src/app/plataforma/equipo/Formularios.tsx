'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  cambiarEstado,
  cambiarMiContrasena,
  cerrarMisOtrasSesiones,
  fijarContrasena,
  generarEnlace,
  invitar,
  recuperar,
  type EstadoEquipo,
} from './acciones';

const CAMPO = 'min-h-[48px] w-full border border-rule bg-cream px-4 text-[16px] text-ink';
const ETIQUETA = 'grid gap-1.5 text-[14px] text-muted';
const PRINCIPAL =
  'min-h-[48px] rounded-full bg-ink px-6 text-[15px] font-semibold text-cream disabled:opacity-50';
const INICIAL: EstadoEquipo = { error: null, listo: null };

/** Si la acción pide recargar, carga completa de la página. */
function useRecargar(estado: EstadoEquipo) {
  useEffect(() => {
    if (estado.recargar) window.location.assign(estado.recargar);
  }, [estado]);
}

function Resultado({ estado }: { estado: EstadoEquipo }) {
  const [copiado, setCopiado] = useState(false);
  if (estado.error) {
    return (
      <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
        {estado.error}
      </p>
    );
  }
  if (!estado.listo) return null;
  return (
    <div role="status" className="grid gap-2 rounded-[14px] bg-ink p-4 text-cream">
      <p className="text-[15px]">{estado.listo}</p>
      {estado.enlace && (
        <>
          <code className="rounded-md bg-cream/10 px-3 py-2 text-[13px] break-all">
            {estado.enlace}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(estado.enlace!).then(() => setCopiado(true));
            }}
            className="min-h-[40px] justify-self-start rounded-full bg-[#C6FF3D] px-4 text-[14px] font-semibold text-[#120A2A]"
          >
            {copiado ? 'Copiado' : 'Copiar enlace'}
          </button>
          <p className="text-[13px] text-cream/75">
            No se vuelve a mostrar. Mándalo por un medio de confianza.{' '}
            <a
              href={typeof window === 'undefined' ? '#' : window.location.pathname}
              className="underline underline-offset-4"
            >
              Listo
            </a>
          </p>
        </>
      )}
    </div>
  );
}

export function FormularioInvitar() {
  const [estado, accion, enviando] = useActionState(invitar, INICIAL);
  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ETIQUETA}>
          Nombre
          <input name="nombre" required maxLength={160} autoComplete="off" className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          Correo
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            autoComplete="off"
            className={CAMPO}
          />
        </label>
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-[15px] text-ink">
        <input type="checkbox" name="porCorreo" defaultChecked className="h-5 w-5" />
        Mandarle el enlace por correo
      </label>
      <Resultado estado={estado} />
      <div>
        <button type="submit" disabled={enviando} className={PRINCIPAL}>
          {enviando ? 'Invitando…' : 'Invitar'}
        </button>
      </div>
    </form>
  );
}

/** «Generar enlace» en el renglón de una cuenta: lo muestra ahí mismo. */
export function GenerarEnlace({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(generarEnlace, INICIAL);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={enviando}
        className="min-h-[40px] justify-self-start rounded-full border border-rule px-4 text-[14px] text-ink hover:border-ink disabled:opacity-50"
      >
        {enviando ? 'Generando…' : 'Generar enlace de contraseña'}
      </button>
      <Resultado estado={estado} />
    </form>
  );
}

export function FormularioMiContrasena() {
  const [estado, accion, enviando] = useActionState(cambiarMiContrasena, INICIAL);
  return (
    <form action={accion} className="grid max-w-md gap-4">
      <label className={ETIQUETA}>
        Contraseña actual
        <input
          name="actual"
          type="password"
          required
          autoComplete="current-password"
          className={CAMPO}
        />
      </label>
      <label className={ETIQUETA}>
        Contraseña nueva
        <input
          name="nueva"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={CAMPO}
        />
      </label>
      <label className={ETIQUETA}>
        Escríbela otra vez
        <input
          name="confirmacion"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={CAMPO}
        />
      </label>
      <Resultado estado={estado} />
      <div>
        <button type="submit" disabled={enviando} className={PRINCIPAL}>
          {enviando ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState(recuperar, INICIAL);
  if (estado.listo) return <Resultado estado={estado} />;
  return (
    <form action={accion} className="grid gap-4">
      <label className={ETIQUETA}>
        Correo de tu cuenta
        <input name="email" type="email" required autoComplete="username" className={CAMPO} />
      </label>
      <Resultado estado={estado} />
      <button type="submit" disabled={enviando} className={PRINCIPAL}>
        {enviando ? 'Enviando…' : 'Mandarme un enlace'}
      </button>
    </form>
  );
}

export function FormularioNuevaContrasena({ token, email }: { token: string; email: string }) {
  const [estado, accion, enviando] = useActionState(fijarContrasena, INICIAL);
  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {/* Para que el gestor de contraseñas la guarde con su correo. */}
      <input type="email" name="usuario" autoComplete="username" value={email} readOnly hidden />
      <label className={ETIQUETA}>
        Contraseña nueva
        <input
          name="clave"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={CAMPO}
        />
      </label>
      <label className={ETIQUETA}>
        Escríbela otra vez
        <input
          name="confirmacion"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={CAMPO}
        />
      </label>
      <p className="text-[13px] text-muted">
        Al menos 10 caracteres. Una frase que recuerdes es mejor que algo corto y complicado.
      </p>
      <Resultado estado={estado} />
      <button type="submit" disabled={enviando} className={PRINCIPAL}>
        {enviando ? 'Guardando…' : 'Guardar y entrar'}
      </button>
    </form>
  );
}

/** Dar de baja o reactivar una cuenta del equipo. */
export function CambiarEstadoCuenta({ id, activa }: { id: string; activa: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarEstado, INICIAL);
  useRecargar(estado);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activa" value={activa ? '0' : '1'} />
      <button
        type="submit"
        disabled={enviando}
        className="min-h-[40px] justify-self-start rounded-full border border-rule px-4 text-[14px] text-ink hover:border-ink disabled:opacity-50"
      >
        {activa ? 'Dar de baja' : 'Reactivar'}
      </button>
      <Resultado estado={estado} />
    </form>
  );
}

export function CerrarOtrasSesiones() {
  const [estado, accion, enviando] = useActionState(cerrarMisOtrasSesiones, INICIAL);
  return (
    <form action={accion} className="mt-3 grid gap-3">
      <button
        type="submit"
        disabled={enviando}
        className="min-h-[44px] justify-self-start rounded-full border border-rule px-5 text-[15px] text-ink hover:border-ink disabled:opacity-50"
      >
        {enviando ? 'Cerrando…' : 'Cerrar las demás sesiones'}
      </button>
      <Resultado estado={estado} />
    </form>
  );
}
