'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Piezas de formulario del panel: mismo aspecto y mismo tamaño táctil en
 * todas las pantallas de usuarios y contraseñas.
 */

export const claseEntrada =
  'mt-1.5 min-h-[48px] w-full rounded-sm border border-rule bg-cream px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60';

export function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: ReactNode;
  children: ReactNode;
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

/** Se desactiva mientras el servidor responde: evita el doble clic. */
export function BotonEnviar({
  texto,
  enviando,
  secundario = false,
  name,
  value,
}: {
  texto: string;
  enviando: string;
  secundario?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={[
        'inline-flex min-h-[48px] items-center justify-center rounded-sm px-5 font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        secundario
          ? 'border border-ink bg-transparent text-ink hover:bg-crumb'
          : 'bg-ink text-cream hover:bg-ink-soft',
      ].join(' ')}
    >
      {pending ? enviando : texto}
    </button>
  );
}

export function Alerta({
  tono,
  children,
}: {
  tono: 'error' | 'ok' | 'aviso';
  children: ReactNode;
}) {
  const borde =
    tono === 'error' ? 'border-agotado' : tono === 'ok' ? 'border-disponible' : 'border-ink-soft';
  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={`border-l-[3px] ${borde} bg-cream px-4 py-3 text-sm text-ink`}
    >
      {children}
    </p>
  );
}

/**
 * Enlace de un solo uso para compartir a mano (WhatsApp, en persona).
 * Se muestra una sola vez: si se pierde, se genera otro.
 */
export function EnlaceParaCompartir({ enlace, vence }: { enlace: string; vence: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles: el campo queda seleccionado para copiarlo a mano.
      const campo = document.getElementById('enlace-contrasena') as HTMLInputElement | null;
      campo?.select();
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor="enlace-contrasena" className="block text-sm font-medium text-ink">
        Enlace para compartir
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="enlace-contrasena"
          readOnly
          value={enlace}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[48px] min-w-0 flex-1 rounded-sm border border-rule bg-white px-3 font-mono text-xs text-ink"
        />
        <button
          type="button"
          onClick={copiar}
          className="min-h-[48px] rounded-sm bg-ink px-5 text-sm font-medium text-cream"
        >
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </button>
      </div>
      <p className="text-xs text-muted">
        Vence el {vence} y sirve una sola vez. Mándalo solo a esa persona: quien lo abra elige la
        contraseña de la cuenta. Esta es la única vez que se muestra.
      </p>
    </div>
  );
}
