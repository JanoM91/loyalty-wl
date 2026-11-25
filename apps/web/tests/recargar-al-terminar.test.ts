import { afterEach, describe, expect, it, vi } from 'vitest';

import { recargarAlTerminar } from '../src/lib/recargar-al-terminar';

/**
 * La carga completa debe salir en cuanto la acción responde, sin esperar a que
 * React pinte el resultado: si el repintado se atora, la página igual cambia.
 */
describe('recargarAlTerminar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre la dirección que trae el resultado y devuelve el estado', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    const accion = vi.fn(async (_previo: null, n: number) => ({ ok: true, recargar: `/x?n=${n}` }));
    const envuelta = recargarAlTerminar(accion, (e) => e.recargar);

    const estado = await envuelta(null, 7);

    expect(accion).toHaveBeenCalledWith(null, 7);
    expect(assign).toHaveBeenCalledWith('/x?n=7');
    expect(estado).toEqual({ ok: true, recargar: '/x?n=7' });
  });

  it('sin dirección (por ejemplo, un error) no mueve la página', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    const envuelta = recargarAlTerminar(
      async () => ({ error: 'Falta el importe.', recargar: undefined }),
      (e) => e.recargar,
    );

    const estado = await envuelta(null, null);

    expect(assign).not.toHaveBeenCalled();
    expect(estado.error).toBe('Falta el importe.');
  });
});
