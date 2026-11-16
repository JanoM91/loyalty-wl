/**
 * Colores de la marca de un negocio y su legibilidad.
 */

export interface ColoresMarca {
  /** Fondo de la tarjeta, de los botones y de los pases. */
  readonly fondo: string;
  /** Texto sobre `fondo`. */
  readonly sobreFondo: string;
  /** Acento: estampas ganadas y premios. Rellena o bordea; no es texto. */
  readonly acento: string;
  /** Fondo de la página. */
  readonly papel: string;
  /** Texto principal sobre `papel`. */
  readonly tinta: string;
}

/** Luminancia relativa (WCAG 2.1) de un color #rrggbb. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Contraste WCAG entre dos colores: de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Lo mínimo para que la tarjeta se pueda leer. El texto necesita 4.5:1; el
 * acento es decorativo (sellos, íconos) y con 3:1 basta.
 */
export function revisarColores(c: ColoresMarca): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (contraste(c.sobreFondo, c.fondo) < 4.5)
    errores.push(
      'El texto de la tarjeta no se lee sobre su fondo. Elige colores con más contraste.',
    );
  if (contraste(c.tinta, c.papel) < 4.5)
    errores.push(
      'El texto no se lee sobre el fondo de la página. Elige colores con más contraste.',
    );
  if (contraste(c.acento, c.fondo) < 3)
    avisos.push(
      'El acento se distingue poco sobre el fondo de la tarjeta: los sellos se verán tenues.',
    );
  return { errores, avisos };
}
