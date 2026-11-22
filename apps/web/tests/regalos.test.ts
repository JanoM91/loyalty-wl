import { afterEach, describe, expect, it, vi } from 'vitest';

import { correoRegalo, origenDelClub, textoCorreoRegalo } from '../src/lib/regalos';

const club = { nombre: 'Café Luna', domicilio: 'Xalapa, Ver.' };

describe('correos de regalos automáticos', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('«Te extrañamos» dice el regalo y hasta cuándo vale', () => {
    const t = textoCorreoRegalo({
      tipo: 'REGRESO',
      nombre: 'Ana López',
      club: 'Café Luna',
      regalo: 'Un café americano',
      ultimoDia: '2026-12-05',
    });
    expect(t.asunto).toBe('Te extrañamos en Café Luna');
    expect(t.parrafos[0]).toBe('Hola, Ana:');
    expect(t.parrafos.join(' ')).toContain('Un café americano');
    expect(t.parrafos.join(' ')).toContain('5 de diciembre');
  });

  it('cumpleaños: felicita por su nombre, o sin nombre si no lo dio', () => {
    expect(
      textoCorreoRegalo({
        tipo: 'CUMPLE',
        nombre: 'Luis',
        club: 'Café Luna',
        regalo: 'Un postre',
        ultimoDia: '2026-11-28',
      }).asunto,
    ).toBe('¡Feliz cumpleaños, Luis!');
    expect(
      textoCorreoRegalo({
        tipo: 'CUMPLE',
        nombre: null,
        club: 'Café Luna',
        regalo: 'Un postre',
        ultimoDia: '2026-11-28',
      }).asunto,
    ).toBe('¡Feliz cumpleaños!');
  });

  it('lleva la tarjeta, el pie del negocio y la baja con un toque', () => {
    const c = correoRegalo({
      tipo: 'REGRESO',
      para: 'ana@ejemplo.mx',
      nombre: 'Ana',
      club,
      regalo: 'Un café',
      ultimoDia: '2026-12-05',
      tarjeta: 'https://club-lealtad.com/cafe-luna/lealtad/mi/abc',
      baja: 'https://club-lealtad.com/cafe-luna/lealtad/baja/xyz',
    });
    expect(c.texto).toContain('Ver mi tarjeta: https://club-lealtad.com/cafe-luna/lealtad/mi/abc');
    expect(c.texto).toContain('aceptaste promociones de Café Luna');
    expect(c.encabezados?.['List-Unsubscribe']).toBe(
      '<https://club-lealtad.com/cafe-luna/lealtad/baja/xyz/rapida>',
    );
    expect(c.html).toContain('Ya no quiero recibir promociones');
  });

  it('la prueba del dueño lo dice y no lleva baja', () => {
    const c = correoRegalo({
      tipo: 'CUMPLE',
      para: 'duenio@ejemplo.mx',
      nombre: 'Jano',
      club,
      regalo: 'Un postre',
      ultimoDia: '2026-11-28',
      tarjeta: 'https://club-lealtad.com/cafe-luna/lealtad',
      baja: null,
      prueba: true,
    });
    expect(c.asunto).toBe('Prueba: ¡Feliz cumpleaños, Jano!');
    expect(c.encabezados).toBeUndefined();
  });

  it('el club vive en club-lealtad.com/<club>, o en su propio sitio en la instalación privada', () => {
    vi.stubEnv('WL_ORIGEN_SITIO', '');
    vi.stubEnv('WL_NEGOCIO_UNICO', '');
    expect(origenDelClub('cafe-luna')).toBe('https://club-lealtad.com/cafe-luna');
    vi.stubEnv('WL_ORIGEN_SITIO', 'https://lealtad.cafeluna.mx/');
    vi.stubEnv('WL_NEGOCIO_UNICO', 'cafe-luna');
    expect(origenDelClub('cafe-luna')).toBe('https://lealtad.cafeluna.mx');
  });
});
