import { describe, expect, it } from 'vitest';

import { correoDeCiclo, correoResumenSemanal } from '../src/lib/avisos-dueno';

const club = { nombre: 'Barbería León', slug: 'barberia-leon', zonaHoraria: 'America/Mexico_City' };
const cifras = {
  tarjetas: 12,
  tarjetasNuevas: 3,
  visitas: 20,
  clientes: 9,
  premiosGanados: 2,
  premiosEntregados: 1,
  partidas: 0,
  promocionesGanadas: 0,
};

describe('correos al dueño', () => {
  it('avisa el fin de la prueba con sus números y el botón al plan', () => {
    const c = correoDeCiclo({
      para: 'ana@ejemplo.mx',
      nombre: 'Ana López',
      club,
      aviso: {
        tipo: 'por-vencer',
        referencia: '2026-11-28T18:00:00.000Z',
        pagado: false,
        fecha: new Date('2026-11-28T18:00:00.000Z'),
      },
      cifras,
      borrarDesde: null,
      diasEnPausa: 0,
    });
    expect(c.asunto).toBe('Tu prueba de Barbería León termina el 28 de noviembre');
    expect(c.texto).toContain('Hola, Ana:');
    expect(c.texto).toContain('12 tarjetas, 20 visitas y 1 premio entregado');
    expect(c.texto).toContain('https://club-lealtad.com/barberia-leon/admin/plan');
  });

  it('en pausa dice hasta cuándo se guarda solo si hay borrado automático', () => {
    const aviso = {
      tipo: 'pausa' as const,
      referencia: '2026-11-28T18:00:00.000Z',
      pagado: true,
      fecha: new Date('2026-11-28T18:00:00.000Z'),
    };
    const base = { para: 'a@ejemplo.mx', nombre: '', club, aviso, cifras, diasEnPausa: 1 };
    expect(correoDeCiclo({ ...base, borrarDesde: null }).texto).toContain(
      'Hola: tu plan venció el 28 de noviembre',
    );
    expect(correoDeCiclo({ ...base, borrarDesde: null }).texto).not.toContain('hasta el');
    expect(
      correoDeCiclo({ ...base, borrarDesde: new Date('2026-12-28T18:00:00.000Z') }).texto,
    ).toContain('siguen guardados hasta el 28 de diciembre');
  });

  it('el resumen semanal muestra los juegos solo si el club los tiene y da un consejo', () => {
    const datos = {
      para: 'a@ejemplo.mx',
      nombre: 'Ana',
      club,
      cifras,
      desde: new Date('2026-11-16T06:00:00.000Z'),
      hasta: new Date('2026-11-22T06:00:00.000Z'),
      conJuegos: false,
    };
    const sin = correoResumenSemanal(datos);
    expect(sin.asunto).toBe('Tu semana en Barbería León: 20 visitas');
    expect(sin.texto).toContain('del 16 de noviembre al 22 de noviembre');
    expect(sin.texto).not.toContain('Juega y gana');
    expect(correoResumenSemanal({ ...datos, conJuegos: true }).texto).toContain(
      'Partidas en Juega y gana: 0',
    );
    const vacia = correoResumenSemanal({ ...datos, cifras: { ...cifras, visitas: 0 } });
    expect(vacia.asunto).toBe('Tu semana en Barbería León');
    expect(vacia.texto).toContain('no hubo visitas');
  });
});
