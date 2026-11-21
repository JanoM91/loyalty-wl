'use client';

import { useState, type CSSProperties } from 'react';

/**
 * Botón que copia un texto al portapapeles y confirma en el mismo botón.
 * Sin permiso de portapapeles no hace nada visible: el texto sigue a la vista
 * para copiarlo a mano.
 */
export function Copiar({
  texto,
  etiqueta = 'Copiar',
  hecho = 'Copiado',
  className,
  style,
}: {
  texto: string;
  etiqueta?: string;
  hecho?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso: el texto queda visible junto al botón.
    }
  }

  return (
    <button type="button" onClick={() => void copiar()} className={className} style={style}>
      <span aria-live="polite">{copiado ? hecho : etiqueta}</span>
    </button>
  );
}
