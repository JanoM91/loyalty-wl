import { describe, expect, it } from 'vitest';

import { armarCsv, celdaCsv, descargaCsv, fechaCsv } from '../src/lib/csv';

describe('csv para Excel', () => {
  it('pone comillas solo cuando hace falta y duplica las internas', () => {
    expect(celdaCsv('Café')).toBe('Café');
    expect(celdaCsv('Tacos, el güero')).toBe('"Tacos, el güero"');
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv('dos\nlíneas')).toBe('"dos\nlíneas"');
  });

  it('desactiva fórmulas en textos', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv('+52 228')).toBe("'+52 228");
    expect(celdaCsv('@usuario')).toBe("'@usuario");
    expect(celdaCsv('-3')).toBe("'-3");
    // Un número negativo de verdad no lleva apóstrofo.
    expect(celdaCsv(-3)).toBe('-3');
  });

  it('vacíos, booleanos y fechas', () => {
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv(undefined)).toBe('');
    expect(celdaCsv(true)).toBe('Sí');
    expect(celdaCsv(Number.NaN)).toBe('');
    expect(fechaCsv(new Date('2026-11-24T19:05:00Z'))).toBe('2026-11-24 13:05');
    expect(celdaCsv(new Date('2026-11-24T19:05:00Z'))).toBe('2026-11-24 13:05');
  });

  it('arma el archivo con BOM y CRLF', () => {
    const texto = armarCsv(
      ['A', 'B'],
      [
        [1, 'x'],
        [2, 'y, z'],
      ],
    );
    expect(texto).toBe('﻿A,B\r\n1,x\r\n2,"y, z"\r\n');
  });

  it('la descarga no se guarda en caché y limpia el nombre', () => {
    const r = descargaCsv('clubes 2026/11.csv', 'a');
    expect(r.headers.get('Cache-Control')).toBe('no-store, private');
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="clubes-2026-11.csv"');
  });
});
