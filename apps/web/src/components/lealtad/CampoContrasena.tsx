'use client';

import { useId, useState } from 'react';

/**
 * Campo de contraseña con botón para mostrarla.
 *
 * `autoComplete` es lo que le dice al gestor de contraseñas del celular qué
 * hacer: `current-password` para rellenar la guardada, `new-password` para
 * sugerir una nueva y guardarla. Sin él, iPhone y Android no ofrecen nada.
 */
export function CampoContrasena({
  name,
  etiqueta,
  autoComplete,
  ayuda,
  autoFocus,
}: {
  name: string;
  etiqueta: string;
  autoComplete: 'current-password' | 'new-password';
  ayuda?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={autoComplete === 'new-password' ? 8 : undefined}
          maxLength={128}
          autoFocus={autoFocus}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className="min-h-[48px] w-full min-w-0 rounded-sm border-[1.5px] border-rule bg-white px-3 text-[#1d1d1f] placeholder:text-[#8a8a8e] text-base focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-pressed={visible}
          className="min-h-[48px] flex-none rounded-sm border-[1.5px] border-rule bg-cream px-3 text-sm font-semibold text-ink-soft hover:border-ink"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-xs text-muted">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/** Texto de ayuda de las contraseñas nuevas, el mismo en todas las pantallas. */
export const AYUDA_CONTRASENA_NUEVA =
  'Mínimo 8 caracteres. Una frase que recuerdes funciona mejor, como «los domingos al parque». No uses tu celular ni el nombre del negocio.';

/**
 * Usuario oculto para el gestor de contraseñas: así guarda la contraseña
 * nueva junto al correo o celular con el que la persona va a entrar.
 */
export function UsuarioParaGestor({ valor }: { valor: string | null }) {
  if (!valor) return null;
  return (
    <input
      type="text"
      name="usuario"
      autoComplete="username"
      value={valor}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
    />
  );
}
