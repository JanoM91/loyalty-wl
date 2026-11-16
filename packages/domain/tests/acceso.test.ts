import { describe, expect, it } from 'vitest';

import {
  CONTRASENA_MAXIMO,
  ERROR_ACCESO_GENERICO,
  evaluarBloqueo,
  haceCuanto,
  leerDatoDeAcceso,
  mensajeEnlaceAcceso,
  RESPUESTA_OLVIDE_CONTRASENA,
  validarContrasenaTarjeta,
  venceSolicitud,
  type IntentoAcceso,
} from '../src/loyalty/acceso';

const NEGOCIO = 'Café El Buentueste';

describe('leerDatoDeAcceso', () => {
  it('normaliza el celular a 10 dígitos quitando +52, espacios y guiones', () => {
    for (const escrito of [
      '2288185964',
      '228 818 5964',
      '228-818-5964',
      '+52 228 818 5964',
      '+52-228-818-5964',
      '52 2288185964',
      '+521 228 818 5964',
      '(228) 818-5964',
      '  2288185964  ',
    ]) {
      expect(leerDatoDeAcceso(escrito)).toEqual({ tipo: 'CELULAR', valor: '2288185964' });
    }
  });

  it('normaliza el correo a minúsculas sin espacios', () => {
    expect(leerDatoDeAcceso('  Ana.Lopez@Correo.MX ')).toEqual({
      tipo: 'CORREO',
      valor: 'ana.lopez@correo.mx',
    });
  });

  it('rechaza lo que no es ni celular ni correo', () => {
    expect(leerDatoDeAcceso('')).toBeNull();
    expect(leerDatoDeAcceso('12345')).toBeNull();
    expect(leerDatoDeAcceso('ana@')).toBeNull();
    expect(leerDatoDeAcceso('WL-ABCD-EFGH')).toBeNull();
  });
});

describe('validarContrasenaTarjeta', () => {
  it('acepta frases y contraseñas de 8 a 128 caracteres sin exigir mayúsculas ni símbolos', () => {
    expect(validarContrasenaTarjeta('conchas de vainilla')).toBeNull();
    expect(validarContrasenaTarjeta('micafedelamanana')).toBeNull();
    expect(validarContrasenaTarjeta('gato9perro')).toBeNull();
    expect(validarContrasenaTarjeta('a'.repeat(7) + 'b')).toBeNull();
    expect(validarContrasenaTarjeta('x'.repeat(CONTRASENA_MAXIMO - 1) + 'y')).toBeNull();
    // El nombre del negocio dentro de una frase propia sí vale.
    expect(
      validarContrasenaTarjeta('amo el cafe de buentueste los domingos', { negocio: NEGOCIO }),
    ).toBeNull();
    // Sin nombre de negocio, no hay marca que rechazar.
    expect(validarContrasenaTarjeta('buentueste2026')).toBeNull();
  });

  it('exige mínimo 8 y máximo 128 caracteres', () => {
    expect(validarContrasenaTarjeta('corta12')).toMatch(/al menos 8/);
    expect(validarContrasenaTarjeta('')).toMatch(/al menos 8/);
    expect(validarContrasenaTarjeta('ab'.repeat(65))).toMatch(/máximo 128/);
  });

  it('cuenta caracteres, no bytes: los acentos y la ñ valen uno', () => {
    expect(validarContrasenaTarjeta('ñandúñan')).toBeNull();
  });

  it('rechaza contraseñas comunes, sin importar mayúsculas', () => {
    for (const comun of [
      'password',
      'PASSWORD1',
      'Contraseña',
      'contrasena123',
      'iloveyou',
      'TeAmo123',
    ]) {
      expect(validarContrasenaTarjeta(comun)).toMatch(/más usadas/);
    }
  });

  it('rechaza el nombre del negocio y sus variantes', () => {
    for (const marca of [
      'buentuestebuentueste',
      'Buentueste2026',
      'BUENTUESTE2026!',
      'buentueste123',
      'bu3ntu3st3mx',
      'buentueste_1234',
      'cafe el buen tueste',
      'CafeElBuenTueste1',
    ]) {
      expect(validarContrasenaTarjeta(marca, { negocio: NEGOCIO }), marca).toMatch(
        /nombre del negocio/,
      );
    }
  });

  it('rechaza un solo carácter repetido', () => {
    expect(validarContrasenaTarjeta('aaaaaaaa')).toMatch(/repetido/);
    expect(validarContrasenaTarjeta('9999 9999')).toMatch(/repetido/);
  });

  it('rechaza secuencias, al derecho, al revés y del teclado', () => {
    for (const seq of [
      'abcdefgh',
      '23456789',
      '98765432',
      'qwertyui',
      'poiuytre',
      'asdfghjk',
      '78901234',
    ]) {
      expect(validarContrasenaTarjeta(seq), seq).toMatch(/secuencia/);
    }
  });

  it('rechaza el celular de la tarjeta, con o sin formato', () => {
    const contexto = { celular: '2288185964' };
    expect(validarContrasenaTarjeta('2288185964', contexto)).toMatch(/celular/);
    expect(validarContrasenaTarjeta('228 818 5964', contexto)).toMatch(/celular/);
    expect(validarContrasenaTarjeta('+52 228-818-5964', contexto)).toMatch(/celular/);
    expect(validarContrasenaTarjeta('mi2288185964', contexto)).toMatch(/celular/);
    expect(validarContrasenaTarjeta('88185964', contexto)).toMatch(/celular/);
    // Otro número no es el suyo.
    expect(validarContrasenaTarjeta('5512340987', contexto)).toBeNull();
    // Sin celular en la tarjeta, no hay con qué comparar.
    expect(validarContrasenaTarjeta('2288185964')).toBeNull();
  });
});

