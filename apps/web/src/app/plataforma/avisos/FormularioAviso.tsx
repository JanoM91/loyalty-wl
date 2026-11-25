'use client';

import { useActionState, useState } from 'react';

import { recargarAlTerminar } from '@/lib/recargar-al-terminar';

import { enviarAviso, type EstadoAviso } from './acciones';

const enviarYRecargar = recargarAlTerminar(enviarAviso, (e) => e.recargar);

const CAMPO =
  'w-full rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white px-4 text-[16px] text-ink outline-none focus:border-ink';
const ETIQUETA = 'grid gap-1.5 text-[14px] font-semibold text-ink';

export interface PlantillaElegible {
  readonly id: string;
  readonly nombre: string;
  readonly asunto: string;
  readonly mensaje: string;
}

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
  plantillas,
  miCorreo,
  largoAsunto,
  largoMensaje,
  minimoProgramar,
}: {
  grupos: readonly OpcionAudiencia[];
  clubes: readonly OpcionAudiencia[];
  plantillas: readonly PlantillaElegible[];
  /** «2026-11-24T10:15», hora de México: lo más pronto que se puede programar. */
  minimoProgramar: string;
  /** A dónde llega la prueba. */
  miCorreo: string;
  largoAsunto: number;
  largoMensaje: number;
}) {
  const [estado, accion, enviando] = useActionState<EstadoAviso, FormData>(enviarYRecargar, {
    error: null,
    listo: null,
    asunto: '',
    mensaje: '',
    audiencia: 'todos',
  });
  const [valor, setValor] = useState(estado.audiencia);
  const [asunto, setAsunto] = useState(estado.asunto);
  const [mensaje, setMensaje] = useState(estado.mensaje);
  const [cuando, setCuando] = useState<'ahora' | 'programar'>('ahora');
  const elegida = [...grupos, ...clubes].find((o) => o.valor === valor);
  // Un aviso programado calcula su audiencia al salir: puede estar vacía hoy.
  const sinNadie = cuando === 'ahora' && (!elegida || elegida.correos === 0);

  return (
    <form action={accion} className="grid gap-5">
      {plantillas.length > 0 && (
        <label className={ETIQUETA}>
          Empezar desde una plantilla
          <select
            defaultValue=""
            onChange={(e) => {
              const p = plantillas.find((x) => x.id === e.target.value);
              if (!p) return;
              setAsunto(p.asunto);
              setMensaje(p.mensaje);
            }}
            className={`${CAMPO} min-h-[52px]`}
          >
            <option value="">Mensaje en blanco</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

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
          {cuando === 'programar'
            ? 'A quién le llega se calcula en el momento de salir. Los grupos no incluyen clubes suspendidos.'
            : sinNadie || !elegida
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
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
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
            su panel. También queda en «Avisos» dentro del panel de cada club.
          </span>
          <span className="tabular-nums">
            {mensaje.length} / {largoMensaje}
          </span>
        </span>
      </label>

      <fieldset className="grid gap-3">
        <legend className="mb-1.5 text-[14px] font-semibold text-ink">Cuándo</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ahora', 'Ahora'],
              ['programar', 'Programar'],
            ] as const
          ).map(([v, texto]) => (
            <label
              key={v}
              className={`flex min-h-[44px] cursor-pointer items-center rounded-full border-[1.5px] px-4 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${cuando === v ? 'border-ink bg-ink text-cream' : 'border-[#E8D8C6] bg-white text-ink'}`}
            >
              <input
                type="radio"
                name="cuando"
                value={v}
                checked={cuando === v}
                onChange={() => setCuando(v)}
                className="sr-only"
              />
              {texto}
            </label>
          ))}
        </div>
        {cuando === 'programar' && (
          <label className="grid gap-1.5 text-[14px] text-[#5A4F63]">
            Día y hora (centro de México)
            <input
              type="datetime-local"
              name="fecha"
              required
              min={minimoProgramar}
              defaultValue={minimoProgramar}
              className={`${CAMPO} min-h-[52px] max-w-xs`}
            />
          </label>
        )}
      </fieldset>

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
          {estado.listo}
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
          {cuando === 'programar' ? (
            <>Ya lo revisé. Programarlo; se puede cancelar hasta que salga.</>
          ) : (
            <>
              Ya lo revisé. Enviar a{' '}
              <b>{sinNadie || !elegida ? 'nadie' : plural(elegida.correos, 'dueño', 'dueños')}</b>;
              un correo enviado no se puede retirar.
            </>
          )}
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
          {enviando || estado.recargar
            ? 'Un momento…'
            : cuando === 'programar'
              ? 'Programar aviso'
              : 'Enviar aviso'}
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

      <details className="rounded-[14px] border-[1.5px] border-[#E8D8C6] p-4">
        <summary className="min-h-[40px] cursor-pointer py-2 text-[15px] font-semibold text-ink">
          Guardar como plantilla
        </summary>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1.5 text-[14px] text-[#5A4F63]">
            Nombre de la plantilla
            <input
              name="nombrePlantilla"
              maxLength={80}
              placeholder="Recordatorio de pago"
              className={`${CAMPO} min-h-[48px]`}
            />
          </label>
          <button
            type="submit"
            name="intencion"
            value="plantilla"
            disabled={enviando}
            className="min-h-[48px] rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            Guardar plantilla
          </button>
        </div>
        <p className="mt-2 text-[13px] text-[#5A4F63]">
          Guarda el asunto y el mensaje de arriba. Con el mismo nombre, la reemplaza.
        </p>
      </details>
    </form>
  );
}
