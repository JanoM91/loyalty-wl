import { describe, expect, it } from 'vitest';

import {
  REGALOS_POR_OMISION,
  cumpleanosDelDia,
  leerRegalos,
  periodoDeRegalo,
  revisarRegalo,
  ventanaRegreso,
  vigenciaDeRegalo,
} from '../src';

const ZONA = 'America/Mexico_City';

describe('leerRegalos', () => {
  it('sin nada guardado, todo apagado', () => {
    expect(leerRegalos(undefined)).toEqual(REGALOS_POR_OMISION);
    expect(leerRegalos('basura')).toEqual(REGALOS_POR_OMISION);
  });

  it('lee lo guardado y descarta valores fuera de las opciones', () => {
    const r = leerRegalos({
      regreso: { activo: true, dias: 45, regalo: '  Un café   americano ', vigencia: 30 },
      cumple: { activo: true, dias: 99, regalo: 'Postre gratis', vigencia: 3 },
    });
    expect(r.regreso).toEqual({
      activo: true,
      dias: 45,
      regalo: 'Un café americano',
      vigencia: 30,
    });
    expect(r.cumple).toEqual({ activo: true, regalo: 'Postre gratis', vigencia: 7 });
  });

  it('no queda encendido sin regalo escrito', () => {
    const r = leerRegalos({ regreso: { activo: true, regalo: '' }, cumple: { activo: true } });
    expect(r.regreso.activo).toBe(false);
    expect(r.cumple.activo).toBe(false);
  });
});

describe('revisarRegalo', () => {
  it('limpia espacios y revisa el largo', () => {
    expect(revisarRegalo('  10%  en tu compra ')).toEqual({ ok: true, regalo: '10% en tu compra' });
    expect(revisarRegalo('ok').ok).toBe(false);
    expect(revisarRegalo('x'.repeat(61)).ok).toBe(false);
  });
});

describe('cumpleanosDelDia', () => {
  it('es el mismo día y mes', () => {
    expect(cumpleanosDelDia('2026-11-22')).toEqual([{ dia: 22, mes: 11 }]);
  });

  it('el 28 de febrero de un año no bisiesto también celebra a los del 29', () => {
    expect(cumpleanosDelDia('2027-02-28')).toEqual([
      { dia: 28, mes: 2 },
      { dia: 29, mes: 2 },
    ]);
    expect(cumpleanosDelDia('2028-02-28')).toEqual([{ dia: 28, mes: 2 }]);
    expect(cumpleanosDelDia('2028-02-29')).toEqual([{ dia: 29, mes: 2 }]);
  });
});

describe('periodoDeRegalo', () => {
  it('un cumpleaños por año y un «Te extrañamos» por día', () => {
    expect(periodoDeRegalo('CUMPLE', '2026-11-22')).toBe('2026');
    expect(periodoDeRegalo('REGRESO', '2026-11-22')).toBe('2026-11-22');
  });
});

describe('vigenciaDeRegalo', () => {
  it('7 días: del día que se da al sexto siguiente, y vence a la medianoche local', () => {
    const v = vigenciaDeRegalo('2026-11-22', 7, ZONA);
    expect(v.ultimoDia).toBe('2026-11-28');
    expect(v.vence.toISOString()).toBe('2026-11-29T06:00:00.000Z');
  });
});

describe('ventanaRegreso', () => {
  it('30 días: la última visita fue hace 30 días o más, y hace menos de 180', () => {
    const v = ventanaRegreso('2026-11-22', 30, ZONA);
    // Vino el 23 de octubre (hace 30 días): entra. El 24 (hace 29): no.
    expect(v.antesDe.toISOString()).toBe('2026-10-24T06:00:00.000Z');
    expect(v.despuesDe.toISOString()).toBe('2026-05-26T06:00:00.000Z');
    expect(v.sinRegaloDesde.toISOString()).toBe('2026-08-25T06:00:00.000Z');
  });
});
