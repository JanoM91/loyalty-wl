import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISOS_POR_OMISION, fechaLocal } from '@wl/domain';

import type * as ModuloBd from '../src/index';
import { CON_BD, comoDuenio, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('Arcade del club', () => {
  let db: typeof ModuloBd;
  let negocio: ModuloBd.Negocio;
  let otro: ModuloBd.Negocio;
  let tarjeta = '';
  let rival = '';
  let usuario = '';
  let sucursal = '';

  async function nuevaTarjeta(contacto: string): Promise<string> {
    const r = await db.crearTarjeta({ contacto, aceptaTerminos: true, aceptaPromociones: false });
    if (!r.ok) throw new Error(r.error);
    return (await db.leerSesionTarjeta(r.token))!;
  }

  /** Juega una partida completa de `segundos` con `puntos`. */
  async function juega(cardId: string, juego: string, puntos: number, segundos = 60, nivel = 2) {
    const inicio = new Date();
    const r = await db.iniciarPartida(cardId, juego, inicio);
    if (!r.ok) throw new Error(r.error);
    return db.terminarPartida(
      cardId,
      r.id,
      puntos,
      nivel,
      new Date(inicio.getTime() + segundos * 1000),
    );
  }

  async function recargar() {
    negocio = (await db.negocioPorSlug('prueba-arcade'))!;
  }

  beforeAll(async () => {
    db = await import('../src/index');
    negocio = await negocioDePrueba({
      slug: 'prueba-arcade',
      nombre: 'Barbería Arcade',
      prefijoCodigo: 'ARC',
    });
    otro = await negocioDePrueba({
      slug: 'prueba-arcade-otro',
      nombre: 'Otro club',
      prefijoCodigo: 'OTR',
    });
    db.fijarResolutorDeNegocio(() => negocio);
    tarjeta = await nuevaTarjeta('2281110001');
    rival = await nuevaTarjeta('2281110002');
    await db.prisma.loyaltyCard.update({ where: { id: tarjeta }, data: { name: 'Ana López' } });
    sucursal = (
      await db.prisma.branch.create({
        data: {
          slug: 'arcade-centro',
          name: 'Centro',
          addressLine: 'Calle 1',
          neighborhood: 'Centro',
          postalCode: '91000',
          loyaltyEnabled: true,
        },
      })
    ).id;
    const u = await comoDuenio<{ id: string }>(
      `INSERT INTO user_account (id, tenant_id, email, name, role, password_hash)
       VALUES (gen_random_uuid(), $1, 'caja-arcade@ejemplo.mx', 'Caja', 'ADMIN', 'x') RETURNING id`,
      [negocio.id],
    );
    usuario = u[0]!.id;
  });

  afterAll(async () => {
    if (negocio) await db.borrarNegocio(negocio.id);
    if (otro) await db.borrarNegocio(otro.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('sin pago del Arcade no se juega', async () => {
    const r = await db.iniciarPartida(tarjeta, 'atrapa');
    expect(r).toEqual({ ok: false, error: 'El Arcade de este club no está disponible.' });
  });

  it('la plataforma registra el pago y fija permisos', async () => {
    const hasta = await db.registrarPagoArcade(negocio, 'MES');
    await recargar();
    expect(negocio.ajustes.arcade?.activo).toBe(true);
    expect(negocio.ajustes.arcade?.pagadoHasta).toBe(hasta);
    await db.fijarPermisosArcade(negocio.id, {
      ...negocio.ajustes.arcade!,
      maxPartidasDia: 5,
      juegos: ['atrapa', 'memorama', 'sopa'],
      maxRetos: 2,
    });
    await recargar();
    expect((await db.arcadeDelNegocio()).vigente).toBe(true);
  });

  it('el dueño guarda su configuración solo dentro de sus permisos', async () => {
    const base = {
      juegos: ['atrapa', 'memorama'],
      modo: 'fijos',
      partidasDia: 4,
      lista: { modo: 'ranking', tamano: 5, mostrarPuntos: true },
      retos: [
        {
          id: 'dos-dias',
          tipo: 'dias',
          meta: 3,
          periodo: 'semana',
          premio: 'Ceja gratis',
          vigenciaDias: 7,
        },
        {
          id: 'puntos',
          tipo: 'puntaje',
          meta: 300,
          periodo: 'semana',
          premio: 'Lavado gratis',
          vigenciaDias: 7,
        },
      ],
    };
    expect(await db.guardarConfigArcade({ ...base, juegos: ['junta'] }, usuario)).toMatchObject({
      ok: false,
    });
    expect(await db.guardarConfigArcade({ ...base, partidasDia: 9 }, usuario)).toMatchObject({
      ok: false,
    });
    expect(await db.guardarConfigArcade(base, usuario)).toEqual({ ok: true });
    const { config } = await db.arcadeDelNegocio();
    expect(config.juegos).toEqual(['atrapa', 'memorama']);
    expect(config.retos.map((r) => r.id)).toEqual(['dos-dias', 'puntos']);
  });

  it('valida el juego, el tope diario y el puntaje', async () => {
    expect(await db.iniciarPartida(tarjeta, 'sopa')).toMatchObject({ ok: false });
    const trampa = await juega(tarjeta, 'atrapa', 999_999, 10);
    expect(trampa).toMatchObject({ ok: true, sospechosa: true, cuponesNuevos: [] });
    const buena = await juega(tarjeta, 'atrapa', 450, 60);
    // 450 puntos cumple «300 en una partida»: sale el cupón.
    expect(buena).toMatchObject({ ok: true, sospechosa: false });
    if (!buena.ok) return;
    expect(buena.cuponesNuevos.map((c) => c.titulo)).toEqual(['Lavado gratis']);
    expect(buena.cuponesNuevos[0]!.codigo).toMatch(/^ARC-[A-Z0-9]{4}$/);
    // Una segunda partida buena en la semana ya no repite el cupón.
    const otra = await juega(tarjeta, 'memorama', 500, 90);
    expect(otra).toMatchObject({ ok: true, cuponesNuevos: [] });
    // Cerrar dos veces la misma partida no se puede.
    const i = await db.iniciarPartida(tarjeta, 'atrapa');
    if (!i.ok) throw new Error(i.error);
    await db.terminarPartida(tarjeta, i.id, 10, 1, new Date(Date.now() + 30_000));
    expect(
      await db.terminarPartida(tarjeta, i.id, 10, 1, new Date(Date.now() + 40_000)),
    ).toMatchObject({ ok: false });
    // Tope de 4 partidas al día.
    expect(await db.iniciarPartida(tarjeta, 'atrapa')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Vuelve mañana/),
    });
  });

  it('muestra retos con avance, cupones y la lista', async () => {
    await juega(rival, 'atrapa', 200, 60);
    const estado = await db.arcadeDeLaTarjeta(tarjeta);
    expect(estado.jugadasHoy).toBe(4);
    expect(estado.racha).toBe(1);
    const puntos = estado.retos.find((r) => r.id === 'puntos')!;
    expect(puntos).toMatchObject({ avance: 300, ganado: true });
    expect(estado.retos.find((r) => r.id === 'dos-dias')).toMatchObject({
      avance: 1,
      meta: 3,
      ganado: false,
    });
    expect(estado.cupones).toHaveLength(1);

    const ranking = await db.listaArcade(tarjeta);
    expect(ranking.modo).toBe('ranking');
    expect(ranking.filas[0]).toEqual({ nombre: 'Ana L.', valor: 500, esTuya: true });
    expect(ranking.filas[1]?.nombre).toMatch(/^Cliente ·/);
  });

  it('la caja cobra el cupón una sola vez', async () => {
    const [cupon] = await db.cuponesArcadeDeTarjeta(tarjeta);
    const codigo = cupon!.codigo;
    expect(await db.buscarCuponArcade(codigo.toLowerCase())).toMatchObject({
      estado: 'DISPONIBLE',
      tarjeta: { nombre: 'Ana López' },
    });
    expect(await db.canjearCuponArcade(codigo, sucursal, usuario)).toEqual({ ok: true });
    expect(await db.canjearCuponArcade(codigo, sucursal, usuario)).toEqual({
      ok: false,
      error: 'Ese cupón ya se cobró.',
    });
    expect(await db.canjearCuponArcade('ARC-ZZZZ', sucursal, usuario)).toMatchObject({ ok: false });
    expect((await db.resumenArcade()).cuponesCobrados).toBe(1);
  });

  it('otro negocio no ve partidas ni cupones ajenos', async () => {
    const [cupon] = await db.cuponesArcadeDeTarjeta(tarjeta);
    await en(otro, async () => {
      expect(await db.buscarCuponArcade(cupon!.codigo)).toBeNull();
      expect(await db.prisma.arcadePlay.count()).toBe(0);
      expect(await db.prisma.arcadeCoupon.count()).toBe(0);
    });
    const filas = await en(otro, () =>
      db.transaccion(
        (tx) => tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM arcade_play`,
      ),
    );
    expect(filas[0]!.n).toBe(0);
  });

  it('la plantilla y los precios los guarda la plataforma', async () => {
    const antes = await db.preciosDelServicio();
    await db.guardarPreciosDelServicio({ ...antes, arcade: { mes: 149, anio: 1490 } }, 'prueba');
    expect((await db.preciosDelServicio()).arcade).toEqual({ mes: 149, anio: 1490 });
    await db.guardarPreciosDelServicio(antes, 'prueba');
    const plantilla = await db.plantillaArcade();
    expect(plantilla.activo).toBe(false);
    expect(plantilla.juegos).toEqual(PERMISOS_POR_OMISION.juegos);
    expect(fechaLocal(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
