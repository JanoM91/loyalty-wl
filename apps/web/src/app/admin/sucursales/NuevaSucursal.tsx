'use client';

import { useActionState } from 'react';

import { crearSucursal, type EstadoNueva } from './acciones';

const CAMPO =
  'min-h-[48px] w-full border border-rule bg-cream px-3.5 text-[15px] text-ink placeholder:text-muted';

/** Formulario para abrir una sucursal. Solo Administración y Dueño. */
export function NuevaSucursal() {
  const [estado, accion, enviando] = useActionState<EstadoNueva, FormData>(crearSucursal, {
    ok: false,
    error: null,
  });
  return (
    <form action={accion} className="grid gap-4 border-t border-rule pt-6">
      <h2 className="text-xl text-ink">Nueva sucursal</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[14px] text-muted">
          Nombre
          <input name="nombre" required className={CAMPO} />
        </label>
        <label className="grid gap-1.5 text-[14px] text-muted">
          Ciudad
          <input name="ciudad" className={CAMPO} />
        </label>
        <label className="grid gap-1.5 text-[14px] text-muted">
          Calle y número
          <input name="calle" className={CAMPO} />
        </label>
        <label className="grid gap-1.5 text-[14px] text-muted">
          Colonia
          <input name="colonia" className={CAMPO} />
        </label>
      </div>
      {estado.error && (
        <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p
          role="status"
          className="border-l-[3px] border-disponible px-3 py-2 text-[15px] text-ink"
        >
          Sucursal creada. Para que sume estampas, enciéndela en Programa, en «Sucursales y
          códigos».
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="min-h-[48px] justify-self-start rounded-full bg-ink px-6 text-[15px] font-semibold text-cream disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear sucursal'}
      </button>
    </form>
  );
}
