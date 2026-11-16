'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { resolver, type EstadoRevision } from './acciones';

const INICIAL: EstadoRevision = { error: null, ok: false };

function Boton({ valor, texto, clase }: { valor: string; texto: string; clase: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={valor}
      disabled={pending}
      className={`min-h-[40px] rounded-sm px-4 text-sm font-semibold disabled:opacity-50 ${clase}`}
    >
      {texto}
    </button>
  );
}

/** Aprobar suma la estampa con la fecha real de compra; rechazar pide un motivo. */
export function Revisar({ id }: { id: string }) {
  const [estado, accion] = useActionState(resolver, INICIAL);
  const [rechazando, setRechazando] = useState(false);

  if (estado.ok) return <p className="text-sm font-semibold text-disponible">Resuelto.</p>;

  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      {rechazando && (
        <label className="grid gap-1 text-xs font-semibold text-ink">
          Motivo del rechazo
          <input
            name="motivo"
            required
            minLength={5}
            placeholder="Por ejemplo: el ticket de la foto no coincide"
            className="min-h-[40px] rounded-sm border-[1.5px] border-rule bg-white px-2 text-sm font-normal"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {!rechazando && <Boton valor="aprobar" texto="Aprobar y sumar" clase="bg-ink text-cream" />}
        {rechazando ? (
          <>
            <Boton valor="rechazar" texto="Confirmar rechazo" clase="bg-danger text-cream" />
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="min-h-[40px] px-2 text-sm text-crust-dark underline"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="min-h-[40px] rounded-sm border-[1.5px] border-ink px-4 text-sm font-semibold text-ink"
          >
            Rechazar
          </button>
        )}
      </div>
      {estado.error && <p className="text-xs font-semibold text-danger">{estado.error}</p>}
    </form>
  );
}
