'use client';

import { useActionState, useState } from 'react';

import { Alerta } from '@/components/admin/Formulario';

import { enviarMensaje, probarMensaje, type EstadoMensaje } from './acciones';

const INICIAL: EstadoMensaje = { error: null, aviso: null };

const CAMPO =
  'mt-1.5 w-full rounded-[14px] border-[1.5px] border-[#CDE8DC] bg-white px-3.5 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * Redactor del mensaje: asunto y texto, prueba al propio correo y envío con
 * un segundo toque que confirma a cuántos clientes llega.
 */
export function FormularioMensaje({
  audiencia,
  puedeEnviar,
  limites,
}: {
  audiencia: number;
  /** Null si se puede; si no, por qué no (tope, horario, sin clientes). */
  puedeEnviar: string | null;
  limites: { asunto: number; cuerpo: number };
}) {
  const [prueba, probar, probando] = useActionState(probarMensaje, INICIAL);
  const [envio, enviar, enviando] = useActionState(enviarMensaje, INICIAL);
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [confirmar, setConfirmar] = useState(false);

  if (envio.aviso) return <Alerta tono="ok">{envio.aviso}</Alerta>;

  const clientes = `${audiencia} ${audiencia === 1 ? 'cliente' : 'clientes'}`;

  return (
    <form className="grid gap-4" onChange={() => setConfirmar(false)}>
      <label className="text-[14px] font-semibold text-ink">
        Asunto
        <input
          name="asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          maxLength={limites.asunto}
          placeholder="Ej. Esta semana, tu café al 2×1"
          className={`${CAMPO} min-h-[48px]`}
        />
        <span className="mt-1 block text-[12px] font-normal text-muted">
          {asunto.length} de {limites.asunto}
        </span>
      </label>
      <label className="text-[14px] font-semibold text-ink">
        Mensaje
        <textarea
          name="cuerpo"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          maxLength={limites.cuerpo}
          rows={7}
          placeholder="Cuéntales la promoción, hasta cuándo dura y cómo la piden en caja."
          className={`${CAMPO} py-3 leading-relaxed`}
        />
        <span className="mt-1 block text-[12px] font-normal text-muted">
          {cuerpo.length} de {limites.cuerpo}. El correo ya empieza con «Hola» y su nombre; abajo
          van el botón «Ver mi tarjeta» y el enlace para darse de baja.
        </span>
      </label>

      {prueba.error && <Alerta tono="error">{prueba.error}</Alerta>}
      {prueba.aviso && <Alerta tono="ok">{prueba.aviso}</Alerta>}
      {envio.error && <Alerta tono="error">{envio.error}</Alerta>}
      {puedeEnviar && <Alerta tono="aviso">{puedeEnviar}</Alerta>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          formAction={probar}
          disabled={probando || enviando}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          {probando ? 'Enviando prueba…' : 'Mandarme una prueba'}
        </button>
        {confirmar ? (
          <>
            <button
              type="submit"
              formAction={enviar}
              disabled={enviando}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5B2EFF] px-5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : `Sí, enviar a ${clientes}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              className="inline-flex min-h-[48px] items-center px-2 text-[15px] font-semibold text-ink underline underline-offset-4"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={Boolean(puedeEnviar) || probando}
            onClick={() => setConfirmar(true)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-cream disabled:opacity-50"
          >
            Enviar a {clientes}
          </button>
        )}
      </div>
    </form>
  );
}
