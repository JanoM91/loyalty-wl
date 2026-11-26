import { describe, expect, it } from 'vitest';

import {
  PERMISOS_POR_OMISION,
  RETOS_POR_OMISION,
  ahorroAnual,
  arcadeVigente,
  avanceReto,
  conArcade,
  clavePeriodo,
  codigoCupon,
  configEfectiva,
  inicioDePeriodo,
  juegosDeHoy,
  leerConfigArcade,
  leerPermisosArcade,
  leerPrecios,
  lunesDe,
  nombrePublico,
  normalizarPalabra,
  origenArcade,
  puntajeCreible,
  racha,
  textoReto,
  type PartidaResumen,
} from '../src';

const partidas: PartidaResumen[] = [
  { dia: '2026-11-16', juego: 'atrapa', puntos: 300, nivel: 2 },
  { dia: '2026-11-16', juego: 'memorama', puntos: 900, nivel: 4 },
  { dia: '2026-11-18', juego: 'atrapa', puntos: 120, nivel: 1 },
];

describe('arcade: periodos y retos', () => {
  it('la semana empieza en lunes', () => {
    expect(lunesDe('2026-11-21')).toBe('2026-11-16'); // sábado
    expect(lunesDe('2026-11-16')).toBe('2026-11-16');
    expect(lunesDe('2026-11-22')).toBe('2026-11-16'); // domingo
    expect(inicioDePeriodo('mes', '2026-11-21')).toBe('2026-11-01');
    expect(clavePeriodo('semana', '2026-11-21')).toBe('S2026-11-16');
    expect(clavePeriodo('mes', '2026-11-21')).toBe('M2026-11');
  });

  it('mide cada tipo de reto', () => {
    expect(avanceReto({ tipo: 'dias' }, partidas)).toBe(2);
    expect(avanceReto({ tipo: 'partidas' }, partidas)).toBe(3);
    expect(avanceReto({ tipo: 'puntaje' }, partidas)).toBe(900);
    expect(avanceReto({ tipo: 'acumulado' }, partidas)).toBe(1320);
    expect(avanceReto({ tipo: 'juegos' }, partidas)).toBe(2);
    expect(avanceReto({ tipo: 'nivel' }, partidas)).toBe(4);
    expect(textoReto({ tipo: 'dias', meta: 5, periodo: 'semana' })).toBe(
      'Juega 5 días distintos esta semana',
    );
  });

  it('la racha cuenta días seguidos hasta hoy o ayer', () => {
    expect(racha(['2026-11-19', '2026-11-20', '2026-11-21'], '2026-11-21')).toBe(3);
    expect(racha(['2026-11-19', '2026-11-20'], '2026-11-21')).toBe(2);
    expect(racha(['2026-11-18'], '2026-11-21')).toBe(0);
  });
});

describe('arcade: validación de partidas', () => {
  it('acepta puntajes creíbles y rechaza los imposibles', () => {
    expect(puntajeCreible('atrapa', 600, 4, 60)).toBe(true);
    expect(puntajeCreible('atrapa', 99_999, 4, 60)).toBe(false);
    expect(puntajeCreible('atrapa', 10, 1, 1)).toBe(false); // muy corta
    expect(puntajeCreible('atrapa', 10, 40, 30)).toBe(false); // nivel imposible
    expect(puntajeCreible('atrapa', -5, 1, 30)).toBe(false);
  });
});

