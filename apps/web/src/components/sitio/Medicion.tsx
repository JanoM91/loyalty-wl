'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { medir } from '@/lib/medicion';

/** Una visita por página del sitio, también al navegar sin recargar. */
export function PixelMeta() {
  const ruta = usePathname();
  useEffect(() => {
    medir('PageView');
  }, [ruta]);
  return null;
}

/**
 * Evento al abrir una página. Con `unaVez`, solo la primera vez en esta
 * pestaña (la pantalla final no debe contar dos altas si se recarga).
 */
export function MedirAlCargar({
  evento,
  datos,
  unaVez,
}: {
  evento: string | readonly string[];
  datos?: Record<string, unknown>;
  unaVez?: string;
}) {
  const lista = typeof evento === 'string' ? [evento] : evento;
  const clave = lista.join(',');
  const firma = JSON.stringify(datos ?? {});
  useEffect(() => {
    if (unaVez) {
      const marca = `wl-medido:${unaVez}`;
      try {
        if (sessionStorage.getItem(marca)) return;
        sessionStorage.setItem(marca, '1');
      } catch {
        // Sin almacenamiento: se mide de todos modos; Meta deduplica por id.
      }
    }
    for (const e of clave.split(','))
      medir(e, JSON.parse(firma) as Record<string, unknown>, unaVez);
  }, [clave, firma, unaVez]);
  return null;
}
