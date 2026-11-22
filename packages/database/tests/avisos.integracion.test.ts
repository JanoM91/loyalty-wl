import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formarCodigoTarjeta } from '@wl/domain';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('avisos al dueño', () => {
  let a: db.Negocio;
  let demo: db.Negocio;
  const vence = '2026-12-01T12:00:00.000Z';

  beforeAll(async () => {
    a = await negocioDePrueba({
      slug: 'prueba-avisos-a',
      nombre: 'Barbería A',
      prefijoCodigo: 'VA',
    });
    demo = await negocioDePrueba({
      slug: 'prueba-avisos-demo',
      nombre: 'Demo',
      prefijoCodigo: 'VD',
    });
    await db.mezclarAjustes(a.id, {
      pruebaVence: vence,
      alta: {
        giro: 'barberia',
        correo: 'ana@ejemplo.mx',
        whatsapp: '522281112233',
        origen: 'empezar',
        legal: 'prueba',
      },
    });
    await en(a, async () => {
      await db.prisma.userAccount.create({
        data: { email: 'ana@ejemplo.mx', name: 'Ana López', role: 'DUENO' },
      });
      await db.prisma.userAccount.create({
        data: { email: 'caja@ejemplo.mx', name: 'Caja', role: 'GERENTE' },
      });
      for (let i = 0; i < 2; i += 1) {
        await db.prisma.loyaltyCard.create({
          data: {
            publicCode: formarCodigoTarjeta(randomBytes(8)),
            termsVersion: 'prueba',
            termsAcceptedAt: new Date(),
          },
        });
      }
    });
  });

  afterAll(async () => {
    if (a) await db.borrarNegocio(a.id);
    if (demo) await db.borrarNegocio(demo.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('solo avisa a clubes con dueño real (del asistente o que pagan)', async () => {
    const { clubes } = await db.clubesParaAvisos();
    const slugs = clubes.map((c) => c.slug);
    expect(slugs).toContain('prueba-avisos-a');
    expect(slugs).not.toContain('prueba-avisos-demo');
  });

  it('los destinatarios son los dueños, no el resto del equipo', async () => {
    expect(await db.dueniosDelClub(a.id)).toEqual([
      { email: 'ana@ejemplo.mx', nombre: 'Ana López' },
    ]);
  });

  it('anota los avisos sin tocar el resto de los ajustes', async () => {
    await db.marcarAvisos(a.id, { porVencer: vence });
    await db.marcarAvisos(a.id, { semana: '2026-11-23', resumenSemanal: false });
    const n = (await db.negocioPorSlug('prueba-avisos-a'))!;
    expect(n.ajustes.avisos).toMatchObject({
      porVencer: vence,
      semana: '2026-11-23',
      resumenSemanal: false,
      pausa: null,
    });
    expect(n.ajustes.pruebaVence).toBe(vence);
    expect(n.ajustes.alta?.giro).toBe('barberia');
  });

  it('cuenta los números del club en el periodo', async () => {
    const ahora = new Date();
    const c = await en(a, () =>
      db.cifrasDelClub(
        new Date(ahora.getTime() - 60 * 60 * 1000),
        new Date(ahora.getTime() + 60 * 1000),
      ),
    );
    expect(c).toMatchObject({
      tarjetas: 2,
      tarjetasNuevas: 2,
      visitas: 0,
      clientes: 0,
      partidas: 0,
    });
    const antes = await en(a, () =>
      db.cifrasDelClub(new Date('2020-01-01'), new Date('2021-01-01')),
    );
    expect(antes.tarjetasNuevas).toBe(0);
  });
});
