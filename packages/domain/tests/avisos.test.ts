import { describe, expect, it } from 'vitest';

import { AVISOS_POR_OMISION, avisoDeCiclo, leerAvisos } from '../src';

const DIA = 24 * 60 * 60 * 1000;
const ahora = new Date('2026-11-23T15:00:00.000Z');
const en = (dias: number) => new Date(ahora.getTime() + dias * DIA).toISOString();

const club = (c: Partial<Parameters<typeof avisoDeCiclo>[0]>) => ({
  pruebaVence: null,
  pagadoHasta: null,
  avisos: AVISOS_POR_OMISION,
  borradoAutomatico: false,
  ...c,
});

describe('avisoDeCiclo', () => {
  it('no avisa a un club sin fechas (lo dio de alta Exkalibur)', () => {
    expect(avisoDeCiclo(club({}), ahora)).toBeNull();
  });

  it('avisa 2 días antes del fin de la prueba, una sola vez', () => {
    expect(avisoDeCiclo(club({ pruebaVence: en(3) }), ahora)).toBeNull();
    const vence = en(1.5);
    const a = avisoDeCiclo(club({ pruebaVence: vence }), ahora);
    expect(a).toMatchObject({ tipo: 'por-vencer', referencia: vence, pagado: false });
    const ya = { ...AVISOS_POR_OMISION, porVencer: vence };
    expect(avisoDeCiclo(club({ pruebaVence: vence, avisos: ya }), ahora)).toBeNull();
  });

  it('avisa 3 días antes del fin del pago, y el pago manda sobre la prueba', () => {
    const pagado = en(2.5);
    const a = avisoDeCiclo(club({ pruebaVence: en(-40), pagadoHasta: pagado }), ahora);
    expect(a).toMatchObject({ tipo: 'por-vencer', referencia: pagado, pagado: true });
  });

  it('avisa la pausa en sus primeros 3 días y no después', () => {
    const vence = en(-1);
    expect(avisoDeCiclo(club({ pruebaVence: vence }), ahora)).toMatchObject({
      tipo: 'pausa',
      referencia: vence,
    });
    expect(avisoDeCiclo(club({ pruebaVence: en(-4) }), ahora)).toBeNull();
    const ya = { ...AVISOS_POR_OMISION, pausa: vence };
    expect(avisoDeCiclo(club({ pruebaVence: vence, avisos: ya }), ahora)).toBeNull();
  });

  it('un pago nuevo que vuelve a vencer vuelve a avisar', () => {
    const viejo = en(-60);
    const avisos = { ...AVISOS_POR_OMISION, porVencer: viejo, pausa: viejo };
    expect(avisoDeCiclo(club({ pagadoHasta: en(-1), avisos }), ahora)).toMatchObject({
      tipo: 'pausa',
    });
  });

  it('avisa el borrado en los 5 días previos solo con el borrado automático encendido', () => {
    // 30 días de conservación: pausado hace 27 días, se borra en 3.
    const vence = en(-27);
    expect(avisoDeCiclo(club({ pruebaVence: vence }), ahora)).toBeNull();
    const a = avisoDeCiclo(club({ pruebaVence: vence, borradoAutomatico: true }), ahora);
    expect(a).toMatchObject({ tipo: 'borrado', referencia: vence });
    expect(a?.fecha.toISOString()).toBe(en(3));
    expect(avisoDeCiclo(club({ pruebaVence: en(-20), borradoAutomatico: true }), ahora)).toBeNull();
  });
});

describe('leerAvisos', () => {
  it('trae el resumen semanal encendido por omisión y respeta el apagado', () => {
    expect(leerAvisos(null).resumenSemanal).toBe(true);
    expect(leerAvisos({ resumenSemanal: false }).resumenSemanal).toBe(false);
    expect(leerAvisos({ semana: '2026-11-23', pausa: '' })).toMatchObject({
      semana: '2026-11-23',
      pausa: null,
    });
  });
});
