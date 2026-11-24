import { describe, expect, it } from 'vitest';

import { diasDesde, motivoDeLlamada, ultimaActividad, type UsoDelClub } from '../src/index';

const ahora = new Date('2026-11-24T18:00:00Z');
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);

const sano: UsoDelClub = {
  creado: hace(30),
  tarjetas: 40,
  visitas7: 20,
  visitas7Previas: 22,
  visitas30: 80,
  ultimaVisita: hace(0),
  ultimaTarjeta: hace(2),
  ultimoAcceso: hace(1),
  duenioConContrasena: true,
};

describe('motivoDeLlamada', () => {
  it('un club con uso parejo no pide llamada', () => {
    expect(motivoDeLlamada(sano, ahora)).toBeNull();
  });

  it('a un club recién creado le da tiempo', () => {
    const nuevo = {
      ...sano,
      creado: hace(0),
      tarjetas: 0,
      ultimoAcceso: null,
      duenioConContrasena: false,
    };
    expect(motivoDeLlamada(nuevo, ahora)).toBeNull();
    expect(motivoDeLlamada({ ...nuevo, creado: hace(1) }, ahora)).toBe('sin-entrar');
  });

  it('sin contraseña cuenta como que no ha entrado', () => {
    expect(motivoDeLlamada({ ...sano, duenioConContrasena: false }, ahora)).toBe('sin-entrar');
  });

  it('sin tarjetas a partir del segundo día', () => {
    const vacio = { ...sano, tarjetas: 0, visitas7: 0, visitas7Previas: 0, ultimaVisita: null };
    expect(motivoDeLlamada({ ...vacio, creado: hace(1) }, ahora)).toBeNull();
    expect(motivoDeLlamada({ ...vacio, creado: hace(2) }, ahora)).toBe('sin-tarjetas');
  });

  it('con tarjetas pero sin visitas en 14 días, después de su primera semana', () => {
    const quieto = { ...sano, visitas7: 0, visitas7Previas: 0, ultimaVisita: hace(14) };
    expect(motivoDeLlamada(quieto, ahora)).toBe('sin-visitas');
    expect(motivoDeLlamada({ ...quieto, ultimaVisita: hace(13) }, ahora)).toBeNull();
    expect(motivoDeLlamada({ ...quieto, ultimaVisita: null }, ahora)).toBe('sin-visitas');
    expect(motivoDeLlamada({ ...quieto, ultimaVisita: null, creado: hace(6) }, ahora)).toBeNull();
  });

  it('caída de visitas solo con volumen', () => {
    expect(motivoDeLlamada({ ...sano, visitas7: 4, visitas7Previas: 10 }, ahora)).toBe('bajando');
    expect(motivoDeLlamada({ ...sano, visitas7: 5, visitas7Previas: 10 }, ahora)).toBeNull();
    expect(motivoDeLlamada({ ...sano, visitas7: 1, visitas7Previas: 5 }, ahora)).toBeNull();
  });
});

describe('ultimaActividad y diasDesde', () => {
  it('toma la fecha más reciente', () => {
    expect(ultimaActividad(sano)).toEqual(hace(0));
    expect(
      ultimaActividad({ ...sano, ultimaVisita: null, ultimaTarjeta: null, ultimoAcceso: null }),
    ).toBeNull();
    expect(ultimaActividad({ ...sano, ultimaVisita: null, ultimaTarjeta: hace(5) })).toEqual(
      hace(1),
    );
  });

  it('cuenta días completos y nunca negativos', () => {
    expect(diasDesde(null, ahora)).toBeNull();
    expect(diasDesde(hace(3.5), ahora)).toBe(3);
    expect(diasDesde(new Date(ahora.getTime() + 1000), ahora)).toBe(0);
  });
});