describe('evaluarBloqueo', () => {
  const ahora = new Date('2026-10-25T18:00:00Z');
  const hace = (min: number, exito = false): IntentoAcceso => ({
    fecha: new Date(ahora.getTime() - min * 60_000),
    exito,
  });

  it('no bloquea con 4 fallos', () => {
    expect(evaluarBloqueo([hace(1), hace(2), hace(3), hace(4)], ahora)).toEqual({
      bloqueado: false,
      fallos: 4,
    });
  });

  it('bloquea 15 minutos tras el quinto fallo', () => {
    const r = evaluarBloqueo([hace(1), hace(2), hace(3), hace(4), hace(5)], ahora);
    expect(r.bloqueado).toBe(true);
    // El quinto más reciente fue hace 5 min: libera en 10.
    expect(r.bloqueado && r.hasta.toISOString()).toBe('2026-10-25T18:10:00.000Z');
  });

  it('los fallos de hace más de 15 minutos ya no cuentan', () => {
    expect(evaluarBloqueo([hace(1), hace(2), hace(3), hace(4), hace(16)], ahora).bloqueado).toBe(
      false,
    );
  });

  it('una entrada correcta reinicia la cuenta de la tarjeta, pero no la de la IP', () => {
    const intentos = [hace(1), hace(2), hace(3, true), hace(4), hace(5), hace(6)];
    expect(evaluarBloqueo(intentos, ahora, { reiniciaConExito: true }).bloqueado).toBe(false);
    expect(evaluarBloqueo(intentos, ahora).bloqueado).toBe(true);
  });

  it('no cuenta fallos anteriores a `desde` (contraseña recién restablecida)', () => {
    const intentos = [hace(1), hace(2), hace(3), hace(4), hace(5)];
    const desde = new Date(ahora.getTime() - 90_000);
    expect(evaluarBloqueo(intentos, ahora, { desde })).toEqual({ bloqueado: false, fallos: 1 });
  });

  it('ignora intentos con fecha futura', () => {
    const futuro = { fecha: new Date(ahora.getTime() + 60_000), exito: false };
    expect(evaluarBloqueo([futuro, futuro, futuro, futuro, futuro], ahora).bloqueado).toBe(false);
  });

  it('respeta límites distintos', () => {
    expect(evaluarBloqueo([hace(1), hace(2)], ahora, { maxFallos: 2, minutos: 5 }).bloqueado).toBe(
      true,
    );
  });
});

describe('solicitudes de acceso', () => {
  it('vencen a las 48 horas', () => {
    expect(venceSolicitud(new Date('2026-10-25T10:00:00Z')).toISOString()).toBe(
      '2026-10-27T10:00:00.000Z',
    );
  });

  it('dicen hace cuánto llegaron', () => {
    const ahora = new Date('2026-10-25T18:00:00Z');
    const antes = (min: number) => new Date(ahora.getTime() - min * 60_000);
    expect(haceCuanto(antes(0), ahora)).toBe('hace un momento');
    expect(haceCuanto(antes(7), ahora)).toBe('hace 7 min');
    expect(haceCuanto(antes(125), ahora)).toBe('hace 2 h');
    expect(haceCuanto(antes(24 * 60 + 5), ahora)).toBe('hace 1 día');
    expect(haceCuanto(antes(3 * 24 * 60), ahora)).toBe('hace 3 días');
    expect(haceCuanto(new Date(ahora.getTime() + 60_000), ahora)).toBe('hace un momento');
  });

  it('el mensaje de WhatsApp lleva el enlace y pide abrirlo en Safari o Chrome', () => {
    const m = mensajeEnlaceAcceso('Ana Pérez López', 'https://cafe.ejemplo.mx/acceso/x', NEGOCIO);
    expect(m).toMatch(/^Hola Ana,/);
    expect(m).toContain('https://cafe.ejemplo.mx/acceso/x');
    expect(m).toContain('Safari o Chrome');
    expect(m).toContain('24 horas');
    expect(mensajeEnlaceAcceso(null, 'u', NEGOCIO)).toMatch(
      /^Hola, te escribimos de Café El Buentueste\./,
    );
  });

  it('las respuestas genéricas no dicen si la tarjeta existe', () => {
    expect(ERROR_ACCESO_GENERICO).toBe('Correo, celular o contraseña incorrectos.');
    expect(RESPUESTA_OLVIDE_CONTRASENA).toMatch(/^Si encontramos tu tarjeta/);
  });
});
