import { describe, expect, it } from 'vitest';

import {
  correoDeAviso,
  instanteDeMexico,
  parrafosDe,
  revisarAviso,
} from '../src/lib/avisos-plataforma';

describe('avisos de la plataforma a los dueños', () => {
  it('arma el correo con el nombre del dueño, el mensaje y el botón a su panel', () => {
    const c = correoDeAviso({
      para: 'ana@ejemplo.mx',
      nombre: 'Ana López',
      club: { nombre: 'Barbería León', slug: 'barberia-leon' },
      asunto: 'Novedad en tu club',
      mensaje: 'Ya puedes dar regalos\nde cumpleaños.\n\nEnciéndelos en tu panel.',
    });
    expect(c.para).toBe('ana@ejemplo.mx');
    expect(c.asunto).toBe('Novedad en tu club');
    expect(c.texto).toContain('Hola, Ana:');
    expect(c.texto).toContain('Ya puedes dar regalos de cumpleaños.\n\nEnciéndelos en tu panel.');
    expect(c.texto).toContain('https://club-lealtad.com/barberia-leon/admin');
    expect(c.html).toContain('dueño del club Barbería León');
  });

  it('no deja pasar HTML del mensaje sin escapar', () => {
    const c = correoDeAviso({
      para: 'a@b.mx',
      nombre: '',
      club: { nombre: 'Club', slug: 'club' },
      asunto: 'Hola',
      mensaje: 'Mira <script>alert(1)</script> esto',
    });
    expect(c.html).not.toContain('<script>');
    expect(c.texto.startsWith('Hola:')).toBe(true);
  });

  it('separa párrafos por líneas en blanco y revisa largos', () => {
    expect(parrafosDe('uno\r\n\r\n\r\ndos\ntres')).toEqual(['uno', 'dos tres']);
    expect(revisarAviso('', 'Un mensaje suficiente')).toBe('Escribe el asunto.');
    expect(revisarAviso('Asunto', 'corto')).toBe('Escribe el mensaje.');
    expect(revisarAviso('Asunto', 'Un mensaje suficiente')).toBeNull();
  });
});

describe('instanteDeMexico: la hora del formulario es la del centro de México', () => {
  it('9:30 en México son las 15:30 UTC (sin horario de verano)', () => {
    expect(instanteDeMexico('2026-11-25T09:30')?.toISOString()).toBe('2026-11-25T15:30:00.000Z');
    expect(instanteDeMexico('2027-07-01T00:00')?.toISOString()).toBe('2027-07-01T06:00:00.000Z');
  });

  it('rechaza lo que no es fecha y hora', () => {
    expect(instanteDeMexico('')).toBeNull();
    expect(instanteDeMexico('mañana')).toBeNull();
    expect(instanteDeMexico('2026-11-25')).toBeNull();
  });
});
