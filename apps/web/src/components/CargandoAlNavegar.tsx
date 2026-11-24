'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { Cargando } from './Cargando';

/** Archivos y rutas que no abren otra página: no llevan loader. */
const NO_ES_PAGINA = /\.(pdf|png|jpe?g|gif|svg|webp|zip|csv|ics|pkpass|webmanifest)$/i;

/** Si la página siguiente no llega en este tiempo, el loader se quita solo. */
const TOPE_MS = 15000;

/**
 * Loader entre páginas: al tocar un enlace interno, la página actual queda
 * detrás del logotipo en movimiento hasta que llega la siguiente.
 *
 * - Enlaces normales (`<a href>`, como los del panel) y formularios que
 *   recargan: el loader dura hasta que el navegador cambia de página.
 * - Enlaces de Next (`<Link>`, ya atendidos por React: `defaultPrevented`):
 *   dura hasta que cambia la ruta. Si la ruta muestra su `loading.tsx`, este
 *   loader se esconde para no duplicarse (regla en `cargando.css`). Un
 *   `<Link>` que solo cambia los parámetros de la misma ruta no lo muestra.
 * - Los formularios con acción de servidor no pasan por aquí (tienen su propio
 *   «Guardando…»).
 */
export function CargandoAlNavegar({ variante = 'club' }: { variante?: 'club' | 'negocio' }) {
  const [visible, setVisible] = useState(false);
  const ruta = usePathname();

  // Llegó otra página (navegación de Next): fuera el loader.
  useEffect(() => {
    setVisible(false);
  }, [ruta]);

  useEffect(() => {
    let tope: ReturnType<typeof setTimeout> | undefined;
    const mostrar = () => {
      clearTimeout(tope);
      setVisible(true);
      tope = setTimeout(() => setVisible(false), TOPE_MS);
    };
    const ocultar = () => {
      clearTimeout(tope);
      setVisible(false);
    };

    const alClic = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let destino: URL;
      try {
        destino = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;
      const aqui = window.location;
      if (destino.pathname === aqui.pathname) {
        // Misma página: un ancla, o un <Link> que solo cambia parámetros.
        if (e.defaultPrevented || destino.search === aqui.search) return;
      }
      if (destino.pathname.startsWith('/api/') || NO_ES_PAGINA.test(destino.pathname)) return;
      mostrar();
    };

    const alEnviar = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const f = e.target;
      if (!(f instanceof HTMLFormElement)) return;
      if (f.target && f.target !== '_self') return;
      // Un formulario que descarga un archivo no cambia de página.
      if (f.hasAttribute('data-descarga')) return;
      mostrar();
    };

    // Volver con el botón «atrás» puede traer la página guardada tal cual.
    const alVolver = () => ocultar();

    document.addEventListener('click', alClic);
    document.addEventListener('submit', alEnviar);
    window.addEventListener('pageshow', alVolver);
    return () => {
      clearTimeout(tope);
      document.removeEventListener('click', alClic);
      document.removeEventListener('submit', alEnviar);
      window.removeEventListener('pageshow', alVolver);
    };
  }, []);

  return visible ? <Cargando variante={variante} fijo /> : null;
}
