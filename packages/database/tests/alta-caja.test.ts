import { describe, expect, it } from 'vitest';
import { PROGRAMA_BASE } from '@wl/domain';

import { UMBRAL_EVIDENCIA, validarAltaCaja, validarMigracion } from '../src/lealtad/alta-caja';

/**
 * Reglas del alta en caja y de la migración de la tarjeta física, sin base.
 * Lo que sí toca la base (unicidad del contacto, bloqueo de la tarjeta) va en
 * la prueba de integración.
 */

const base = {
  nombre: 'Mariana',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Ruiz',
  celular: '228 123 4567',
  correo: '',
  visitasFisicas: 0,
  fotoTarjetaFisicaUrl: null,
};

describe('validarAltaCaja', () => {
  it('acepta nombre completo y un solo contacto', () => {
    expect(validarAltaCaja(base, PROGRAMA_BASE)).toBeNull();
    expect(
      validarAltaCaja({ ...base, celular: '', correo: 'm@correo.mx' }, PROGRAMA_BASE),
    ).toBeNull();
  });

  it('exige el nombre completo', () => {
    expect(validarAltaCaja({ ...base, nombre: '' }, PROGRAMA_BASE)).toContain('nombre');
    expect(validarAltaCaja({ ...base, apellidoPaterno: 'L' }, PROGRAMA_BASE)).toContain('paterno');
    expect(validarAltaCaja({ ...base, apellidoMaterno: '' }, PROGRAMA_BASE)).toContain('materno');
  });

  it('exige al menos un contacto válido', () => {
    expect(validarAltaCaja({ ...base, celular: '' }, PROGRAMA_BASE)).toContain('al menos uno');
    expect(validarAltaCaja({ ...base, celular: '123' }, PROGRAMA_BASE)).toContain('10 dígitos');
    expect(validarAltaCaja({ ...base, correo: 'sin-arroba' }, PROGRAMA_BASE)).toContain('correo');
  });
});

describe('validarMigracion', () => {
  const sin = { fotoUrl: null, celular: '2281234567', correo: null };

  it('sin tarjeta física no pide nada', () => {
    expect(validarMigracion({ visitas: 0, ...sin }, PROGRAMA_BASE)).toBeNull();
  });

  it('con la visita de hoy, la tarjeta nunca nace llena: máximo posiciones − 2', () => {
    expect(validarMigracion({ visitas: 3, ...sin }, PROGRAMA_BASE)).toBeNull();
    expect(validarMigracion({ visitas: 9, ...sin }, PROGRAMA_BASE)).toContain('máximo 8');
    // Tarjeta existente con 4 estampas: 4 + v + 1 ≤ 9 → v ≤ 4.
    expect(validarMigracion({ visitas: 5, ...sin }, PROGRAMA_BASE, 4)).toContain('máximo 4');
    expect(
      validarMigracion(
        { visitas: 4, fotoUrl: 'f', celular: '2281234567', correo: 'a@b.mx' },
        PROGRAMA_BASE,
        4,
      ),
    ).toBeNull();
  });

  it(`a partir de ${UMBRAL_EVIDENCIA} estampas en total pide foto, celular y correo`, () => {
    // 4 migradas + 1 de hoy = 5.
    expect(validarMigracion({ visitas: 4, ...sin }, PROGRAMA_BASE)).toContain('foto');
    expect(
      validarMigracion(
        { visitas: 4, fotoUrl: 'https://f/x.jpg', celular: '2281234567', correo: null },
        PROGRAMA_BASE,
      ),
    ).toContain('celular y el correo');
    expect(
      validarMigracion(
        { visitas: 4, fotoUrl: 'https://f/x.jpg', celular: '2281234567', correo: 'a@b.mx' },
        PROGRAMA_BASE,
      ),
    ).toBeNull();
    // 3 + 1 = 4: todavía sin evidencia.
    expect(validarMigracion({ visitas: 3, ...sin }, PROGRAMA_BASE)).toBeNull();
  });

  it('cuenta las estampas que ya tiene la tarjeta para el umbral', () => {
    // 2 actuales + 2 migradas + 1 de hoy = 5.
    expect(validarMigracion({ visitas: 2, ...sin }, PROGRAMA_BASE, 2)).toContain('foto');
  });
});
