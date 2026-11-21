import { describe, expect, it } from 'vitest';

import { COMBINACIONES } from '../src/marca/combinaciones';
import { GIROS, girosOrdenados } from '../src/alta/giros';
import { diasRestantesDePrueba, estadoComercial, vencimientoDePrueba } from '../src/alta/prueba';

describe('periodo de prueba', () => {
  const inicio = new Date('2026-11-21T14:00:00.000Z');
  const vence = vencimientoDePrueba(inicio);

  it('dura siete días naturales desde el registro', () => {
    expect(vence).toBe('2026-11-28T14:00:00.000Z');
  });

  it('opera en prueba hasta el vencimiento y después se pausa', () => {
    expect(estadoComercial(vence, new Date('2026-11-28T13:59:59.000Z'))).toBe('PRUEBA');
    expect(estadoComercial(vence, new Date('2026-11-28T14:00:00.000Z'))).toBe('PAUSADO');
  });

  it('sin fecha, o con una ilegible, el club está activo', () => {
    expect(estadoComercial(null)).toBe('ACTIVO');
    expect(estadoComercial('no es fecha')).toBe('ACTIVO');
  });

  it('cuenta los días que quedan', () => {
    expect(diasRestantesDePrueba(vence, inicio)).toBe(7);
    expect(diasRestantesDePrueba(vence, new Date('2026-11-27T15:00:00.000Z'))).toBe(1);
    expect(diasRestantesDePrueba(vence, new Date('2026-11-29T00:00:00.000Z'))).toBe(0);
    expect(diasRestantesDePrueba(null)).toBe(0);
  });
});

describe('giros del asistente', () => {
  it('cada giro propone combinaciones que existen y un programa válido', () => {
    const ids = new Set(COMBINACIONES.map((c) => c.id));
    for (const g of GIROS) {
      expect(g.combinaciones).toHaveLength(6);
      for (const c of g.combinaciones) expect(ids.has(c), `${g.id}: ${c}`).toBe(true);
      expect(g.sellos).toBeGreaterThanOrEqual(2);
      expect(g.premio.length).toBeGreaterThan(2);
    }
  });

  it('pone primero los giros del grupo pedido, sin perder ninguno', () => {
    const lista = girosOrdenados('cafe');
    expect(lista[0]?.grupo).toBe('cafe');
    expect(lista).toHaveLength(GIROS.length);
  });
});
