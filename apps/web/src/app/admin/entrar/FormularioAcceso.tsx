'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { entrar, type EstadoAcceso } from './acciones';

const INICIAL: EstadoAcceso = { error: null };

export function FormularioAcceso() {
  const [estado, accion] = useActionState(entrar, INICIAL);

  return (
    <form action={accion} className="space-y-4">
      {estado.error && (
        <p
          role="alert"
          className="border-l-[3px] border-agotado bg-agotado/5 px-4 py-3 text-sm text-ink"
        >
          {estado.error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="mt-1.5 min-h-[48px] w-full rounded-sm border border-rule bg-cream px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </div>

      <div>
        <label htmlFor="clave" className="block text-sm font-medium text-ink">
          Contraseña
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          required
          // Le dice al gestor de contraseñas del navegador que puede guardarla
          // y rellenarla. Un gestor es más seguro que una contraseña que la
          // gente pueda recordar.
          autoComplete="current-password"
          className="mt-1.5 min-h-[48px] w-full rounded-sm border border-rule bg-cream px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </div>

      <Boton />
    </form>
  );
}

/**
 * Botón que se desactiva mientras se comprueba.
 *
 * Verificar la contraseña tarda ~100 ms a propósito. Sin este aviso, la
 * pantalla parece congelada y la gente vuelve a apretar.
 */
function Boton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-sm bg-ink font-medium text-cream transition-colors hover:bg-ink-soft disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {pending ? 'Comprobando…' : 'Entrar'}
    </button>
  );
}
