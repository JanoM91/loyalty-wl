import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaLocal, sumarDias } from '@wl/domain';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('reportes por periodo', () => {
  let n: db.Negocio;
  let otro: db.Negocio;
  let hoy = '';

  beforeAll(async () => {
    n = await negocioDePrueba({
      slug: 'prueba-reportes',
      nombre: 'Reportes',
      prefijoCodigo: 'RP',
      sucursales: [
        { slug: 'centro', nombre: 'Centro', participa: true },
        { slug: 'norte', nombre: 'Norte', participa: true },
      ],
    });
    otro = await negocioDePrueba({
      slug: 'prueba-reportes-otro',
      nombre: 'Otro',
      prefijoCodigo: 'RO',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    hoy = fechaLocal(new Date(), n.zonaHoraria);
    const sembrar = async (club: db.Negocio, prefijo: string) =>
      en(club, async () => {
        const sucursales = await db.prisma.branch.findMany({ select: { id: true, slug: true } });
        const centro = sucursales.find((s) => s.slug === 'centro')!.id;
        const norte = sucursales.find((s) => s.slug === 'norte')?.id ?? centro;
        // Ana: 3 visitas en 10 días (2 en Centro, 1 en Norte) y un premio canjeado.
        // Beto: 1 visita hace 40 días (periodo anterior) y 1 hoy: «regresó».
        // Caro: 1 visita hoy.
        const tarjetas: Record<string, string> = {};
        for (const [nombre, sucursal] of [
          ['Ana', centro],
          ['Beto', centro],
          ['Caro', norte],
        ] as const) {
          const t = await db.prisma.loyaltyCard.create({
            data: {
              publicCode: `${prefijo}-AAAA-${nombre.toUpperCase().padEnd(4, 'X')}`,
              name: nombre,
              phone: `52${prefijo === 'RP' ? 1 : 2}${String(Object.keys(tarjetas).length).padStart(10, '0')}`,
              termsVersion: 'v1',
              termsAcceptedAt: new Date(),
              enrolledBranchId: sucursal,
              createdAt: new Date(Date.now() - 45 * 86_400_000),
            },
            select: { id: true },
          });
          tarjetas[nombre] = t.id;
        }
        const visita = async (quien: string, dias: number, sucursal: string, hora = 10) => {
          const fecha = sumarDias(hoy, -dias);
          return db.prisma.loyaltyAccrual.create({
            data: {
              cardId: tarjetas[quien]!,
              branchId: sucursal,
              status: 'ACREDITADA',
              purchaseDate: new Date(`${fecha}T00:00:00Z`),
              // Registrada ese mismo día a la hora dada, en la zona del negocio (UTC−6).
              createdAt: new Date(`${fecha}T${String(hora + 6).padStart(2, '0')}:00:00Z`),
              ticketFolio: `F-${quien}-${dias}`,
              ticketRegister: '1',
              ticketKey: `${prefijo}-${quien}-${dias}`,
              totalCents: 10_000,
              eligibleCents: 10_000,
              stampsAwarded: 1,
              programVersion: 'v1',
            },
            select: { id: true },
          });
        };
        await visita('Ana', 9, centro, 9);
        await visita('Ana', 5, centro, 9);
        const premio = await visita('Ana', 1, norte, 18);
        await visita('Beto', 40, centro);
        await visita('Beto', 0, centro, 13);
        await visita('Caro', 0, norte, 13);
        await db.prisma.loyaltyReward.create({
          data: {
            cardId: tarjetas.Ana!,
            kind: 'PREMIO',
            title: 'Café',
            milestone: 3,
            cycle: 1,
            accrualId: premio.id,
            status: 'ENTREGADO',
            redeemedAt: new Date(),
            redeemedBranchId: norte,
          },
        });
      });
    await sembrar(n, 'RP');
    await sembrar(otro, 'RO');
  });

  afterAll(async () => {
    for (const x of [n, otro]) if (x) await db.borrarNegocio(x.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  const filtros = (
    extra: Partial<{ sucursales: string[]; agrupar: 'DIA' | 'SEMANA' | 'MES' }> = {},
  ) => ({
    desde: sumarDias(hoy, -27),
    hasta: hoy,
    agrupar: 'DIA' as const,
    sucursales: [] as string[],
    ...extra,
  });

  it('indicadores del periodo y el regreso contra el periodo anterior', async () => {
    const r = await en(n, () => db.reportePeriodo(filtros()));
    expect(r.actual).toMatchObject({
      visitas: 5,
      clientes: 3,
      repiten: 1,
      baseRegreso: 1,
      regresaron: 1,
      premiosGanados: 1,
      premiosCanjeados: 1,
    });
    expect(r.previo).toMatchObject({ visitas: 1, clientes: 1 });
    expect(r.frecuencia.find((c) => c.cubeta === '1')?.clientes).toBe(2);
    expect(r.frecuencia.find((c) => c.cubeta === '3')?.clientes).toBe(1);
    expect(r.serie.reduce((s, p) => s + p.visitas, 0)).toBe(5);
    const hoyMismo = await en(n, () => db.analiticaLealtad());
    expect(hoyMismo.diasAlPrimerPremio).not.toBeNull();
    expect(hoyMismo.posicionesPremio.length).toBeGreaterThan(0);
  });

  it('el filtro de sucursal y los horarios', async () => {
    const r = await en(n, () => db.reportePeriodo(filtros({ sucursales: ['norte'] })));
    expect(r.actual).toMatchObject({ visitas: 2, clientes: 2, premiosCanjeados: 1 });
    expect(r.sucursales.map((s) => s.slug)).toEqual(['norte']);
    const todo = await en(n, () => db.reportePeriodo(filtros()));
    expect(todo.horarios.reduce((s, c) => s + c.visitas, 0)).toBe(5);
    expect(todo.horarios.find((c) => c.hora === 13)?.visitas).toBe(2);
    expect(
      todo.porSucursal.filter((p) => p.sucursal === 'centro').reduce((s, p) => s + p.visitas, 0),
    ).toBe(3);
    const mes = await en(n, () => db.reportePeriodo(filtros({ agrupar: 'MES' })));
    expect(mes.serie.length).toBeLessThanOrEqual(2);
  });

  it('no se cruzan clubes y las opciones traen sus sucursales', async () => {
    const r = await en(otro, () => db.reportePeriodo(filtros()));
    expect(r.actual.visitas).toBe(5);
    expect(r.sucursales.map((s) => s.slug)).toEqual(['centro']);
    const o = await en(n, () => db.opcionesReporte());
    expect(o.sucursales.map((s) => s.slug)).toEqual(['centro', 'norte']);
    expect(o.primerDia).not.toBeNull();
  });
});
