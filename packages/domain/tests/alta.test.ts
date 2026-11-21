import { describe, expect, it } from 'vitest';

import { COMBINACIONES } from '../src/marca/combinaciones';
import { GIROS, girosOrdenados } from '../src/alta/giros';
import {
  diasEnPausa,
  diasRestantesDePrueba,
  estadoComercial,
  fechaDeBorrado,
  finDePeriodoPagado,
  listoParaBorrar,
  vencimientoDePrueba,
} from '../src/alta/prueba';

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

describe('pago, pausa y borrado', () => {
  const vence = '2026-11-28T14:00:00.000Z';

  it('un periodo pagado manda sobre la prueba', () => {
    const pagado = '2026-12-28T14:00:00.000Z';
    expect(estadoComercial(vence, new Date('2026-12-01T00:00:00Z'), pagado)).toBe('ACTIVO');
    expect(estadoComercial(vence, new Date('2026-12-28T14:00:00Z'), pagado)).toBe('PAUSADO');
  });

  it('el pago empieza hoy si ya venció, o al final del periodo vigente', () => {
    const hoy = new Date('2026-12-10T12:00:00.000Z');
    expect(finDePeriodoPagado('MES', null, hoy)).toBe('2027-01-10T12:00:00.000Z');
    expect(finDePeriodoPagado('ANIO', null, hoy)).toBe('2027-12-10T12:00:00.000Z');
    expect(finDePeriodoPagado('MES', '2026-12-20T00:00:00.000Z', hoy)).toBe(
      '2027-01-20T00:00:00.000Z',
    );
    expect(finDePeriodoPagado('MES', '2026-12-01T00:00:00.000Z', hoy)).toBe(
      '2027-01-10T12:00:00.000Z',
    );
  });

  it('cuenta los días en pausa y se puede borrar a los 30', () => {
    expect(diasEnPausa(vence, null, new Date('2026-11-27T00:00:00Z'))).toBe(0);
    expect(diasEnPausa(vence, null, new Date('2026-12-08T14:00:00Z'))).toBe(10);
    expect(fechaDeBorrado(vence, null, new Date('2026-12-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-12-28T14:00:00.000Z',
    );
    expect(listoParaBorrar(vence, null, new Date('2026-12-28T13:59:00Z'))).toBe(false);
    expect(listoParaBorrar(vence, null, new Date('2026-12-28T14:00:00Z'))).toBe(true);
  });

  it('un club activo o en prueba nunca está listo para borrar', () => {
    expect(listoParaBorrar(null, null)).toBe(false);
    expect(listoParaBorrar(vence, null, new Date('2026-11-25T00:00:00Z'))).toBe(false);
    expect(
      fechaDeBorrado(vence, '2027-11-28T00:00:00Z', new Date('2027-01-01T00:00:00Z')),
    ).toBeNull();
  });
});
