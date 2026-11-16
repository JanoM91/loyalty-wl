'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { guardarSucursal, type EstadoSucursal } from './acciones';

const INICIAL: EstadoSucursal = { error: null, ok: false };

export interface DatosSucursal {
  readonly slug: string;
  readonly nombre: string;
  readonly calle: string;
  readonly colonia: string;
  readonly cp: string;
  readonly telefono: string;
  readonly whatsapp: string;
}

export function FichaSucursal({ sucursal }: { sucursal: DatosSucursal }) {
  const [estado, accion] = useActionState(guardarSucursal, INICIAL);

  const faltaContacto = !sucursal.telefono && !sucursal.whatsapp;

  return (
    <form
      action={accion}
      className={[
        'border px-5 py-5',
        faltaContacto && !estado.ok ? 'border-agotado/40 bg-agotado/5' : 'border-rule bg-cream',
      ].join(' ')}
    >
      <input type="hidden" name="slug" value={sucursal.slug} />

      <h2 className="font-display text-lg text-ink">{sucursal.nombre}</h2>

      {faltaContacto && !estado.ok && (
        <p className="mt-1.5 text-xs text-agotado">
          Sin teléfono ni WhatsApp, esta sucursal no muestra ningún botón para contactarla.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo id={`calle-${sucursal.slug}`} etiqueta="Calle y número">
          <input
            id={`calle-${sucursal.slug}`}
            name="calle"
            type="text"
            required
            defaultValue={sucursal.calle}
            className={entrada}
          />
        </Campo>

        <Campo id={`colonia-${sucursal.slug}`} etiqueta="Colonia">
          <input
            id={`colonia-${sucursal.slug}`}
            name="colonia"
            type="text"
            required
            defaultValue={sucursal.colonia}
            className={entrada}
          />
        </Campo>

        <Campo id={`cp-${sucursal.slug}`} etiqueta="Código postal">
          <input
            id={`cp-${sucursal.slug}`}
            name="cp"
            type="text"
            inputMode="numeric"
            required
            defaultValue={sucursal.cp}
            className={entrada}
          />
        </Campo>

        <Campo
          id={`tel-${sucursal.slug}`}
          etiqueta="Teléfono"
          ayuda="Diez dígitos. Puedes escribirlo con espacios."
        >
          <input
            id={`tel-${sucursal.slug}`}
            name="telefono"
            type="tel"
            defaultValue={sucursal.telefono}
            placeholder="228 818 5964"
            className={entrada}
          />
        </Campo>

        <Campo
          id={`wa-${sucursal.slug}`}
          etiqueta="WhatsApp"
          ayuda="El número tal cual. Yo le pongo el 52 delante."
        >
          <input
            id={`wa-${sucursal.slug}`}
            name="whatsapp"
            type="tel"
            defaultValue={sucursal.whatsapp}
            placeholder="228 818 5964"
            className={entrada}
          />
        </Campo>
      </div>

      {estado.error && (
        <p role="alert" className="mt-4 border-l-[3px] border-agotado px-3 py-2 text-sm text-ink">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="mt-4 border-l-[3px] border-disponible px-3 py-2 text-sm text-ink-soft">
          Guardado.
        </p>
      )}

      <Guardar />
    </form>
  );
}

const entrada =
  'mt-1.5 min-h-[48px] w-full rounded-sm border border-rule bg-cream px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-muted">{ayuda}</p>}
    </div>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 inline-flex min-h-[48px] items-center rounded-sm bg-ink px-6 font-medium text-cream disabled:opacity-60"
    >
      {pending ? 'Guardando…' : 'Guardar'}
    </button>
  );
}
