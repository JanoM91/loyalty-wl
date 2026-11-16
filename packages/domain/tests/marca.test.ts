import { describe, expect, it } from 'vitest';

import { COMBINACIONES, contraste, esSlugDeNegocio, revisarColores } from '../src/index';

describe('contraste de colores', () => {
  it('mide como WCAG', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(contraste('#ffffff', '#ffffff')).toBe(1);
  });

  it('rechaza una tarjeta o una página ilegible y solo avisa de un acento tenue', () => {
    const base = COMBINACIONES[0]!.colores;
    expect(revisarColores(base)).toEqual({ errores: [], avisos: [] });
    expect(revisarColores({ ...base, sobreFondo: base.fondo }).errores).toHaveLength(1);
    expect(revisarColores({ ...base, tinta: base.papel }).errores).toHaveLength(1);
    const tenue = revisarColores({ ...base, acento: base.fondo });
    expect(tenue.errores).toEqual([]);
    expect(tenue.avisos).toHaveLength(1);
  });
});

describe('combinaciones del panel', () => {
  it('son veinte, con identificador y nombre únicos', () => {
    expect(COMBINACIONES).toHaveLength(20);
    expect(new Set(COMBINACIONES.map((c) => c.id)).size).toBe(20);
    expect(new Set(COMBINACIONES.map((c) => c.nombre)).size).toBe(20);
  });

  it.each(COMBINACIONES.map((c) => [c.nombre, c] as const))('%s se lee bien', (_nombre, c) => {
    expect(revisarColores(c.colores)).toEqual({ errores: [], avisos: [] });
    for (const color of Object.values(c.colores)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('slug de un negocio', () => {
  it('acepta minúsculas, números y guiones', () => {
    expect(esSlugDeNegocio('tacos-el-guero')).toBe(true);
    expect(esSlugDeNegocio('cafe2')).toBe(true);
  });

  it('rechaza las rutas del sitio y las formas raras', () => {
    for (const malo of ['lealtad', 'admin', 'api', 'privada', 'Cafe', '-cafe', 'cafe_1', 'a.b', ''])
      expect(esSlugDeNegocio(malo)).toBe(false);
  });
});
