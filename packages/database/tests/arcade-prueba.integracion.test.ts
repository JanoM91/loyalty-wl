import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vencimientoDePrueba } from '@wl/domain';

import type * as ModuloBd from '../src/index';
import { CON_BD, comoDuenio, negocioDePrueba } from './ayuda';

/** «Juega y gana» viene incluido en la prueba de 7 días de los clubes del asistente. */
describe.skipIf(!CON_BD)('Juega y gana en la prueba', () => {
  let db: typeof ModuloBd;
  let negocio: ModuloBd.Negocio;
  let tarjeta = '';
  let usuario = '';

  async function recargar() {
    negocio = (await db.negocioPorSlug('prueba-arcade-trial'))!;
  }

  beforeAll(async () => {
    db = await import('../src/index');
    negocio = await negocioDePrueba({
      slug: 'prueba-arcade-trial',
      nombre: 'Uñas en prueba',
      prefijoCodigo: 'UNP',
    });
    await db.mezclarAjustes(negocio.id, { pruebaVence: vencimientoDePrueba() });
    await recargar();
    db.fijarResolutorDeNegocio(() => negocio);
    const r = await db.crearTarjeta({
      contacto: '2281110091',
      aceptaTerminos: true,
      aceptaPromociones: false,
    });
    if (!r.ok) throw new Error(r.error);
    tarjeta = (await db.leerSesionTarjeta(r.token))!;
    const u = await comoDuenio<{ id: string }>(
      `INSERT INTO user_account (id, tenant_id, email, name, role, password_hash)
       VALUES (gen_random_uuid(), $1, 'duenia-prueba@ejemplo.mx', 'Dueña', 'ADMIN', 'x') RETURNING id`,
      [negocio.id],
    );
    usuario = u[0]!.id;
  });

  afterAll(async () => {
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('en la prueba se juega sin pago, con la plantilla y sin retos hasta que el dueño guarda', async () => {
    expect(negocio.ajustes.arcade).toBeNull();
    const a = await db.arcadeDelNegocio();
    expect(a).toMatchObject({ vigente: true, origen: 'PRUEBA', configurado: false });
    expect(a.hasta).toBe(negocio.ajustes.pruebaVence);
    expect(a.permisos?.activo).toBe(true);
    expect(a.permisos?.pagadoHasta).toBeNull();
    // Los clientes juegan, pero no ganan promociones que el dueño no ha visto.
    expect(a.config.retos).toEqual([]);
    expect(a.propuesta.retos.length).toBeGreaterThan(0);
    const r = await db.iniciarPartida(tarjeta, a.config.juegos[0]!);
    expect(r.ok).toBe(true);
  });

  it('al guardar el dueño su configuración, los retos cuentan', async () => {
    const { propuesta } = await db.arcadeDelNegocio();
    expect(
      await db.guardarConfigArcade({ ...propuesta, juegos: propuesta.juegos.slice(0, 2) }, usuario),
    ).toEqual({ ok: true });
    const a = await db.arcadeDelNegocio();
    expect(a.configurado).toBe(true);
    expect(a.config.retos.map((x) => x.id)).toEqual(propuesta.retos.map((x) => x.id));
  });

  it('al terminar la prueba ya no se juega, pero se conservan los permisos para cobrar', async () => {
    await db.mezclarAjustes(negocio.id, {
      pruebaVence: new Date(Date.now() - 60_000).toISOString(),
    });
    await recargar();
    const a = await db.arcadeDelNegocio();
    expect(a).toMatchObject({ vigente: false, origen: null });
    expect(a.permisos).not.toBeNull();
    expect(await db.iniciarPartida(tarjeta, a.config.juegos[0]!)).toEqual({
      ok: false,
      error: 'El Arcade de este club no está disponible.',
    });
  });

  it('si la plataforma lo apaga, ni la prueba lo enciende', async () => {
    await db.mezclarAjustes(negocio.id, { pruebaVence: vencimientoDePrueba() });
    await recargar();
    expect((await db.arcadeDelNegocio()).vigente).toBe(true);
    await db.fijarPermisosArcade(negocio.id, {
      ...(await db.plantillaArcade()),
      activo: false,
      pagadoHasta: null,
    });
    await recargar();
    expect((await db.arcadeDelNegocio()).vigente).toBe(false);
  });
});
