'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { olvide, type Estado } from '../acciones';

const INICIAL: Estado = { error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream hover:bg-ink-soft disabled:opacity-50"
    >
      {pending ? 'Enviando…' : 'Pedir enlace'}
    </button>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(olvide, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <label htmlFor="dato" className="text-sm font-semibold text-ink">
        Correo o celular de tu tarjeta
      </label>
      <input
        id="dato"
        name="dato"
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        required
        placeholder="nombre@correo.com o 228 123 4567"
        className="min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-[#1d1d1f] placeholder:text-[#8a8a8e] text-base focus:border-ink focus:outline-none"
      />
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && estado.aviso && <Aviso tono="ok">{estado.aviso}</Aviso>}
      <Boton />
    </form>
  );
}
