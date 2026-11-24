'use client';

import { useActionState, useState } from 'react';

import { enviarAviso, type EstadoAviso } from './acciones';

const CAMPO =
  'w-full rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white px-4 text-[16px] text-ink outline-none focus:border-ink';
const ETIQUETA = 'grid gap-1.5 text-[14px] font-semibold text-ink';

export interface OpcionAudiencia {
  readonly valor: string;
  readonly etiqueta: string;
  readonly clubes: number;
  readonly correos: number;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function FormularioAviso({
  grupos,
  clubes,
  miCorreo,
  largoAsunto,
  largoMensaje,
}: {
  grupos: readonly OpcionAudiencia[];
  clubes: readonly OpcionAudiencia[];
  /** A dónde llega la prueba. */
  miCorreo: string;
  largoAsunto: number;
  largoMensaje: number;
}) {
  const [estado, accion, enviando] = useActionState<EstadoAviso, FormData>(enviarAviso, {
    error: null,
    listo: null,
    asunto: '',
    mensaje: '',
    audiencia: 'todos',
  });
  const [valor, setValor] = useState(estado.audiencia);
  const [mensaje, setMensaje] = useState(estado.mensaje);
  const elegida = [...grupos, ...clubes].find((o) => o.valor === valor);
  const sinNadie = !elegida || elegida.correos === 0;

  return (
    <form action={accion} className="grid gap-5">
      <label className={ETIQUETA}>
        Para
        <select
          name="audiencia"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`${CAMPO} min-h-[52px]`}
        >
          <optgroup label="Grupos">
            {grupos.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta} ({o.clubes})
              </option>
            ))}
          </optgroup>
          <optgroup label="Un solo club">
            {clubes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="text-[13px] font-normal text-[#5A4F63]">
          {sinNadie
            ? 'Nadie lo recibiría: no hay dueños con correo en esta selección.'
            : `Lo reciben ${plural(elegida.correos, 'dueño', 'dueños')} de ${plural(elegida.clubes, 'club', 'clubes')}. Los grupos no incluyen clubes suspendidos.`}
        </span>
      </label>

      <label className={ETIQUETA}>
        Asunto
        <input
          name="asunto"
          required
          maxLength={largoAsunto}
          defaultValue={estado.asunto}
          placeholder="Novedad en tu club: regalos de cumpleaños"
          className={`${CAMPO} min-h-[52px]`}
        />
      </label>

      <label className={ETIQUETA}>
        Mensaje
        <textarea
          name="mensaje"
          required
          rows={9}
          maxLength={largoMensaje}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe como le hablarías a un dueño. Deja una línea en blanco entre párrafos."
          className={`${CAMPO} py-3 leading-relaxed`}
        />
        <span className="flex flex-wrap justify-between gap-2 text-[13px] font-normal text-[#5A4F63]">
          <span>
            El correo empieza con «Hola, su nombre:» y termina con el WhatsApp de ayuda y un botón a
            su panel.
          </span>
          <span className="tabular-nums">
            {mensaje.length} / {largoMensaje}
          </span>
        </span>
      </label>

      {estado.error && (
        <p
          role="alert"
          className="rounded-[14px] border-l-[4px] border-[#C0362C] bg-[#FBE0DC] px-4 py-3 text-[15px] text-[#5E1611]"
        >
          {estado.error}
        </p>
      )}
      {estado.listo && (
        <p
          role="status"
          className="rounded-[14px] border-l-[4px] border-[#2F6B3F] bg-[#E3F3E6] px-4 py-3 text-[15px] text-[#1F5630]"
        >
          {estado.listo} Revísala y, si está bien, envía el aviso.
        </p>
      )}

      <label className="flex min-h-[44px] items-start gap-3 text-[15px] text-ink">
        <input
          type="checkbox"
          name="confirmo"
          value="si"
          className="mt-1 size-5 accent-[#120A2A]"
        />
        <span>
          Ya lo revisé. Enviar a{' '}
          <b>{sinNadie ? 'nadie' : plural(elegida.correos, 'dueño', 'dueños')}</b>; un correo
          enviado no se puede retirar.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intencion"
          value="enviar"
          disabled={enviando || sinNadie}
          className="min-h-[52px] rounded-full bg-ink px-7 text-[16px] font-semibold text-cream disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar aviso'}
        </button>
        <button
          type="submit"
          name="intencion"
          value="prueba"
          disabled={enviando}
          className="min-h-[52px] rounded-full border-[1.5px] border-ink px-6 text-[16px] font-semibold text-ink disabled:opacity-50"
        >
          Enviarme una prueba
        </button>
      </div>
      <p className="text-[13px] text-[#5A4F63]">La prueba llega a {miCorreo}.</p>
    </form>
  );
}
