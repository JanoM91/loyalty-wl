import { describe, expect, it } from 'vitest';

import {
  coloresDesdeTonos,
  contraste,
  leerColoresMarca,
  mezclar,
  revisarColores,
  tonosDominantes,
} from '../src';

/** Una imagen de prueba: `partes` = [color RGBA, cuántos píxeles]. */
function imagen(partes: [[number, number, number, number], number][]): Uint8ClampedArray {
  const px: number[] = [];
  for (const [c, n] of partes) for (let i = 0; i < n; i += 1) px.push(...c);
  return Uint8ClampedArray.from(px);
}

describe('colores a partir del logotipo', () => {
  it('toma los colores fuertes, no el promedio ni el fondo', () => {
    // Logo verde azulado y rojo sobre transparente y blanco.
    const px = imagen([
      [[0, 0, 0, 0], 4000],
      [[255, 255, 255, 255], 3000],
      [[20, 52, 59, 255], 1800],
      [[232, 71, 60, 255], 700],
    ]);
    const tonos = tonosDominantes(px);
    expect(tonos.map((t) => t.hex)).toEqual(['#14343b', '#e8473c']);
    const c = coloresDesdeTonos(tonos)!;
    expect(c.fondo).toBe('#14343b');
    expect(c.acento).toBe('#e8473c');
    expect(c.sobreFondo).toBe('#ffffff');
    expect(revisarColores(c).errores).toEqual([]);
  });

  it('un logo negro da una tarjeta negra con acento claro', () => {
    const c = coloresDesdeTonos(tonosDominantes(imagen([[[10, 10, 10, 255], 500]])))!;
    expect(c.fondo).toBe('#0a0a0a');
    expect(contraste(c.acento, c.fondo)).toBeGreaterThanOrEqual(3);
  });

  it('un amarillo claro se oscurece hasta que el texto se lea', () => {
    const c = coloresDesdeTonos([{ hex: '#ffd60a' }])!;
    expect(contraste(c.sobreFondo, c.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.tinta, c.papel)).toBeGreaterThanOrEqual(4.5);
  });

  it('sin color no inventa nada', () => {
    expect(tonosDominantes(imagen([[[255, 255, 255, 255], 100]]))).toEqual([]);
    expect(coloresDesdeTonos([])).toBeNull();
  });

  it('solo acepta colores completos y legibles del navegador', () => {
    const ok = coloresDesdeTonos([{ hex: '#14343b' }, { hex: '#e8473c' }])!;
    expect(leerColoresMarca(ok)).toEqual(ok);
    expect(leerColoresMarca({ ...ok, fondo: 'rojo' })).toBeNull();
    expect(leerColoresMarca({ ...ok, sobreFondo: ok.fondo })).toBeNull();
    expect(mezclar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
