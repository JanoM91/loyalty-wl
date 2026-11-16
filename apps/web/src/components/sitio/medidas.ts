import type { CSSProperties } from 'react';

/** Ancho mínimo de columna de una rejilla del sitio (`--min`). */
export function minimo(px: number, extra?: CSSProperties): CSSProperties {
  return { '--min': `${px}px`, ...extra } as CSSProperties;
}
