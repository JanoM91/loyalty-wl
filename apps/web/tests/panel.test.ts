import { describe, expect, it } from 'vitest';

import {
  barraInferior,
  comandosDelPanel,
  seccionActiva,
  seccionesDelPanel,
} from '../src/lib/admin/panel';

describe('seccionActiva: qué sección del menú se marca', () => {
  it('el inicio solo coincide consigo mismo', () => {
    expect(seccionActiva('/admin')).toBe('inicio');
    expect(seccionActiva('/admin/ayuda')).toBe('ayuda');
  });

  it('las subpantallas cuentan como su sección', () => {
    expect(seccionActiva('/admin/lealtad/tarjetas/BAR-7Q2K')).toBe('clientes');
    expect(seccionActiva('/admin/lealtad/sucursales/cartel/principal')).toBe('sucursales');
    expect(seccionActiva('/admin/usuarios/nuevo')).toBe('equipo');
  });

  it('gana la ruta más larga: la caja no es «Números»', () => {
    expect(seccionActiva('/admin/lealtad')).toBe('numeros');
    expect(seccionActiva('/admin/lealtad/caja')).toBe('caja');
    expect(seccionActiva('/admin/lealtad/caja/acceso')).toBe('caja');
  });

  it('«Más» y rutas desconocidas', () => {
    expect(seccionActiva('/admin/mas')).toBe('mas');
    expect(seccionActiva('/admin/otra')).toBeNull();
    expect(seccionActiva(null)).toBeNull();
  });
});

describe('barraInferior: la barra del celular según el rol', () => {
  it('quien dirige ve Inicio, Caja, Clientes y Más', () => {
    expect(barraInferior('DUENO').map((p) => p.id)).toEqual(['inicio', 'caja', 'clientes', 'mas']);
    expect(barraInferior('GERENTE').map((p) => p.id)).toEqual([
      'inicio',
      'caja',
      'clientes',
      'mas',
    ]);
  });

  it('la cuenta de caja ve solo lo suyo', () => {
    expect(barraInferior('SUCURSAL').map((p) => p.id)).toEqual(['caja', 'ayuda', 'cuenta']);
  });
});

describe('secciones y paleta por rol', () => {
  it('marca, equipo y plan son de quien administra', () => {
    const gerente = seccionesDelPanel('GERENTE').map((s) => s.id);
    expect(gerente).not.toContain('marca');
    expect(gerente).not.toContain('equipo');
    expect(gerente).not.toContain('plan');
    expect(seccionesDelPanel('DUENO').map((s) => s.id)).toEqual(
      expect.arrayContaining(['marca', 'equipo', 'plan']),
    );
  });

  it('la paleta ya no ofrece el mapa', () => {
    const ids = comandosDelPanel('DUENO').map((c) => c.id);
    expect(ids).not.toContain('mapa');
    expect(ids).toContain('inicio');
  });
});
