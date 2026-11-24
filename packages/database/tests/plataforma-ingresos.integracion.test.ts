import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, comoDuenio, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('ingresos y actividad de plataforma', () => {
  let club: db.Negocio;
  let otro: db.Negocio;

  beforeAll(async () => {
    club = await negocioDePrueba({
      slug: 'prueba-ingresos',
      nombre: 'Ingresos',
      prefijoCodigo: 'IN',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    otro = await negocioDePrueba({
      slug: 'prueba-ingresos-2',
      nombre: 'Otro',
      prefijoCodigo: 'IO',
    });
  });

  afterAll(async () => {
    await comoDuenio('DELETE FROM platform_payment WHERE tenant_slug LIKE $1', [
      'prueba-ingresos%',
    ]);
    for (const n of [club, otro]) if (n) await db.borrarNegocio(n.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('registra el pago con su importe y lo suma al mes en curso', async () => {
    const antes = (await db.ingresosPorMes(6)).at(-1)!;
    const r = await db.registrarPagoDeClub(
      club,
      { concepto: 'LITE', periodo: 'MES', centavos: 26_900, nota: 'Transferencia' },
      'jano@ejemplo.mx',
    );
    expect(r.ok).toBe(true);
    const leido = (await db.negocioPorId(club.id))!;
    expect(leido.ajustes.pagadoHasta).toBe(r.ok ? r.hasta : null);
    const meses = await db.ingresosPorMes(6);
    expect(meses).toHaveLength(6);
    expect(meses.at(-1)!.centavos - antes.centavos).toBe(26_900);
    const [pago] = await db.listarPagos({ clubId: club.id });
    expect(pago).toMatchObject({
      concepto: 'LITE',
      periodo: 'MES',
      centavos: 26_900,
      nota: 'Transferencia',
      registro: 'jano@ejemplo.mx',
      antes: null,
      anulado: null,
    });
    expect(
      (
        await db.registrarPagoDeClub(
          club,
          { concepto: 'LITE', periodo: 'MES', centavos: -1 },
          'jano@ejemplo.mx',
        )
      ).ok,
    ).toBe(false);
  });

  it('anular el último pago regresa la fecha; uno con pagos después solo se anula', async () => {
    const actual = (await db.negocioPorId(club.id))!;
    const anual = await db.registrarPagoDeClub(
      actual,
      { concepto: 'LITE', periodo: 'ANIO', centavos: 269_900 },
      'jano@ejemplo.mx',
    );
    if (!anual.ok) throw new Error(anual.error);
    const deshacer = await db.anularPagoDeClub(anual.id, 'jano@ejemplo.mx');
    expect(deshacer).toMatchObject({ ok: true, revertido: true });
    const tras = (await db.negocioPorId(club.id))!;
    expect(tras.ajustes.pagadoHasta).toBe(actual.ajustes.pagadoHasta);
    expect((await db.anularPagoDeClub(anual.id, 'jano@ejemplo.mx')).ok).toBe(false);

    // El primer pago ya tiene uno posterior (anulado no cuenta, así que sí es el último):
    const [primero] = (await db.listarPagos({ clubId: club.id })).filter((p) => !p.anulado);
    const extra = await db.registrarPagoDeClub(
      tras,
      { concepto: 'LITE', periodo: 'MES', centavos: 26_900 },
      'jano@ejemplo.mx',
    );
    if (!extra.ok) throw new Error(extra.error);
    const solo = await db.anularPagoDeClub(primero!.id, 'jano@ejemplo.mx');
    expect(solo).toMatchObject({ ok: true, revertido: false });
    expect((await db.negocioPorId(club.id))!.ajustes.pagadoHasta).toBe(extra.hasta);
  });

  it('el Arcade se activa con su pago y al anularlo se apaga si no estaba pagado', async () => {
    const n = (await db.negocioPorId(otro.id))!;
    const r = await db.registrarPagoDeClub(
      n,
      { concepto: 'ARCADE', periodo: 'MES', centavos: 0 },
      'jano@ejemplo.mx',
    );
    if (!r.ok) throw new Error(r.error);
    expect((await db.negocioPorId(otro.id))!.ajustes.arcade).toMatchObject({
      activo: true,
      pagadoHasta: r.hasta,
    });
    expect((await db.anularPagoDeClub(r.id, 'jano@ejemplo.mx')).ok).toBe(true);
    expect((await db.negocioPorId(otro.id))!.ajustes.arcade).toMatchObject({
      activo: false,
      pagadoHasta: null,
    });
  });

  it('recurrente y renovaciones salen de lo pagado y vigente', async () => {
    const lista = await db.listarNegocios();
    const rec = await db.ingresoRecurrente(
      lista.filter((f) => f.negocio.slug.startsWith('prueba-ingresos')),
    );
    expect(rec).toMatchObject({ centavosAlMes: 26_900, clubes: 1, sinImporte: 0 });
    const ren = db.renovacionesProximas(lista, 90);
    expect(ren.some((r) => r.fila.negocio.id === club.id && r.concepto === 'LITE')).toBe(true);
    expect(ren.some((r) => r.fila.negocio.id === otro.id)).toBe(false);
  });

  it('el pago sobrevive al borrado del club con su nombre', async () => {
    const tmp = await negocioDePrueba({
      slug: 'prueba-ingresos-3',
      nombre: 'Se va',
      prefijoCodigo: 'IV',
    });
    const r = await db.registrarPagoDeClub(
      tmp,
      { concepto: 'LITE', periodo: 'MES', centavos: 26_900 },
      'jano@ejemplo.mx',
    );
    if (!r.ok) throw new Error(r.error);
    await db.borrarNegocio(tmp.id);
    const [fila] = await comoDuenio<{ tenant_id: string | null; tenant_name: string }>(
      'SELECT tenant_id, tenant_name FROM platform_payment WHERE id = $1',
      [r.id],
    );
    expect(fila).toEqual({ tenant_id: null, tenant_name: 'Se va' });
  });

  it('cuenta visitas, tarjetas y acceso de cada club sin cruzar datos', async () => {
    await db.conNegocio(club, async () => {
      const [sucursal] = await db.prisma.branch.findMany({ select: { id: true } });
      const tarjeta = await db.prisma.loyaltyCard.create({
        data: {
          publicCode: 'IN-AAAA-0001',
          phone: '5212345678901',
          termsVersion: 'v1',
          termsAcceptedAt: new Date(),
        },
        select: { id: true },
      });
      for (const dias of [1, 2, 10]) {
        await db.prisma.loyaltyAccrual.create({
          data: {
            cardId: tarjeta.id,
            branchId: sucursal!.id,
            status: 'ACREDITADA',
            purchaseDate: new Date(Date.now() - dias * 86_400_000),
            createdAt: new Date(Date.now() - dias * 86_400_000),
            ticketFolio: `F${dias}`,
            ticketRegister: '1',
            ticketKey: `prueba-ingresos-${dias}`,
            totalCents: 10_000,
            eligibleCents: 10_000,
            stampsAwarded: 1,
            programVersion: 'v1',
          },
        });
      }
    });
    const uso = await db.usoDeClubes([club.id, otro.id]);
    expect(uso.get(club.id)).toMatchObject({
      tarjetas: 1,
      visitas7: 2,
      visitas7Previas: 1,
      visitas30: 3,
      duenioConContrasena: false,
      ultimoAcceso: null,
    });
    expect(uso.get(otro.id)).toMatchObject({ tarjetas: 0, visitas30: 0, ultimaVisita: null });
    expect((await db.usoDeClubes()).size).toBeGreaterThanOrEqual(2);
    expect((await db.usoDeClubes([])).size).toBe(0);
  });
});
