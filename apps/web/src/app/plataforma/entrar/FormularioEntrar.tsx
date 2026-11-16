'use client';

import { useActionState } from 'react';

import { entrar, type EstadoFormulario } from '../acciones';

const CAMPO = 'min-h-[52px] w-full border border-rule bg-cream px-4 text-[16px] text-ink';

export function FormularioEntrar() {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(entrar, {
    error: null,
  });
  return (
    <form action={accion} className="grid gap-4">
      <label className="grid gap-1.5 text-[14px] text-muted">
        Correo
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={estado.email ?? ''}
          className={CAMPO}
        />
      </label>
      <label className="grid gap-1.5 text-[14px] text-muted">
        Contraseña
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className={CAMPO}
        />
      </label>
      {estado.error && (
        <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="min-h-[52px] rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
