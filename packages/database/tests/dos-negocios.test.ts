import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaLocal } from '@wl/domain';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

/**
 * El recorrido completo (alta → visita → premio → canje) en dos negocios con
 * marca, programa y reglas distintos, a la vez y sin tocarse. Es el criterio
 * de salida de la Fase 2, a nivel de datos.
 */
describe.skipIf(!CON_BD)('dos negocios, dos programas', () => {
  let cafe: db.Negocio;
  let barberia: db.Negocio;

  const CELULAR = '2289876543';

  async function personal(n: db.Negocio) {
    return en(n, async () => {
      const sucursal = await db.prisma.branch.findFirstOrThrow({ where: { slug: 'centro' } });
      const caja = await db.prisma.userAccount.create({
        data: { email: 'caja@ejemplo.mx', name: 'Caja', role: 'SUCURSAL', branchId: sucursal.id },
      });
      return { sucursal: sucursal.id, caja: caja.id };
    });
  }

  const ticket = (folio: string, zona: string) => ({
    folio,
    caja: '1',
    fecha: fechaLocal(new Date(), zona),
    totalCentavos: 12_000,
    propinaCentavos: 0,
    descuentoCentavos: 0,
    fotoUrl: null,
    origen: 'MANUAL' as const,
  });

  beforeAll(async () => {
    cafe = await negocioDePrueba({
      slug: 'prueba-cafe',
      nombre: 'Café El Buentueste',
      prefijoCodigo: 'CB',
      marca: { frase: 'Tostado en casa' },
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
      programa: {
        posiciones: 6,
        modalidad: 'VISITA',
        hitos: [
          {
            posicion: 6,
            premio: 'CAFE_GRATIS',
            nombre: 'Café gratis',
            incluye: 'Un café del día.',
          },
        ],
        tramos: [],
        ventanaContingenciaDias: 2,
      },
    });
    barberia = await negocioDePrueba({
      slug: 'prueba-barberia',
      nombre: 'Barbería Don Filo',
      prefijoCodigo: 'DF',
      zonaHoraria: 'America/Tijuana',
      ajustes: { comprobanteConQr: 'OBLIGATORIO' },
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
      programa: {
        posiciones: 3,
        modalidad: 'VISITA',
        hitos: [
          {
            posicion: 3,
            premio: 'CORTE_GRATIS',
            nombre: 'Corte gratis',
            incluye: 'Un corte clásico.',
          },
        ],
        tramos: [],
        ventanaContingenciaDias: 1,
      },
    });
  });

  afterAll(async () => {
    if (cafe) await db.borrarNegocio(cafe.id);
    if (barberia) await db.borrarNegocio(barberia.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('cada negocio lee su marca, su zona, su prefijo y sus reglas', () => {
    expect(cafe.marca.frase).toBe('Tostado en casa');
    expect(cafe.ajustes.comprobanteConQr).toBe('PEDIDO');
    expect(barberia.zonaHoraria).toBe('America/Tijuana');
    expect(barberia.ajustes.comprobanteConQr).toBe('OBLIGATORIO');
    expect(barberia.marca.colores).toEqual(db.MARCA_POR_OMISION.colores);
  });

  it('cada negocio acredita con su propio programa', async () => {
    const [pCafe, pBarberia] = await Promise.all([
      en(cafe, () => db.programaVigente()),
      en(barberia, () => db.programaVigente()),
    ]);
    expect(pCafe.posiciones).toBe(6);
    expect(pBarberia.posiciones).toBe(3);
    expect(pBarberia.hitos[0]?.nombre).toBe('Corte gratis');
  });

  it('la misma persona tiene tarjeta en los dos, con el prefijo de cada uno', async () => {
    const alta = (n: db.Negocio) =>
      en(n, () =>
        db.crearTarjeta({ contacto: CELULAR, aceptaTerminos: true, aceptaPromociones: false }),
      );
    const [a, b] = await Promise.all([alta(cafe), alta(barberia)]);
    expect(a.ok && a.codigo).toMatch(/^CB-/);
    expect(b.ok && b.codigo).toMatch(/^DF-/);
    // Repetir el alta en el mismo negocio sí choca.
    expect(await alta(cafe)).toMatchObject({ ok: false, yaExiste: true });
  });

  it('recorrido completo en la barbería: tres visitas, premio y canje', async () => {
    const { sucursal, caja } = await personal(barberia);
    await en(barberia, async () => {
      const tarjeta = await db.prisma.loyaltyCard.findFirstOrThrow({ where: { phone: CELULAR } });
      const codigo = tarjeta.publicCode;

      // Este negocio exige comprobante también con QR.
      expect(
        await db.acreditarVisita({
          codigo,
          sucursalId: sucursal,
          usuarioId: caja,
          ticket: ticket('', barberia.zonaHoraria),
        }),
      ).toEqual({ tipo: 'RECHAZADA', motivo: 'FALTA_FOLIO' });

      const primera = await db.acreditarVisita({
        codigo,
        sucursalId: sucursal,
        usuarioId: caja,
        ticket: ticket('B-001', barberia.zonaHoraria),
      });
      expect(primera).toMatchObject({ tipo: 'ACREDITADA', estampas: 1, despues: { estampas: 1 } });

      // Una por sucursal y día: la segunda del mismo día no suma.
      expect(
        await db.acreditarVisita({
          codigo,
          sucursalId: sucursal,
          usuarioId: caja,
          ticket: ticket('B-002', barberia.zonaHoraria),
        }),
      ).toEqual({ tipo: 'RECHAZADA', motivo: 'YA_ACUMULO_EN_FECHA' });

      // Dos visitas más en días anteriores ya aprobadas por administración.
      await db.transaccion(async (tx) => {
        const fila = await db.bloquearTarjeta(tx, codigo);
        await db.sumarEstampas(tx, fila!, null, 2, await db.programaVigente());
      });

      const vista = await db.vistaCaja(codigo, sucursal);
      expect(vista?.premiosDisponibles.map((p) => p.nombre)).toEqual(['Corte gratis']);
      // Tarjeta de 3 completada: empieza la segunda.
      expect(vista).toMatchObject({ estampas: 0, ciclo: 2 });

      const tarjetaVerificada = await db.prisma.loyaltyCard.update({
        where: { id: tarjeta.id },
        data: { phoneVerifiedAt: new Date() },
      });
      expect(tarjetaVerificada.tenantId).toBe(barberia.id);

      const entrega = await db.entregarPremio({
        codigo,
        premioId: vista!.premiosDisponibles[0]!.id,
        sucursalId: sucursal,
        usuarioId: caja,
      });
      expect(entrega).toMatchObject({ ok: true, nombre: 'Corte gratis' });
      expect((await db.vistaCaja(codigo, sucursal))?.premiosDisponibles).toEqual([]);
    });
  });

  it('recorrido en el café: la visita sin folio se acredita y queda anotada', async () => {
    const { sucursal, caja } = await personal(cafe);
    await en(cafe, async () => {
      const tarjeta = await db.prisma.loyaltyCard.findFirstOrThrow({ where: { phone: CELULAR } });
      const r = await db.acreditarVisita({
        codigo: tarjeta.publicCode,
        sucursalId: sucursal,
        usuarioId: caja,
        ticket: ticket('', cafe.zonaHoraria),
      });
      expect(r).toMatchObject({ tipo: 'ACREDITADA', estampas: 1 });
      const visita = await db.prisma.loyaltyAccrual.findFirstOrThrow({
        where: { cardId: tarjeta.id },
      });
      expect(visita.ticketFolio).toMatch(/^SF-/);
      expect(visita.note).toContain('sin folio');
      // Lo que pasó en la barbería no se ve desde el café.
      expect(await db.prisma.loyaltyReward.count()).toBe(0);
      expect((await db.vistaCaja(tarjeta.publicCode, sucursal))?.estampas).toBe(1);
    });
  });

  it('los reportes de cada negocio solo cuentan lo suyo', async () => {
    const [rCafe, rBarberia] = await Promise.all([
      en(cafe, () => db.resumenLealtad(7)),
      en(barberia, () => db.resumenLealtad(7)),
    ]);
    expect(rCafe.tarjetas).toBe(1);
    expect(rBarberia.tarjetas).toBe(1);
    const [aCafe, aBarberia] = await Promise.all([
      en(cafe, () => db.analiticaLealtad()),
      en(barberia, () => db.analiticaLealtad()),
    ]);
    expect(aCafe.resumen.visitas7d).toBe(1);
    expect(aBarberia.resumen.visitas7d).toBe(1);
    expect(aBarberia.premios.reduce((n, p) => n + p.entregados, 0)).toBe(1);
    expect(aCafe.premios.reduce((n, p) => n + p.entregados, 0)).toBe(0);
  });
});
