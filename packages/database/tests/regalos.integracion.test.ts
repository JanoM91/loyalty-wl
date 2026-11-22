import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formarCodigoTarjeta } from '@wl/domain';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

const DIA = 24 * 60 * 60 * 1000;
/** Mediodía en México: lejos de cualquier cambio de fecha. */
const ahora = new Date('2026-11-22T18:00:00.000Z');
const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA);

describe.skipIf(!CON_BD)('regalos automáticos', () => {
  let a: db.Negocio;
  let b: db.Negocio;
  let sucursal = '';
  let usuario = '';
  const ids: Record<string, string> = {};
  const codigos: Record<string, string> = {};

  const tarjeta = async (clave: string, extra: Record<string, unknown>) => {
    const codigo = formarCodigoTarjeta(randomBytes(8));
    const t = await db.prisma.loyaltyCard.create({
      data: { publicCode: codigo, termsVersion: 'prueba', termsAcceptedAt: hace(400), ...extra },
      select: { id: true },
    });
    ids[clave] = t.id;
    codigos[clave] = codigo;
    return t.id;
  };

  const visita = (cardId: string, dias: number, estado: 'ACREDITADA' | 'RECHAZADA') =>
    db.prisma.loyaltyAccrual.create({
      data: {
        cardId,
        branchId: sucursal,
        status: estado,
        purchaseDate: new Date(hace(dias).toISOString().slice(0, 10)),
        ticketFolio: `F${randomBytes(4).toString('hex')}`,
        ticketRegister: '1',
        ticketKey: `${sucursal}|${randomBytes(8).toString('hex')}`,
        totalCents: 10_000,
        eligibleCents: 10_000,
        stampsAwarded: estado === 'ACREDITADA' ? 1 : 0,
        programVersion: 'v1',
        createdAt: hace(dias),
      },
    });

  const avisable = {
    marketingOptIn: true,
    marketingOptInAt: hace(400),
    emailVerifiedAt: hace(400),
  };

  beforeAll(async () => {
    a = await negocioDePrueba({ slug: 'prueba-regalos-a', nombre: 'Café A', prefijoCodigo: 'RA' });
    b = await negocioDePrueba({ slug: 'prueba-regalos-b', nombre: 'Café B', prefijoCodigo: 'RB' });
    await en(a, async () => {
      sucursal = (
        await db.prisma.branch.create({
          data: {
            slug: 'regalos-centro',
            name: 'Centro',
            addressLine: 'Calle 1',
            neighborhood: 'Centro',
            postalCode: '91000',
            loyaltyEnabled: true,
          },
        })
      ).id;
      usuario = (
        await db.prisma.userAccount.create({
          data: { email: 'caja-regalos@ejemplo.mx', name: 'Caja', role: 'GERENTE' },
        })
      ).id;

      // Vino hace 40 días: le toca «Te extrañamos» a 30 días.
      await tarjeta('ausente', { email: 'ausente@ejemplo.mx', name: 'Ana', ...avisable });
      await visita(ids.ausente!, 40, 'ACREDITADA');
      // Una visita rechazada reciente no cuenta como visita.
      await visita(ids.ausente!, 5, 'RECHAZADA');
      // Vino hace 10 días: todavía no.
      await tarjeta('reciente', { email: 'reciente@ejemplo.mx', ...avisable });
      await visita(ids.reciente!, 10, 'ACREDITADA');
      // Nunca sumó una visita; se dio de alta hace 35 días: cuenta su alta.
      await tarjeta('sinVisitas', {
        email: 'alta@ejemplo.mx',
        ...avisable,
        createdAt: hace(35),
      });
      // Hace más de 180 días: ya no se le escribe.
      await tarjeta('perdido', { email: 'perdido@ejemplo.mx', ...avisable });
      await visita(ids.perdido!, 200, 'ACREDITADA');
      // Ausente pero sin aceptar promociones: no se le puede avisar.
      await tarjeta('sinPromos', { email: 'nopromo@ejemplo.mx', emailVerifiedAt: hace(400) });
      await visita(ids.sinPromos!, 40, 'ACREDITADA');

      // Cumple hoy (22 de noviembre), con y sin promociones; y otro que cumple mañana.
      await tarjeta('cumpleAvisable', {
        email: 'cumple@ejemplo.mx',
        name: 'Luis',
        birthDay: 22,
        birthMonth: 11,
        ...avisable,
      });
      await tarjeta('cumpleSinCorreo', { phone: '+522281110000', birthDay: 22, birthMonth: 11 });
      await tarjeta('cumpleManana', { email: 'manana@ejemplo.mx', birthDay: 23, birthMonth: 11 });
    });
    // En B, alguien que también cumple hoy: no debe aparecer en A.
    await en(b, () =>
      db.prisma.loyaltyCard.create({
        data: {
          publicCode: formarCodigoTarjeta(randomBytes(8)),
          termsVersion: 'prueba',
          termsAcceptedAt: hace(400),
          birthDay: 22,
          birthMonth: 11,
        },
      }),
    );
  });

  afterAll(async () => {
    if (a) await db.borrarNegocio(a.id);
    if (b) await db.borrarNegocio(b.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('«Te extrañamos» encuentra a quien dejó de venir y puede recibir el correo', async () => {
    const lista = await en(a, () => db.candidatosRegreso(30, 50, ahora));
    expect(lista.map((c) => c.cardId).sort()).toEqual([ids.ausente, ids.sinVisitas].sort());
    // La de 40 días antes que la de 35: primero la ausencia más reciente.
    expect(lista[0]!.cardId).toBe(ids.sinVisitas);
    expect(await en(a, () => db.candidatosRegreso(60, 50, ahora))).toEqual([]);
    expect(await en(a, () => db.candidatosRegreso(30, 1, ahora))).toHaveLength(1);
  });

  it('da el regalo una vez por periodo y no vuelve a escribir en la misma ausencia', async () => {
    const dado = await en(a, () =>
      db.darRegalo(
        { cardId: ids.ausente!, tipo: 'REGRESO', titulo: 'Un café', vigencia: 14 },
        ahora,
      ),
    );
    expect(dado).toMatchObject({ ultimoDia: '2026-12-05' });
    const repetido = await en(a, () =>
      db.darRegalo(
        { cardId: ids.ausente!, tipo: 'REGRESO', titulo: 'Un café', vigencia: 14 },
        ahora,
      ),
    );
    expect(repetido).toBeNull();
    await en(a, () => db.marcarRegalosAvisados([dado!.id], ahora));

    // Al día siguiente sigue sin venir: no se le vuelve a escribir.
    const manana = new Date(ahora.getTime() + DIA);
    const lista = await en(a, () => db.candidatosRegreso(30, 50, manana));
    expect(lista.map((c) => c.cardId)).not.toContain(ids.ausente);
  });

  it('los correos de regalos cuentan para el tope del mes', async () => {
    expect(await en(a, () => db.usoMensajesDelMes(ahora))).toBe(1);
    expect(await en(b, () => db.usoMensajesDelMes(ahora))).toBe(0);
  });

  it('cumpleaños: todos los que cumplen hoy, solo de su club, avisables o no', async () => {
    const lista = await en(a, () => db.candidatosCumple(50, ahora));
    expect(lista.map((c) => c.cardId).sort()).toEqual(
      [ids.cumpleAvisable, ids.cumpleSinCorreo].sort(),
    );
    expect(lista.find((c) => c.cardId === ids.cumpleAvisable)?.avisable).toBe(true);
    expect(lista.find((c) => c.cardId === ids.cumpleSinCorreo)?.avisable).toBe(false);

    await en(a, () =>
      db.darRegalo(
        { cardId: ids.cumpleSinCorreo!, tipo: 'CUMPLE', titulo: 'Postre', vigencia: 7 },
        ahora,
      ),
    );
    // Uno al año: ya no aparece.
    const despues = await en(a, () => db.candidatosCumple(50, ahora));
    expect(despues.map((c) => c.cardId)).toEqual([ids.cumpleAvisable]);
  });

  it('la caja ve el regalo y lo entrega una sola vez, solo con la tarjeta verificada', async () => {
    const vista = await en(a, () => db.vistaCaja(codigos.ausente!, sucursal));
    const regalo = vista?.premiosDisponibles.find((p) => p.regalo);
    expect(regalo).toMatchObject({ nombre: 'Te extrañamos: Un café', tipo: 'REGALO_REGRESO' });
    const id = regalo!.id.slice(db.PREFIJO_REGALO.length);

    const ajena = await en(a, () =>
      db.entregarRegalo({
        regaloId: id,
        codigo: codigos.reciente!,
        sucursalId: sucursal,
        usuarioId: usuario,
      }),
    );
    expect(ajena).toMatchObject({ ok: false });

    const ok = await en(a, () =>
      db.entregarRegalo({
        regaloId: id,
        codigo: codigos.ausente!,
        sucursalId: sucursal,
        usuarioId: usuario,
      }),
    );
    expect(ok).toEqual({ ok: true, tipo: 'REGALO_REGRESO', nombre: 'Te extrañamos: Un café' });
    const otraVez = await en(a, () =>
      db.entregarRegalo({
        regaloId: id,
        codigo: codigos.ausente!,
        sucursalId: sucursal,
        usuarioId: usuario,
      }),
    );
    expect(otraVez).toMatchObject({ ok: false });

    // El de cumpleaños de una tarjeta sin verificar se conserva.
    const sinVerificar = await en(a, () => db.regalosDeTarjeta(ids.cumpleSinCorreo!));
    const r = await en(a, () =>
      db.entregarRegalo({
        regaloId: sinVerificar[0]!.id,
        codigo: codigos.cumpleSinCorreo!,
        sucursalId: sucursal,
        usuarioId: usuario,
      }),
    );
    expect(r).toMatchObject({ ok: false });
    expect(await en(a, () => db.regalosDeTarjeta(ids.cumpleSinCorreo!))).toHaveLength(1);
  });

  it('un regalo vencido ya no aparece ni se entrega', async () => {
    const despues = new Date(ahora.getTime() + 30 * DIA);
    expect(await en(a, () => db.regalosDeTarjeta(ids.cumpleSinCorreo!, despues))).toEqual([]);
  });

  it('cuenta quién regresó después del regalo', async () => {
    await en(a, () => visita(ids.ausente!, -1, 'ACREDITADA'));
    const c = await en(a, () => db.cifrasDeRegalos(hace(30)));
    expect(c.REGRESO).toEqual({ dados: 1, avisados: 1, entregados: 1, regresaron: 1 });
    expect(c.CUMPLE).toMatchObject({ dados: 1, avisados: 0, entregados: 0 });
  });

  it('guarda lo que eligió el dueño sin tocar el resto de los ajustes', async () => {
    await db.guardarRegalos(a.id, {
      regreso: { activo: true, dias: 45, regalo: 'Un café', vigencia: 14 },
      cumple: { activo: true, regalo: 'Postre', vigencia: 7 },
    });
    const n = (await db.negocioPorSlug('prueba-regalos-a'))!;
    expect(n.ajustes.regalos.regreso).toMatchObject({ activo: true, dias: 45 });
    expect(n.ajustes.regalos.cumple).toMatchObject({ activo: true, regalo: 'Postre' });
    expect(n.nombre).toBe('Café A');
  });
});
