import { describe, expect, it } from 'vitest';

import {
  correoReenvio,
  esCanalReenvio,
  HORAS_ENLACE_REENVIO,
  mensajeReenvioWhatsApp,
  saludoTarjeta,
  vigenciaEnlace,
  type DatosReenvio,
} from '../src/loyalty/reenvio';

const URL = 'https://cafe.ejemplo.mx/acceso/abc123';

const base: DatosReenvio = {
  nombre: 'Alejandro Ortiz',
  estampas: 4,
  url: URL,
  creaContrasena: true,
  negocio: 'Café El Buentueste',
  sitio: 'cafe.ejemplo.mx',
  minutos: HORAS_ENLACE_REENVIO * 60,
};

describe('vigenciaEnlace', () => {
  it('dice la duración en la unidad que entiende la persona', () => {
    expect(vigenciaEnlace(HORAS_ENLACE_REENVIO * 60)).toBe('3 días');
    expect(vigenciaEnlace(24 * 60)).toBe('24 horas');
    expect(vigenciaEnlace(48 * 60)).toBe('2 días');
    expect(vigenciaEnlace(60)).toBe('1 hora');
    expect(vigenciaEnlace(15)).toBe('15 minutos');
    expect(vigenciaEnlace(1)).toBe('1 minuto');
  });
});

describe('saludoTarjeta', () => {
  it('usa el primer nombre o solo «Hola» si la tarjeta no tiene nombre', () => {
    expect(saludoTarjeta('  Mariana  López Ruiz ')).toBe('Hola Mariana');
    expect(saludoTarjeta(null)).toBe('Hola');
    expect(saludoTarjeta('   ')).toBe('Hola');
  });
});

describe('esCanalReenvio', () => {
  it('solo acepta los tres canales', () => {
    expect(esCanalReenvio('WHATSAPP')).toBe(true);
    expect(esCanalReenvio('CORREO')).toBe(true);
    expect(esCanalReenvio('PANTALLA')).toBe(true);
    expect(esCanalReenvio('SMS')).toBe(false);
    expect(esCanalReenvio(undefined)).toBe(false);
  });
});

describe('mensajeReenvioWhatsApp', () => {
  it('lleva el enlace, las estampas, la vigencia y el aviso de abrirlo en el navegador', () => {
    const m = mensajeReenvioWhatsApp(base);
    expect(m).toContain('Hola Alejandro');
    expect(m).toContain('ya lleva 4 sellos');
    expect(m).toContain(URL);
    expect(m).toContain('vence en 3 días');
    expect(m).toContain('Safari o Chrome');
    // Sin contraseña: le dice que la cree y con qué dato entra después.
    expect(m).toContain('crea tu contraseña');
    expect(m).toContain('tu celular');
    // El enlace va solo, en su propio renglón, para que WhatsApp lo haga tocable.
    expect(m.split('\n\n')).toContain(URL);
  });

  it('con contraseña ya creada no le pide crear otra', () => {
    const m = mensajeReenvioWhatsApp({ ...base, creaContrasena: false });
    expect(m).not.toContain('crea tu contraseña');
    expect(m).toContain('tu celular y tu contraseña');
  });

  it('cuida el singular y la tarjeta sin estampas ni nombre', () => {
    expect(mensajeReenvioWhatsApp({ ...base, estampas: 1 })).toContain('ya lleva 1 sello.');
    const vacia = mensajeReenvioWhatsApp({ ...base, nombre: null, estampas: 0 });
    expect(vacia.startsWith('Hola, te escribimos de Café El Buentueste.')).toBe(true);
    expect(vacia).toContain('ya está lista');
  });
});

describe('correoReenvio', () => {
  it('arma asunto y párrafos con el correo como dato de entrada', () => {
    const c = correoReenvio(base);
    expect(c.asunto).toBe('Tu tarjeta de lealtad de Café El Buentueste te espera');
    const texto = c.parrafos.join(' ');
    expect(texto).toContain('Hola Alejandro');
    expect(texto).toContain('ya lleva 4 sellos');
    expect(texto).toContain('tu correo');
    expect(texto).toContain('vence en 3 días');
    // El enlace va en el botón de la plantilla, no en los párrafos.
    expect(texto).not.toContain(URL);
  });
});
