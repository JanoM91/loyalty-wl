'use client';

import { useActionState } from 'react';
import type { MarcaNegocio, TipoLogo } from '@wl/database';

import { subirLogo, type EstadoLogo } from './acciones';

const LOGOS: readonly { tipo: TipoLogo; nombre: string; nota: string; oscuro: boolean }[] = [
  {
    tipo: 'logoUrl',
    nombre: 'Logotipo',
    nota: 'Para fondos claros: panel, portada, cartel.',
    oscuro: false,
  },
  {
    tipo: 'logoClaroUrl',
    nombre: 'Logotipo para la tarjeta',
    nota: 'Se ve sobre el color de tu tarjeta.',
    oscuro: true,
  },
  {
    tipo: 'iconoUrl',
    nombre: 'Sello',
    nota: 'Cuadrado. Es la marca de cada estampa ganada.',
    oscuro: true,
  },
];

function Logo({
  tipo,
  nombre,
  nota,
  oscuro,
  url,
  activo,
}: (typeof LOGOS)[number] & { url: string | null; activo: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoLogo, FormData>(subirLogo, {
    ok: false,
    error: null,
  });
  return (
    <form action={accion} className="grid gap-3 border-t border-rule pt-4">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="flex items-center gap-4">
        <span
          className={`grid h-16 w-28 flex-none place-items-center rounded-md p-2 ${oscuro ? 'bg-ink' : 'border border-rule bg-cream'}`}
        >
          {url ? (
            <img src={url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className={`text-[12px] ${oscuro ? 'text-cream/60' : 'text-muted'}`}>
              Sin archivo
            </span>
          )}
        </span>
        <span className="text-[14px] text-muted">
          <b className="block text-[15px] font-semibold text-ink">{nombre}</b>
          {nota}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="archivo"
          accept="image/png,image/jpeg,image/webp"
          disabled={!activo}
          className="max-w-full text-[14px] text-muted"
        />
        <button
          type="submit"
          disabled={!activo || enviando}
          className="min-h-[40px] rounded-full border border-rule px-4 text-[14px] text-ink hover:border-ink disabled:opacity-50"
        >
          {enviando ? 'Subiendo…' : 'Subir'}
        </button>
        {url && (
          <button
            type="submit"
            name="quitar"
            value="1"
            disabled={enviando}
            className="min-h-[40px] px-2 text-[14px] text-muted underline underline-offset-4 hover:text-ink"
          >
            Quitar
          </button>
        )}
      </div>
      {estado.error && (
        <p role="alert" className="text-[14px] text-danger">
          {estado.error}
        </p>
      )}
    </form>
  );
}

/** Los tres logotipos del negocio. PNG, JPG o WebP de hasta 1 MB. */
export function Logotipos({ marca, activo }: { marca: MarcaNegocio; activo: boolean }) {
  return (
    <section className="grid max-w-3xl gap-4">
      <h2 className="text-xl text-ink">Logotipos</h2>
      <p className="-mt-2 max-w-prose text-[14px] text-muted">
        {activo
          ? 'PNG, JPG o WebP de hasta 1 MB, de preferencia con fondo transparente. Sin logotipo, tu nombre se escribe con la tipografía del diseño.'
          : 'La subida de archivos todavía no está activa en esta instalación. Mientras tanto, tu nombre se escribe con la tipografía del diseño.'}
      </p>
      {LOGOS.map((l) => (
        <Logo key={l.tipo} {...l} url={marca[l.tipo]} activo={activo} />
      ))}
    </section>
  );
}
