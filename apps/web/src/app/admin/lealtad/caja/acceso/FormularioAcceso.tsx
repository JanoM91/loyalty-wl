'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { generarEnlaceAcceso, type EstadoAcceso } from './acciones';

const INICIAL: EstadoAcceso = { error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[48px] flex-none rounded-sm bg-ink px-5 font-semibold text-cream disabled:opacity-50"
    >
      {pending ? 'Generando…' : 'Generar enlace'}
    </button>
  );
}

function Copiar({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      (document.getElementById('enlace-acceso') as HTMLInputElement | null)?.select();
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <input
        id="enlace-acceso"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-[44px] min-w-0 flex-1 rounded-sm border border-rule bg-white px-3 font-mono text-xs text-ink"
      />
      <button
        type="button"
        onClick={copiar}
        className="min-h-[44px] rounded-sm border border-ink px-4 text-sm font-medium text-ink"
      >
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export function FormularioAcceso({ inicial = '' }: { inicial?: string }) {
  const [estado, accion] = useActionState(generarEnlaceAcceso, INICIAL);

  return (
    <div className="grid max-w-2xl gap-5">
      <form action={accion} className="grid gap-2">
        <label htmlFor="busqueda" className="text-sm font-semibold text-ink">
          Código de tarjeta, correo o celular del cliente
        </label>
        <div className="flex gap-2">
          <input
            id="busqueda"
            name="busqueda"
            defaultValue={inicial}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Código de tarjeta · nombre@correo.com · 228 123 4567"
            className="min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-base focus:border-ink focus:outline-none"
          />
          <Boton />
        </div>
        <p className="text-xs text-muted">
          Pídele a la persona el dato con el que se dio de alta. Antes de mostrarle el QR, confirma
          que el nombre y el contacto que aparezcan son los suyos.
        </p>
        {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      </form>

      {estado.enlace && (
        <section className="grid gap-4 rounded-lg border border-rule bg-cream p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div
            role="img"
            aria-label={`Código QR de acceso a la tarjeta ${estado.enlace.codigo}`}
            className="mx-auto w-52 max-w-full rounded-md bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: estado.enlace.svg }}
          />
          <div className="grid content-start gap-3 text-sm">
            <div>
              <b className="block font-display text-lg text-ink">
                {estado.enlace.nombre ?? 'Cliente sin nombre'}
              </b>
              <span className="font-mono text-xs text-muted">
                {estado.enlace.codigo} · {estado.enlace.contacto}
              </span>
            </div>
            <ol className="grid list-decimal gap-1 pl-5 text-ink-soft">
              <li>Confirma con la persona que ese nombre y contacto son suyos.</li>
              <li>Que escanee este QR con la cámara de su celular.</li>
              <li>En su celular toca «Abrir mi tarjeta». Listo: ya la tiene de vuelta.</li>
            </ol>
            <Copiar url={estado.enlace.url} />
            <p className="text-xs text-muted">
              Vence el {estado.enlace.vence} y sirve una sola vez. Quien lo abra entra a esta
              tarjeta: no lo mandes a nadie más.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
