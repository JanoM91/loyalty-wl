import { describe, expect, it } from 'vitest';

import { esZonaHorariaValida, fechaLocal, inicioDelDia, sumarDias } from '../src/shared/fecha';

describe('fechas civiles por zona horaria', () => {
  it('da la fecha del negocio, no la del servidor', () => {
    const instante = new Date('2026-11-16T03:30:00.000Z');
    expect(fechaLocal(instante)).toBe('2026-11-15');
    expect(fechaLocal(instante, 'America/Mexico_City')).toBe('2026-11-15');
    expect(fechaLocal(instante, 'America/Tijuana')).toBe('2026-11-15');
    expect(fechaLocal(instante, 'Europe/Madrid')).toBe('2026-11-16');
  });

  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('calcula el instante en que empieza el día en cada zona', () => {
    expect(inicioDelDia('2026-11-15').toISOString()).toBe('2026-11-15T06:00:00.000Z');
    expect(inicioDelDia('2026-11-15', 'America/Tijuana').toISOString()).toBe(
      '2026-11-15T08:00:00.000Z',
    );
    expect(inicioDelDia('2026-07-15', 'America/Tijuana').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    );
    expect(inicioDelDia('2026-11-15', 'Europe/Madrid').toISOString()).toBe(
      '2026-11-14T23:00:00.000Z',
    );
  });

  it('reconoce zonas horarias válidas', () => {
    expect(esZonaHorariaValida('America/Cancun')).toBe(true);
    expect(esZonaHorariaValida('Xalapa/Centro')).toBe(false);
  });
});
