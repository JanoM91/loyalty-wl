'use client';

import { useActionState } from 'react';

import { recargarAlTerminar } from '@/lib/recargar-al-terminar';

import { actualizarEstados, borrarPlantilla, cancelarAviso, type EstadoEntregas } from './acciones';

const INICIAL: EstadoEntregas = { mensaje: null };
const cancelarYRecargar = recargarAlTerminar(cancelarAviso, (e) => e.recargar);
const borrarYRecargar = recargarAlTerminar(borrarPlantilla, (e) => e.recargar);
const actualizarYRecargar = recargarAlTerminar(actualizarEstados, (e) => e.recargar);
const BOTON =
  'min-h-[40px] rounded-full border-[1.5px] border-[#E8D8C6] bg-white px-4 text-[14px] font-semibold text-ink hover:border-ink disabled:opacity-50';

function Mensaje({ estado }: { estado: EstadoEntregas }) {
  return estado.mensaje ? (
    <p role="alert" className="text-[14px] text-[#8C231B]">
      {estado.mensaje}
    </p>
  ) : null;
}

export function CancelarAviso({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(cancelarYRecargar, INICIAL);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={enviando || Boolean(estado.recargar)} className={BOTON}>
        {enviando ? 'Cancelando…' : 'Cancelar envío'}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function BorrarPlantilla({ id, nombre }: { id: string; nombre: string }) {
  const [estado, accion, enviando] = useActionState(borrarYRecargar, INICIAL);
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nombre" value={nombre} />
      <button
        type="submit"
        aria-label={`Borrar la plantilla ${nombre}`}
        disabled={enviando || Boolean(estado.recargar)}
        className="min-h-[36px] text-[13px] text-[#5A4F63] underline underline-offset-4 hover:text-ink"
      >
        Borrar
      </button>
    </form>
  );
}

export function ActualizarEstados({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(actualizarYRecargar, INICIAL);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={enviando || Boolean(estado.recargar)} className={BOTON}>
        {enviando ? 'Preguntando a Resend…' : 'Actualizar estados'}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}
