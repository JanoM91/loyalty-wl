'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { confirmarCodigo, enviarCodigo, type Estado } from '../acciones';

const INICIAL: Estado = { error: null };

function Boton({
  texto,
  enviando,
  secundario = false,
}: {
  texto: string;
  enviando: string;
  secundario?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        secundario
          ? 'inline-flex min-h-[48px] w-full items-center justify-center rounded-sm border-[1.5px] border-ink px-5 font-semibold text-ink hover:bg-cream disabled:opacity-50'
          : 'inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream hover:bg-ink-soft disabled:opacity-50'
      }
    >
      {pending ? enviando : texto}
    </button>
  );
}

export function FormularioVerificar() {
  const [envio, pedir] = useActionState(enviarCodigo, INICIAL);
  const [confirmacion, confirmar] = useActionState(confirmarCodigo, INICIAL);

  return (
    <div className="grid gap-4">
      <form action={pedir} className="grid gap-2">
        <Boton
          texto={envio.ok ? 'Enviar otro código' : 'Enviar código'}
          enviando="Enviando…"
          secundario={envio.ok}
        />
        {envio.error && <Aviso tono="error">{envio.error}</Aviso>}
        {envio.ok && envio.aviso && (
          <Aviso tono="ok">
            {envio.aviso} Si no lo ves en un minuto, busca en <b>No deseado</b> o <b>Spam</b> y
            marca el correo como «No es spam»: así los siguientes llegarán a tu bandeja.
          </Aviso>
        )}
      </form>

      <form action={confirmar} className="grid gap-2">
        <label htmlFor="codigo" className="text-sm font-semibold text-ink">
          Código
        </label>
        <input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          placeholder="••••••"
          className="min-h-[56px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-ink focus:outline-none"
        />
        {confirmacion.error && <Aviso tono="error">{confirmacion.error}</Aviso>}
        <Boton texto="Confirmar" enviando="Comprobando…" />
      </form>
    </div>
  );
}
