'use client';

import { useEffect } from 'react';

/**
 * Lleva la página arriba al abrirla. La pantalla final del asistente llega
 * por una redirección desde el formulario, que está a media página, y el
 * navegador conservaba esa altura: el dueño no veía el título ni el paso 1.
 */
export function ArribaAlCargar() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
