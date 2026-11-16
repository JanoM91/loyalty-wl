'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { abrirMiTarjeta, type Estado } from '../../acciones';

const INICIAL: Estado = { error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center rounded-sm bg-ink px-5 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-50"
    >
      {pending ? 'Abriendo…' : 'Abrir mi tarjeta'}
    </button>
  );
}

export function BotonMiTarjeta({ token, a }: { token: string; a: string | null }) {
  const [estado, accion] = useActionState(abrirMiTarjeta, INICIAL);
  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {a && <input type="hidden" name="a" value={a} />}
      {estado.error && (
        <Aviso tono="error" titulo="No se pudo abrir">
          {estado.error}
        </Aviso>
      )}
      <Boton />
    </form>
  );
}
