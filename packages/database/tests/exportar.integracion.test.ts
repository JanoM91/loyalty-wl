import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('descargas del dueño: clientes y visitas', () => {
  let a: db.Negocio;
  let b: db.Negocio;

  async function sembrar(n: db.Negocio, prefijo: string, nombre: string) {
    await en(n, async () => {
      const [sucursal] = await db.prisma.branch.findMany({ select: { id: true } });
      const tarjeta = await db.prisma.loyaltyCard.create({
        data: {
          publicCode: `${prefijo}-AAAA-0001`,
          name: nombre,
          phone: '5212345678901',
          email: `${prefijo.toLowerCase()}@ejemplo.mx`,
          phoneVerifiedAt: new Date(),
          marketingOptIn: true,
          birthDay: 7,
          birthMonth: 3,
          stamps: 1,
          termsVersion: 'v1',
          termsAcceptedAt: new Date(),
          enrolledBranchId: sucursal!.id,
        },
        select: { id: true },
      });
      for (const [dias, estado] of [
        [1, 'ACREDITADA'],
        [40, 'ACREDITADA'],
        [2, 'PENDIENTE'],
      ] as const) {
        await db.prisma.loyaltyAccrual.create({
          data: {
            cardId: tarjeta.id,
            branchId: sucursal!.id,
            status: estado,
            purchaseDate: new Date(Date.now() - dias * 86_400_000),
            createdAt: new Date(Date.now() - dias * 86_400_000),
            ticketFolio: `F${dias}`,
            ticketRegister: '1',
            ticketKey: `${prefijo}-${dias}`,
            totalCents: 15_050,
            eligibleCents: 15_050,
            stampsAwarded: estado === 'ACREDITADA' ? 1 : 0,
            programVersion: 'v1',
          },
        });
      }
    });
  }

  beforeAll(async () => {
    a = await negocioDePrueba({
      slug: 'prueba-exportar-a',
      nombre: 'Exportar A',
      prefijoCodigo: 'XA',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    b = await negocioDePrueba({
      slug: 'prueba-exportar-b',
      nombre: 'Exportar B',
      prefijoCodigo: 'XB',
      sucursales: [{ slug: 'norte', nombre: 'Norte', participa: true }],
    });
    await sembrar(a, 'XA', 'Ana');
    await sembrar(b, 'XB', 'Beto');
  });

  afterAll(async () => {
    for (const n of [a, b]) if (n) await db.borrarNegocio(n.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('clientes: solo los del club, con visitas acreditadas y su contacto', async () => {
    const clientes = await en(a, () => db.clientesParaExportar());
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({
      codigo: 'XA-AAAA-0001',
      nombre: 'Ana',
      celular: '5212345678901',
      celularVerificado: true,
      correoVerificado: false,
      promociones: true,
      visitas: 2,
      cumpleanos: '07/03',
      sucursalDeAlta: 'Centro',
    });
  });

  it('visitas: el periodo filtra y no se cruzan clubes', async () => {
    const recientes = await en(a, () => db.visitasParaExportar(30));
    expect(recientes.map((v) => v.estado).sort()).toEqual(['ACREDITADA', 'PENDIENTE']);
    expect(recientes.every((v) => v.codigo.startsWith('XA'))).toBe(true);
    expect(recientes[0]).toMatchObject({
      sucursal: 'Centro',
      cliente: 'Ana',
      totalCentavos: 15_050,
    });
    expect(await en(a, () => db.visitasParaExportar(null))).toHaveLength(3);
    expect(
      (await en(b, () => db.visitasParaExportar(null))).every((v) => v.codigo.startsWith('XB')),
    ).toBe(true);
  });

  it('la descarga queda en la bitácora del negocio', async () => {
    const [duenio] = await en(a, () =>
      db.prisma.userAccount.create({
        data: { email: 'duenio@exportar.mx', name: 'Dueño', role: 'DUENO' },
        select: { id: true },
      }),
    ).then((u) => [u]);
    await en(a, () => db.anotarDescarga(duenio!.id, 'clientes', 1, '203.0.113.9'));
    const bitacora = await en(a, () => db.bitacoraLealtad(10));
    expect(JSON.stringify(bitacora)).toContain('Descargó la lista de clientes');
  });
});
