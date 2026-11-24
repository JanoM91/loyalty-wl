import { describe, expect, it } from 'vitest';

import {
  accesosRapidos,
  cubetaDeVisitas,
  diasDelPeriodo,
  normalizarFiltrosReporte,
  periodoAnterior,
  periodosDelRango,
  proporcion,
  sellosCercaDelPremio,
} from '../src/index';

const hoy = '2026-11-24';

describe('filtros de los reportes', () => {
  it('por omisión, los últimos 28 días agrupados por día y todas las sucursales', () => {
    expect(normalizarFiltrosReporte({}, hoy, ['centro'])).toEqual({
      desde: '2026-10-28',
      hasta: hoy,
      agrupar: 'DIA',
      sucursales: [],
    });
  });

  it('ordena las fechas, no pasa de hoy ni del máximo, y solo deja sucursales que existen', () => {
    const f = normalizarFiltrosReporte(
      {
        desde: '2026-11-30',
        hasta: '2026-11-01',
        agrupar: 'MES',
        sucursales: ['centro', 'otra', 'centro', 7],
      },
      hoy,
      ['centro', 'norte'],
    );
    expect(f).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-24',
      agrupar: 'MES',
      sucursales: ['centro'],
    });
    const largo = normalizarFiltrosReporte({ desde: '2010-01-01', hasta: hoy }, hoy, []);
    expect(diasDelPeriodo(largo.desde, largo.hasta)).toBe(1500);
    expect(normalizarFiltrosReporte({ desde: 'ayer', agrupar: 'AÑO' }, hoy, []).agrupar).toBe(
      'DIA',
    );
  });

  it('el periodo anterior tiene el mismo largo y termina justo antes', () => {
    expect(periodoAnterior('2026-11-11', '2026-11-20')).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-10',
    });
    expect(periodoAnterior(hoy, hoy)).toEqual({ desde: '2026-11-23', hasta: '2026-11-23' });
  });

  it('accesos rápidos: mes anterior completo y «desde el inicio» solo si hay historia', () => {
    const a = accesosRapidos(hoy);
    expect(a.find((x) => x.nombre === 'Mes anterior')).toMatchObject({
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    expect(a.some((x) => x.nombre === 'Desde el inicio')).toBe(false);
    expect(accesosRapidos(hoy, '2026-11-16').at(-1)).toMatchObject({
      nombre: 'Desde el inicio',
      desde: '2026-11-16',
      agrupar: 'MES',
    });
    expect(accesosRapidos('2026-01-15').find((x) => x.nombre === 'Mes anterior')).toMatchObject({
      desde: '2025-12-01',
      hasta: '2025-12-31',
    });
  });
});

describe('cubetas y premios', () => {
  it('visitas por cliente', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 40].map(cubetaDeVisitas)).toEqual([
      '1',
      '2',
      '3',
      '4–5',
      '4–5',
      '6–9',
      '6–9',
      '10 o más',
      '10 o más',
    ]);
    expect(cubetaDeVisitas(0)).toBeNull();
    expect(cubetaDeVisitas(Number.NaN)).toBeNull();
  });

  it('a un sello del premio: la posición de cada premio menos uno', () => {
    expect(sellosCercaDelPremio([5, 10])).toEqual([4, 9]);
    expect(sellosCercaDelPremio([6])).toEqual([5]);
    expect(sellosCercaDelPremio([0, 3, 3])).toEqual([2]);
  });

  it('proporción sin base es cero', () => {
    expect(proporcion(3, 4)).toBe(0.75);
    expect(proporcion(3, 0)).toBe(0);
  });
});

describe('periodos de la gráfica', () => {
  it('días, semanas que empiezan en lunes y meses, sin huecos', () => {
    expect(periodosDelRango('2026-11-22', '2026-11-24', 'DIA')).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
    ]);
    // 22-nov-2026 es domingo: su semana empieza el lunes 16.
    expect(periodosDelRango('2026-11-22', '2026-12-01', 'SEMANA')).toEqual([
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
    expect(periodosDelRango('2026-11-15', '2027-01-03', 'MES')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
    expect(periodosDelRango('2026-11-24', '2026-11-01', 'DIA')).toEqual([]);
  });
});
