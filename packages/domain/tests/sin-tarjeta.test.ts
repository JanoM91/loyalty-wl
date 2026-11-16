import { describe, expect, it } from 'vitest';

import {
  nombresCoinciden,
  repartirNombre,
  validarComprobanteSinTarjeta,
  validarNombreDicho,
} from '../src/loyalty/sin-tarjeta';

describe('validarNombreDicho', () => {
  it('exige al menos dos letras', () => {
    expect(validarNombreDicho('')).toContain('nombre');
    expect(validarNombreDicho('  A ')).toContain('nombre');
    expect(validarNombreDicho('Ana')).toBeNull();
  });
});

describe('validarComprobanteSinTarjeta', () => {
  it('acepta folio o foto, al menos uno', () => {
    expect(validarComprobanteSinTarjeta({ folio: 'C2-12044', fotoTicketUrl: null })).toBeNull();
    expect(
      validarComprobanteSinTarjeta({ folio: '', fotoTicketUrl: 'https://f/1.jpg' }),
    ).toBeNull();
    expect(
      validarComprobanteSinTarjeta({ folio: ' c2 12044 ', fotoTicketUrl: 'https://f/1.jpg' }),
    ).toBeNull();
  });

  it('rechaza sin folio y sin foto; un folio de solo signos cuenta como vacío', () => {
    expect(validarComprobanteSinTarjeta({ folio: '', fotoTicketUrl: null })).toContain('ticket');
    expect(validarComprobanteSinTarjeta({ folio: ' -- ', fotoTicketUrl: null })).toContain('folio');
  });
});

describe('nombresCoinciden', () => {
  it('ignora acentos, mayúsculas y apellidos de más', () => {
    expect(nombresCoinciden('Mariana López', 'mariana lopez ruiz')).toBe(true);
    expect(nombresCoinciden('lopez', 'Mariana López Ruiz')).toBe(true);
  });

  it('no acepta coincidencias parciales ni palabras cortas', () => {
    expect(nombresCoinciden('Ana', 'Mariana López')).toBe(false);
    expect(nombresCoinciden('Juan de la Cruz', 'María de los Ángeles')).toBe(false);
  });

  it('devuelve null cuando no hay con qué comparar', () => {
    expect(nombresCoinciden('Ana', null)).toBeNull();
    expect(nombresCoinciden('', 'Mariana')).toBeNull();
    expect(nombresCoinciden('Jo', 'Mariana')).toBeNull();
  });
});

describe('repartirNombre', () => {
  it('con tres o más palabras, las dos últimas son los apellidos', () => {
    expect(repartirNombre('  Mariana   López Ruiz ')).toEqual({
      nombre: 'Mariana',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Ruiz',
    });
    expect(repartirNombre('María José Pérez Gómez')).toEqual({
      nombre: 'María José',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Gómez',
    });
  });

  it('con dos o una, solo lo que alcanza', () => {
    expect(repartirNombre('Mariana López')).toEqual({
      nombre: 'Mariana',
      apellidoPaterno: 'López',
      apellidoMaterno: '',
    });
    expect(repartirNombre('Mariana')).toEqual({
      nombre: 'Mariana',
      apellidoPaterno: '',
      apellidoMaterno: '',
    });
    expect(repartirNombre('')).toEqual({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
  });
});
