/** Formatos de número de los reportes (servidor y navegador). */
export type FormatoNumero = 'numero' | 'porcentaje';

export function formateador(f: FormatoNumero, corto = false): (v: number) => string {
  if (f === 'porcentaje') return (v) => `${(v * 100).toFixed(corto ? 0 : 1)}\u00a0%`;
  return (v) =>
    corto && Math.abs(v) >= 1000
      ? `${(v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil`
      : v.toLocaleString('es-MX', { maximumFractionDigits: 1 });
}

/**
 * Colores de serie, en orden fijo (paleta categórica validada para
 * daltonismo sobre fondo claro). Van por entidad: la sucursal conserva su
 * color aunque cambie el filtro. No dependen de la marca del club, para que
 * una tinta clara o un acento parecido no confundan dos series.
 */
export const COLORES_SERIE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;

/** Color fijo por posición; pasado el octavo, un gris neutro («otras»). */
export function colorDeSerie(i: number): string {
  return COLORES_SERIE[i] ?? '#7a7974';
}
