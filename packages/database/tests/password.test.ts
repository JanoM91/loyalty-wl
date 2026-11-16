import { describe, expect, it } from 'vitest';

import {
  hashContrasena,
  validarContrasena,
  verificarContrasena,
  LONGITUD_MINIMA_CONTRASENA,
} from '../src/auth/password';

const CLAVE = 'cafe de olla y canela 2026';

describe('validarContrasena', () => {
  it('acepta una frase larga', () => {
    expect(validarContrasena(CLAVE).ok).toBe(true);
  });

  it('rechaza lo más corto que el mínimo y lo dice en el mensaje', () => {
    const r = validarContrasena('a'.repeat(LONGITUD_MINIMA_CONTRASENA - 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain(String(LONGITUD_MINIMA_CONTRASENA));
  });

  it('acepta exactamente el mínimo', () => {
    expect(validarContrasena('a'.repeat(LONGITUD_MINIMA_CONTRASENA)).ok).toBe(true);
  });

  it('rechaza una entrada absurdamente larga', () => {
    // Sin tope, alguien podría mandar megabytes y hacer trabajar a scrypt
    // durante minutos por petición.
    expect(validarContrasena('a'.repeat(5000)).ok).toBe(false);
  });
});

describe('hashContrasena', () => {
  it('no deja la contraseña legible en ninguna parte del resultado', async () => {
    const hash = await hashContrasena(CLAVE);
    expect(hash).not.toContain(CLAVE);
    expect(hash).not.toContain('masa madre');
  });

  it('produce hashes distintos para la misma contraseña', async () => {
    // Si dos personas eligen la misma clave, sus registros no deben delatarlo.
    const [a, b] = await Promise.all([hashContrasena(CLAVE), hashContrasena(CLAVE)]);
    expect(a).not.toBe(b);
  });

  it('guarda los parámetros dentro del hash para poder subirlos después', async () => {
    const partes = (await hashContrasena(CLAVE)).split('$');
    expect(partes).toHaveLength(6);
    expect(partes[0]).toBe('scrypt');
    expect(Number(partes[1])).toBeGreaterThanOrEqual(65536);
  });
});

describe('verificarContrasena', () => {
  it('acepta la contraseña correcta', async () => {
    const hash = await hashContrasena(CLAVE);
    expect(await verificarContrasena(CLAVE, hash)).toBe(true);
  });

  it('rechaza una contraseña equivocada', async () => {
    const hash = await hashContrasena(CLAVE);
    expect(await verificarContrasena('cafe de olla y canela 2027', hash)).toBe(false);
  });

  it('distingue mayúsculas de minúsculas', async () => {
    const hash = await hashContrasena(CLAVE);
    expect(await verificarContrasena(CLAVE.toUpperCase(), hash)).toBe(false);
  });

  it('rechaza la cadena vacía', async () => {
    const hash = await hashContrasena(CLAVE);
    expect(await verificarContrasena('', hash)).toBe(false);
  });

  it('acepta acentos escritos de dos maneras distintas', async () => {
    // "Cafetería" con í precompuesta y con i + tilde combinante son la misma
    // palabra para quien la teclea, y algunos teclados producen una u otra.
    const precompuesta = 'Cafetería de barrio';
    const descompuesta = 'Cafetería de barrio';
    expect(precompuesta).not.toBe(descompuesta);

    const hash = await hashContrasena(precompuesta);
    expect(await verificarContrasena(descompuesta, hash)).toBe(true);
  });

  it('devuelve false en lugar de reventar ante un hash corrupto', async () => {
    // Un registro dañado debe impedir la entrada, no tumbar la pantalla.
    for (const basura of ['', 'x', 'scrypt$1$2', 'bcrypt$1$2$3$4$5', 'scrypt$a$b$c$d$e', '$$$$$']) {
      expect(await verificarContrasena(CLAVE, basura)).toBe(false);
    }
  });

  it('rechaza un hash con parámetros disparatados sin intentar calcularlo', async () => {
    // N gigantesco en un registro manipulado agotaría la memoria del servidor.
    const bomba = `scrypt$1073741824$8$1$${Buffer.from('sal').toString('base64')}$${Buffer.from(
      'x'.repeat(64),
    ).toString('base64')}`;

    const inicio = Date.now();
    expect(await verificarContrasena(CLAVE, bomba)).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('rechaza un hash cuya parte final está vacía', async () => {
    expect(await verificarContrasena(CLAVE, 'scrypt$65536$8$1$c2Fs$')).toBe(false);
  });
});
