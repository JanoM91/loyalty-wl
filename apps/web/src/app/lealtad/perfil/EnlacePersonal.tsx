'use client';

import { useActionState, useState } from 'react';

import { Aviso } from '@/components/lealtad/Aviso';
import { cambiarEnlacePersonal, type Estado } from '../acciones';
import { useMarca } from '@/components/Marca';

const INICIAL: Estado = { error: null };

/** Copiar, compartir o cambiar el enlace personal desde el perfil. */
export function EnlacePersonal({ url }: { url: string }) {
  const marca = useMarca();
  const [copiado, setCopiado] = useState(false);
  const [estado, accion, cambiando] = useActionState(cambiarEnlacePersonal, INICIAL);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin portapapeles: queda el texto a la vista */
    }
  }

  async function compartir() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Mi tarjeta de ${marca.nombre}`, url });
        return;
      } catch {
        /* canceló: no pasa nada */
      }
    } else {
      await copiar();
    }
  }

  return (
    <div className="grid gap-3">
      <p className="break-all rounded-md border border-rule bg-cream px-3 py-2 font-mono text-xs text-ink-soft">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex min-h-[44px] items-center rounded-sm bg-ink px-4 text-sm font-semibold text-cream hover:bg-ink-soft"
        >
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </button>
        <button
          type="button"
          onClick={compartir}
          className="inline-flex min-h-[44px] items-center rounded-sm border border-ink px-4 text-sm font-semibold text-ink hover:bg-ink/5"
        >
          Guardarlo en mis notas o chats
        </button>
      </div>
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && estado.aviso && <Aviso tono="ok">{estado.aviso}</Aviso>}
      <form action={accion}>
        <button
          type="submit"
          disabled={cambiando}
          className="text-sm text-crust-dark underline underline-offset-4 disabled:opacity-50"
        >
          {cambiando ? 'Cambiando…' : '¿Lo compartiste por error? Cambiar mi enlace'}
        </button>
      </form>
    </div>
  );
}
