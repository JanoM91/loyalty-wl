import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  SinNegocioError,
  borrarNegocio,
  desconectar,
  desconectarPlataforma,
  negociosActivos,
  prisma,
  transaccion,
  type Negocio,
} from '../src/index';
import { CON_BD, comoDuenio, en, negocioDePrueba } from './ayuda';

/**
 * Pruebas de fuga entre negocios: la puerta de calidad de la Fase 1.
 *
 * Dos negocios con datos parecidos a propósito (mismo celular, mismo código de
 * tarjeta, mismo folio). Nada de lo que haga uno puede ver ni tocar lo del otro.
 */
describe.skipIf(!CON_BD)('aislamiento entre negocios', () => {
  let a: Negocio;
  let b: Negocio;
  let tarjetaB: string;
  let sucursalB: string;

  const CELULAR = '2281234567';
  const CODIGO = 'WL-ABCD-EFGH';

  async function sembrar(n: Negocio) {
    return en(n, async () => {
      const sucursal = await prisma.branch.findFirstOrThrow({ where: { slug: 'centro' } });
      const tarjeta = await prisma.loyaltyCard.create({
        data: {
          publicCode: CODIGO,
          phone: CELULAR,
          name: `Cliente de ${n.slug}`,
          termsVersion: '2026-11',
          termsAcceptedAt: new Date(),
          enrolledBranchId: sucursal.id,
          stamps: 3,
        },
      });
      await prisma.loyaltyAccrual.create({
        data: {
          cardId: tarjeta.id,
          branchId: sucursal.id,
          status: 'ACREDITADA',
          purchaseDate: new Date('2026-11-15T00:00:00.000Z'),
          ticketFolio: 'F-100',
          ticketRegister: '1',
          ticketKey: 'centro|1|2026-11-15|F100',
          totalCents: 10_000,
          eligibleCents: 10_000,
          stampsAwarded: 1,
          programVersion: 'v1',
        },
      });
      await prisma.userAccount.create({
        data: { email: 'caja@ejemplo.mx', name: 'Caja', role: 'SUCURSAL', branchId: sucursal.id },
      });
      return { tarjeta: tarjeta.id, sucursal: sucursal.id };
    });
  }

  beforeAll(async () => {
    const sucursales = [{ slug: 'centro', nombre: 'Centro', participa: true }];
    a = await negocioDePrueba({ slug: 'prueba-fuga-a', nombre: 'Café A', sucursales });
    b = await negocioDePrueba({ slug: 'prueba-fuga-b', nombre: 'Barbería B', sucursales });
    await sembrar(a);
    const deB = await sembrar(b);
    tarjetaB = deB.tarjeta;
    sucursalB = deB.sucursal;
  });

  afterAll(async () => {
    if (a) await borrarNegocio(a.id);
    if (b) await borrarNegocio(b.id);
    await desconectar();
    await desconectarPlataforma();
  });

  it('sin negocio en contexto, toda operación falla (no corre «sin filtro»)', async () => {
    await expect(prisma.loyaltyCard.count()).rejects.toBeInstanceOf(SinNegocioError);
    await expect(prisma.$queryRaw`SELECT 1`).rejects.toBeInstanceOf(SinNegocioError);
    await expect(transaccion(async (tx) => tx.loyaltyCard.count())).rejects.toBeInstanceOf(
      SinNegocioError,
    );
  });

  it('la conexión de la aplicación no ve nada si no fija el negocio', async () => {
    // Directo a la base con el rol de la aplicación, sin pasar por este paquete.
    const { default: pg } = await import('pg');
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    try {
      const tablas = [
        'branch',
        'user_account',
        'audit_log',
        'loyalty_card',
        'loyalty_accrual',
        'loyalty_reward',
        'loyalty_session',
        'loyalty_code',
        'loyalty_program',
        'wallet_device',
      ];
      for (const t of tablas) {
        const r = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
        expect(r.rows[0].n, t).toBe(0);
      }
      await expect(
        c.query(
          `INSERT INTO "loyalty_program" (id, tenant_id, version, positions, mode, milestones, tiers, contingency_window_days)
           VALUES (gen_random_uuid(), $1, 'v9', 10, 'VISITA', '[]', '[]', 2)`,
          [b.id],
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await c.end();
    }
  });

  it('cada negocio ve solo lo suyo, aunque los datos coincidan', async () => {
    const [enA, enB] = await Promise.all([
      en(a, () => prisma.loyaltyCard.findMany({ select: { name: true, tenantId: true } })),
      en(b, () => prisma.loyaltyCard.findMany({ select: { name: true, tenantId: true } })),
    ]);
    expect(enA).toEqual([{ name: 'Cliente de prueba-fuga-a', tenantId: a.id }]);
    expect(enB).toEqual([{ name: 'Cliente de prueba-fuga-b', tenantId: b.id }]);

    await en(a, async () => {
      expect(await prisma.branch.count()).toBe(1);
      expect(await prisma.userAccount.count()).toBe(1);
      expect(await prisma.loyaltyAccrual.count()).toBe(1);
      expect(await prisma.loyaltyProgram.count()).toBe(1);
    });
  });

  it('el mismo celular, código y folio existen en los dos negocios sin chocar', async () => {
    const filas = await comoDuenio<{ n: number }>(
      `SELECT count(*)::int AS n FROM loyalty_card WHERE phone = $1 AND public_code = $2 AND tenant_id = ANY($3::uuid[])`,
      [CELULAR, CODIGO, [a.id, b.id]],
    );
    expect(filas[0]?.n).toBe(2);
    // …pero dentro de un mismo negocio no se repiten.
    await expect(
      en(a, () =>
        prisma.loyaltyCard.create({
          data: { publicCode: 'WL-ZZZZ-ZZZZ', phone: CELULAR, termsVersion: 'x', termsAcceptedAt: new Date() },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('A no puede leer por id una tarjeta de B', async () => {
    await en(a, async () => {
      expect(await prisma.loyaltyCard.findUnique({ where: { id: tarjetaB } })).toBeNull();
      expect(await prisma.loyaltyCard.findFirst({ where: { id: tarjetaB } })).toBeNull();
      expect(await prisma.loyaltyAccrual.count({ where: { cardId: tarjetaB } })).toBe(0);
    });
  });

  it('A no puede modificar ni borrar filas de B', async () => {
    await en(a, async () => {
      expect(
        (await prisma.loyaltyCard.updateMany({ where: { id: tarjetaB }, data: { stamps: 9 } })).count,
      ).toBe(0);
      await expect(
        prisma.loyaltyCard.update({ where: { id: tarjetaB }, data: { stamps: 9 } }),
      ).rejects.toMatchObject({ code: 'P2025' });
      expect((await prisma.loyaltyCard.deleteMany({ where: { id: tarjetaB } })).count).toBe(0);
      expect((await prisma.branch.deleteMany({ where: { id: sucursalB } })).count).toBe(0);
    });
    const filas = await comoDuenio<{ stamps: number }>(
      'SELECT stamps FROM loyalty_card WHERE id = $1',
      [tarjetaB],
    );
    expect(filas).toEqual([{ stamps: 3 }]);
  });

  it('A no puede escribir filas a nombre de B', async () => {
    await expect(
      en(a, () =>
        prisma.loyaltyCard.create({
          data: { tenantId: b.id, publicCode: 'WL-AAAA-AAAA', termsVersion: 'x', termsAcceptedAt: new Date() },
        }),
      ),
    ).rejects.toThrow();
    const filas = await comoDuenio<{ n: number }>(
      `SELECT count(*)::int AS n FROM loyalty_card WHERE public_code = 'WL-AAAA-AAAA'`,
    );
    expect(filas[0]?.n).toBe(0);
  });

  it('el SQL directo también queda acotado al negocio', async () => {
    const [n] = await en(a, () => prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM loyalty_card`);
    expect(n?.n).toBe(1);
    const cambiadas = await en(
      a,
      () => prisma.$executeRaw`UPDATE loyalty_card SET stamps = 8 WHERE phone = ${CELULAR}`,
    );
    expect(cambiadas).toBe(1);
    const filas = await comoDuenio<{ slug: string; stamps: number }>(
      `SELECT t.slug, c.stamps FROM loyalty_card c JOIN tenant t ON t.id = c.tenant_id
       WHERE c.tenant_id = ANY($1::uuid[]) ORDER BY t.slug`,
      [[a.id, b.id]],
    );
    expect(filas).toEqual([
      { slug: 'prueba-fuga-a', stamps: 8 },
      { slug: 'prueba-fuga-b', stamps: 3 },
    ]);
  });

  it('dentro de una transacción el negocio sigue fijado, también con FOR UPDATE', async () => {
    const r = await en(a, () =>
      transaccion(async (tx) => {
        const filas = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM loyalty_card WHERE public_code = ${CODIGO} FOR UPDATE`;
        const ajenas = await tx.loyaltyCard.count({ where: { id: tarjetaB } });
        const nueva = await tx.loyaltyReward.create({
          data: { cardId: filas[0]!.id, kind: 'CORTESIA', title: 'Cortesía', milestone: 5, cycle: 1 },
        });
        return { propias: filas.length, ajenas, negocioDelPremio: nueva.tenantId };
      }),
    );
    expect(r).toEqual({ propias: 1, ajenas: 0, negocioDelPremio: a.id });
  });

  it('una transacción que falla no deja el negocio pegado a la conexión', async () => {
    await expect(
      en(a, () =>
        transaccion(async (tx) => {
          await tx.loyaltyCard.count();
          throw new Error('fallo a propósito');
        }),
      ),
    ).rejects.toThrow('fallo a propósito');
    await expect(prisma.loyaltyCard.count()).rejects.toBeInstanceOf(SinNegocioError);
  });

  it('peticiones simultáneas de dos negocios no se cruzan', async () => {
    const rondas = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? a : b));
    const vistos = await Promise.all(
      rondas.map((n) =>
        en(n, async () => {
          const filas = await prisma.loyaltyCard.findMany({ select: { tenantId: true } });
          const enTx = await transaccion((tx) => tx.loyaltyAccrual.findMany({ select: { tenantId: true } }));
          return [...filas, ...enTx].every((f) => f.tenantId === n.id) && filas.length === 1;
        }),
      ),
    );
    expect(vistos.every(Boolean)).toBe(true);
  });

  it('la bitácora no se puede modificar ni borrar', async () => {
    await en(a, async () => {
      const entrada = await prisma.auditLog.create({
        data: { action: 'prueba.fuga', entityType: 'prueba' },
      });
      await expect(
        prisma.auditLog.update({ where: { id: entrada.id }, data: { action: 'otra' } }),
      ).rejects.toThrow();
      await expect(prisma.auditLog.delete({ where: { id: entrada.id } })).rejects.toThrow();
      expect(await prisma.auditLog.count({ where: { action: 'prueba.fuga' } })).toBe(1);
    });
  });

  it('la lista de negocios activos es de plataforma y no necesita contexto', async () => {
    const slugs = (await negociosActivos()).map((n) => n.slug);
    expect(slugs).toEqual(expect.arrayContaining(['prueba-fuga-a', 'prueba-fuga-b']));
  });

  it('borrar un negocio se lleva todos sus datos y deja intacto al otro', async () => {
    const c = await negocioDePrueba({
      slug: 'prueba-fuga-c',
      nombre: 'Negocio C',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    await sembrar(c);
    await borrarNegocio(c.id);
    const restos = await comoDuenio<{ n: number }>(
      `SELECT (SELECT count(*) FROM loyalty_card WHERE tenant_id = $1)
            + (SELECT count(*) FROM loyalty_accrual WHERE tenant_id = $1)
            + (SELECT count(*) FROM branch WHERE tenant_id = $1)
            + (SELECT count(*) FROM user_account WHERE tenant_id = $1)
            + (SELECT count(*) FROM loyalty_program WHERE tenant_id = $1) AS n`,
      [c.id],
    );
    expect(Number(restos[0]?.n)).toBe(0);
    expect(await en(a, () => prisma.loyaltyCard.count())).toBe(1);
  });
});
