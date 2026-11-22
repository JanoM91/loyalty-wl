'use client';

import { useActionState } from 'react';

import { Alerta } from '@/components/admin/Formulario';
import { mandarmeConfirmacion, type EstadoConfirmacion } from './acciones';

const INICIAL: EstadoConfirmacion = { error: null, enviado: false };

/** Aviso de correo sin confirmar, con el botón que manda el enlace. */
export function ConfirmarCorreo({ email }: { email: string }) {
  const [estado, accion, enviando] = useActionState(mandarmeConfirmacion, INICIAL);
  if (estado.enviado) {
    return (
      <Alerta tono="ok">
        Te mandamos el enlace a {email}. Ábrelo desde tu correo para confirmarlo.
      </Alerta>
    );
  }
  return (
    <form
      action={accion}
      className="mb-8 grid max-w-md gap-3 rounded-[16px] border-[1.5px] border-[#E8D8C6] bg-white p-4"
    >
      <b className="text-[15px] text-ink">Confirma tu correo</b>
      <p className="text-[14px] text-ink-soft">
        Así, si olvidas tu contraseña, te mandamos el enlace para elegir otra.
      </p>
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-[44px] items-center justify-center justify-self-start rounded-full bg-ink px-5 text-[14px] font-semibold text-cream disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Mandarme el enlace'}
      </button>
    </form>
  );
}
