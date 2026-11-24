import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('solicitud para pasar a Privada', () => {
  let a: db.Negocio;
  let b: db.Negocio;
  let duenio = '';

  beforeAll(async () => {
    a = await negocioDePrueba({
      slug: 'prueba-privada-a',
      nombre: 'Privada A',
      prefijoCodigo: 'PA',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    b = await negocioDePrueba({
      slug: 'prueba-privada-b',
      nombre: 'Privada B',
      prefijoCodigo: 'PB',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    duenio = (
      await en(a, () =>
        db.prisma.userAccount.create({
          data: { email: 'duenio@privada-a.mx', name: 'Dueña A', role: 'DUENO' },
          select: { id: true },
        }),
      )
    ).id;
  });

  afterAll(async () => {
    for (const x of [a, b]) if (x) await db.borrarNegocio(x.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('queda una por día, con su nota, y solo la ve su club', async () => {
    expect(await en(a, () => db.solicitudPrivada())).toBeNull();
    const primera = await en(a, () =>
      db.solicitarPrivada(duenio, '  Tenemos tres sucursales  ', '203.0.113.9'),
    );
    expect(primera.nueva).toBe(true);
    const segunda = await en(a, () => db.solicitarPrivada(duenio, null, null));
    expect(segunda.nueva).toBe(false);
    expect(await en(a, () => db.solicitudPrivada())).toMatchObject({
      quien: 'Dueña A',
      nota: 'Tenemos tres sucursales',
    });
    expect(await en(b, () => db.solicitudPrivada())).toBeNull();
  });

  it('la plataforma la ve mientras el club siga en Lite', async () => {
    const pendientes = await db.solicitudesPrivadaPendientes([a.id, b.id]);
    expect(pendientes.map((p) => p.slug)).toEqual(['prueba-privada-a']);
    await db.cambiarPlan(a.id, 'PRIVADA');
    expect(await db.solicitudesPrivadaPendientes([a.id, b.id])).toEqual([]);
    // Ya en Privada, otra solicitud no se registra.
    const negocio = await db.negocioPorSlug('prueba-privada-a');
    const r = await en(negocio!, () => db.solicitarPrivada(duenio, null, null));
    expect(r.nueva).toBe(false);
  });
});