describe('arcade: permisos y configuración', () => {
  const pagado = { ...PERMISOS_POR_OMISION, activo: true, pagadoHasta: '2099-01-01T00:00:00.000Z' };

  it('sin pago vigente no se juega', () => {
    expect(arcadeVigente(null)).toBe(false);
    expect(arcadeVigente({ ...pagado, activo: false })).toBe(false);
    expect(arcadeVigente({ ...pagado, pagadoHasta: '2020-01-01T00:00:00.000Z' })).toBe(false);
    expect(arcadeVigente(pagado)).toBe(true);
  });

  it('la prueba incluye «Juega y gana» hasta su fecha, aunque el club pague Lite antes', () => {
    const ahora = new Date('2026-11-26T12:00:00.000Z');
    const vence = '2026-11-30T12:00:00.000Z';
    expect(origenArcade(null, vence, ahora)).toBe('PRUEBA');
    expect(origenArcade(null, '2026-11-26T11:59:59.000Z', ahora)).toBeNull();
    expect(origenArcade(null, null, ahora)).toBeNull();
    expect(origenArcade(null, 'no es fecha', ahora)).toBeNull();
    // Permisos fijados sin pago (encendidos): sigue la prueba.
    expect(origenArcade({ ...pagado, pagadoHasta: null }, vence, ahora)).toBe('PRUEBA');
    // Pagado manda sobre la prueba.
    expect(origenArcade(pagado, vence, ahora)).toBe('PAGADO');
    // Un pago vencido no quita lo que queda de prueba.
    expect(origenArcade({ ...pagado, pagadoHasta: '2026-11-01T00:00:00.000Z' }, vence, ahora)).toBe(
      'PRUEBA',
    );
  });

  it('si la plataforma lo apagó, ni la prueba lo enciende', () => {
    const ahora = new Date('2026-11-26T12:00:00.000Z');
    const apagado = { ...PERMISOS_POR_OMISION, activo: false, pagadoHasta: null };
    expect(origenArcade(apagado, '2026-11-30T12:00:00.000Z', ahora)).toBeNull();
  });

  it('las promociones ganadas se cobran si el club tiene o tuvo Arcade', () => {
    expect(conArcade(null, null)).toBe(false);
    expect(conArcade(null, '2026-11-01T00:00:00.000Z')).toBe(true);
    expect(conArcade(PERMISOS_POR_OMISION, null)).toBe(true);
  });

  it('lee permisos con límites y siempre deja «sin lista»', () => {
    const p = leerPermisosArcade({
      activo: true,
      juegos: ['atrapa', 'nada'],
      maxPartidasDia: 99,
      listas: ['ranking'],
    });
    expect(p?.juegos).toEqual(['atrapa']);
    expect(p?.maxPartidasDia).toBe(20);
    expect(p?.listas).toEqual(['ninguna', 'ranking']);
    expect(leerPermisosArcade(undefined)).toBeNull();
  });

  it('recorta la configuración del dueño a sus permisos', () => {
    const guardada = leerConfigArcade({
      juegos: ['sopa', 'atrapa', 'memorama', 'apila'],
      partidasDia: 10,
      lista: { modo: 'rachas', tamano: 5 },
      retos: [{ id: 'facil', tipo: 'dias', meta: 1, periodo: 'semana', premio: 'Café gratis' }],
      palabras: ['café', 'concha', 'x', 'año', 'leche'],
    });
    expect(guardada.retos?.[0]?.meta).toBe(3); // mínimo de días
    expect(guardada.palabras).toEqual(['CAFE', 'CONCHA', 'AÑO', 'LECHE']);
    const p = {
      ...pagado,
      juegos: ['atrapa', 'sopa'] as const,
      maxJuegosActivos: 1,
      maxPartidasDia: 2,
      listas: ['ninguna', 'ranking'] as const,
    };
    const c = configEfectiva(
      guardada,
      { ...p, juegos: [...p.juegos], listas: [...p.listas] },
      'cafeteria',
    );
    expect(c.juegos).toEqual(['sopa']); // apila no está disponible y solo cabe uno
    expect(c.partidasDia).toBe(2);
    expect(c.lista.modo).toBe('ninguna'); // rachas no está permitida
    expect(c.productos[0]?.icono).toBe('taza');
  });

  it('con edición «premios» respeta metas de la plantilla', () => {
    const guardada = leerConfigArcade({
      retos: [{ id: 'constancia', tipo: 'dias', meta: 3, periodo: 'semana', premio: 'Pan gratis' }],
    });
    const c = configEfectiva(guardada, { ...pagado, edicionRetos: 'premios' }, null);
    expect(c.retos).toEqual([{ ...RETOS_POR_OMISION[0], premio: 'Pan gratis', vigenciaDias: 7 }]);
  });

  it('el juego de la semana cambia cada lunes y es el mismo toda la semana', () => {
    const cfg = { juegos: ['atrapa', 'memorama', 'sopa'] as const, modo: 'semana' as const };
    const a = juegosDeHoy({ ...cfg, juegos: [...cfg.juegos] }, '2026-11-16');
    expect(juegosDeHoy({ ...cfg, juegos: [...cfg.juegos] }, '2026-11-22')).toEqual(a);
    expect(juegosDeHoy({ ...cfg, juegos: [...cfg.juegos] }, '2026-11-23')).not.toEqual(a);
  });
});

describe('arcade: textos, códigos y precios', () => {
  it('normaliza palabras y nombres públicos', () => {
    expect(normalizarPalabra('Diseño')).toBe('DISEÑO');
    expect(normalizarPalabra('dos palabras')).toBeNull();
    expect(nombrePublico('ana lópez ruiz', 'BAR-AAAA-1234')).toBe('ana L.');
    expect(nombrePublico(null, 'BAR-AAAA-1234')).toBe('Cliente ·1234');
  });

  it('códigos de cupón legibles', () => {
    expect(codigoCupon('BAR', () => 0)).toBe('BAR-AAAA');
    expect(codigoCupon('BAR')).toMatch(/^BAR-[A-HJKMNP-Z2-9]{4}$/);
  });

  it('precios con valores por omisión y ahorro anual', () => {
    const p = leerPrecios({ arcade: { mes: 99 } });
    expect(p.lite).toEqual({ mes: 269, anio: 2699 });
    expect(p.arcade).toEqual({ mes: 99, anio: null });
    expect(ahorroAnual(p.lite)).toBe(529);
    expect(ahorroAnual(p.arcade)).toBeNull();
  });
});
