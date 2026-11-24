import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * El pixel de Meta se enciende solo con `NEXT_PUBLIC_META_PIXEL_ID`, que se lee
 * al cargar el módulo; por eso cada caso vuelve a importarlo.
 */
async function cargar(id: string | undefined) {
  vi.resetModules();
  if (id === undefined) vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '');
  else vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', id);
  return import('../src/lib/medicion');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('medición con el pixel de Meta', () => {
  it('está apagada sin ID', async () => {
    const m = await cargar(undefined);
    expect(m.PIXEL_META).toBeNull();
    expect(m.MEDICION_ACTIVA).toBe(false);
    expect(m.cargarPixel()).toBe(false);
  });

  it('se enciende con el ID y conserva solo los dígitos', async () => {
    const m = await cargar(' 1440053817786058\n');
    expect(m.PIXEL_META).toBe('1440053817786058');
    expect(m.MEDICION_ACTIVA).toBe(true);
  });

  it('un ID sin dígitos la deja apagada', async () => {
    const m = await cargar('abc');
    expect(m.MEDICION_ACTIVA).toBe(false);
  });

  it('apagada, medir() no hace nada ni toca el navegador', async () => {
    const m = await cargar(undefined);
    expect(() => m.medir('PageView')).not.toThrow();
  });
});
