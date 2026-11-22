'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { CampoContrasena } from '@/components/lealtad/CampoContrasena';
import { entrar, type Estado } from '../acciones';

const INICIAL: Estado = { error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream hover:bg-ink-soft disabled:opacity-50"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}

export function FormularioEntrar() {
  const [estado, accion] = useActionState(entrar, INICIAL);
  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="dato" className="text-sm font-semibold text-ink">
          Correo o celular
        </label>
        <input
          id="dato"
          name="dato"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="nombre@correo.com o 228 123 4567"
          className="min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-[#1d1d1f] placeholder:text-[#8a8a8e] text-base focus:border-ink focus:outline-none"
        />
      </div>
      <CampoContrasena name="clave" etiqueta="Contraseña" autoComplete="current-password" />
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      <Boton />
    </form>
  );
}
