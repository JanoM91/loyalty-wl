import { describe, expect, it } from 'vitest';
import { ICONOS_ARCADE, IDS_JUEGO, JUEGOS } from '@wl/domain';

import { DIBUJOS } from '../src/lib/arcade/dibujos';
import { INFO_JUEGOS, JUGABLES, azarCon, esJugable } from '../src/lib/arcade/motor';

describe('Arcade: motor', () => {
  it('la misma semilla da la misma secuencia y otra semilla, otra', () => {
    const a = azarCon(12345);
    const b = azarCon(12345);
    const c = azarCon(54321);
    const sa = Array.from({ length: 20 }, a);
    expect(Array.from({ length: 20 }, b)).toEqual(sa);
    expect(Array.from({ length: 20 }, c)).not.toEqual(sa);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('los juegos jugables son exactamente los disponibles del catálogo', () => {
    const disponibles = JUEGOS.filter((j) => j.disponible).map((j) => j.id);
    expect([...JUGABLES].sort()).toEqual([...disponibles].sort());
    for (const id of IDS_JUEGO) expect(esJugable(id)).toBe(disponibles.includes(id));
    expect(esJugable('otro')).toBe(false);
  });

  it('cada juego jugable tiene instrucciones y un dibujo para su botón', () => {
    for (const id of JUGABLES) {
      const i = INFO_JUEGOS[id];
      expect(i.como.length).toBeGreaterThan(10);
      expect(i.icono === 'producto' || i.icono in DIBUJOS).toBe(true);
    }
  });

  it('hay un dibujo para cada producto que el dueño puede elegir', () => {
    for (const icono of ICONOS_ARCADE) expect(DIBUJOS[icono]).toBeTypeOf('function');
  });
});
