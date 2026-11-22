'use client';

import { useActionState } from 'react';

import { Alerta } from '@/components/admin/Formulario';
import { cambiarResumenSemanal, type EstadoResumen } from './acciones';

const INICIAL: EstadoResumen = { error: null, aviso: null };

/** Interruptor del resumen semanal por correo del club. */
export function ResumenSemanal({ encendido }: { encendido: boolean }) {
  const [estado, accion, guardando] = useActionState(cambiarResumenSemanal, INICIAL);
  return (
    <form
      action={accion}
      className="mb-8 grid max-w-md gap-3 rounded-[16px] border-[1.5px] border-[#E8D8C6] bg-white p-4"
    >
      <b className="text-[15px] text-ink">Resumen de la semana</b>
      <label className="flex items-start gap-3 text-[14px] text-ink-soft">
        <input
          type="checkbox"
          name="resumen"
          defaultChecked={encendido}
          className="mt-0.5 h-5 w-5 flex-none accent-[#06231C]"
        />
        <span>
          Cada lunes, un correo con las visitas, los clientes, las tarjetas nuevas y los premios de
          la semana anterior.
        </span>
      </label>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.aviso && <Alerta tono="ok">{estado.aviso}</Alerta>}
      <button
        type="submit"
        disabled={guardando}
        className="inline-flex min-h-[44px] items-center justify-center justify-self-start rounded-full border border-ink px-5 text-[14px] font-semibold text-ink disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
