import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formarCodigoTarjeta } from '@wl/domain';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('mensajes a clientes', () => {
  let a: db.Negocio;
  let b: db.Negocio;
  let actor: { userId: string };
  const ids: Record<string, string> = {};

  const tarjeta = (extra: Record<string, unknown>) =>
    db.prisma.loyaltyCard.create({
      data: {
        publicCode: formarCodigoTarjeta(randomBytes(8)),
        termsVersion: 'prueba',
        termsAcceptedAt: new Date(),
        ...extra,
      },
      select: { id: true },
    });

  beforeAll(async () => {
    a = await negocioDePrueba({ slug: 'prueba-mensajes-a', nombre: 'Café A', prefijoCodigo: 'MA' });
    b = await negocioDePrueba({ slug: 'prueba-mensajes-b', nombre: 'Café B', prefijoCodigo: 'MB' });
    await en(a, async () => {
      const u = await db.prisma.userAccount.create({
        data: { email: 'duenio-mensajes@ejemplo.mx', name: 'Ana', role: 'DUENO' },
      });
      actor = { userId: u.id };
      const hoy = new Date();
      ids.si = (
        await tarjeta({
          email: 'si@ejemplo.mx',
          emailVerifiedAt: hoy,
          marketingOptIn: true,
          marketingOptInAt: hoy,
        })
      ).id;
      ids.sinVerificar = (
        await tarjeta({ email: 'nover@ejemplo.mx', marketingOptIn: true, marketingOptInAt: hoy })
      ).id;
      ids.sinPromos = (
        await tarjeta({ email: 'no@ejemplo.mx', emailVerifiedAt: hoy, marketingOptIn: false })
      ).id;
      ids.soloCelular = (
        await tarjeta({ phone: '+52 2281112233', marketingOptIn: true, phoneVerifiedAt: hoy })
      ).id;
    });
    // En B, una tarjeta que sí recibiría: no debe contar para A.
    await en(b, () =>
      tarjeta({
        email: 'otro@ejemplo.mx',
        emailVerifiedAt: new Date(),
        marketingOptIn: true,
      }),
    );
  });

  afterAll(async () => {
    if (a) await db.borrarNegocio(a.id);
    if (b) await db.borrarNegocio(b.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('solo cuenta a quien aceptó promociones con correo verificado, y solo de su club', async () => {
    expect(await en(a, () => db.audienciaMensajes())).toBe(1);
    const lista = await en(a, () => db.destinatariosMensaje(10));
    expect(lista.map((d) => d.cardId)).toEqual([ids.si]);
  });

  it('revisa asunto y mensaje', () => {
    expect(db.revisarMensaje('', 'Hola a todos, promo')).toMatchObject({ ok: false });
    expect(db.revisarMensaje('Promo', 'corto')).toMatchObject({ ok: false });
    const r = db.revisarMensaje('  Promo   de   martes ', 'Hola\r\n\r\n\r\n\r\nVen el martes.  ');
    expect(r).toEqual({
      ok: true,
      mensaje: { asunto: 'Promo de martes', cuerpo: 'Hola\n\nVen el martes.' },
    });
  });

  it('registra el envío, cuenta para el tope del mes y pide un día entre mensajes', async () => {
    expect(await en(a, () => db.siguienteMensajePosible())).toBeNull();
    const id = await en(a, () =>
      db.registrarMensaje({ asunto: 'Promo', cuerpo: 'Ven el martes.' }, 1, actor),
    );
    expect(await en(a, () => db.usoMensajesDelMes())).toBe(1);
    expect(await en(b, () => db.usoMensajesDelMes())).toBe(0);
    expect(await en(a, () => db.siguienteMensajePosible())).not.toBeNull();
    await en(a, () => db.cerrarMensaje(id, { enviados: 1, fallidos: 0 }));
    const [h] = await en(a, () => db.historialMensajes());
    expect(h).toMatchObject({ asunto: 'Promo', estado: 'ENVIADO', enviados: 1, autor: 'Ana' });
    expect(await en(b, () => db.historialMensajes())).toEqual([]);
  });

  it('la baja saca a la tarjeta de la audiencia y «fue un error» la regresa', async () => {
    expect(await en(a, () => db.darDeBajaPromociones(ids.si!))).toBe(true);
    expect(await en(a, () => db.audienciaMensajes())).toBe(0);
    // Desde otro club, la misma tarjeta no existe.
    expect(await en(b, () => db.darDeBajaPromociones(ids.si!))).toBe(false);
    expect(await en(a, () => db.volverAPromociones(ids.si!))).toBe(true);
    expect(await en(a, () => db.audienciaMensajes())).toBe(1);
  });

  it('el inicio del mes es el día 1 a medianoche de la Ciudad de México', () => {
    expect(db.inicioDelMes(new Date('2026-12-01T05:59:00Z')).toISOString()).toBe(
      '2026-11-01T06:00:00.000Z',
    );
    expect(db.inicioDelMes(new Date('2026-12-01T06:00:00Z')).toISOString()).toBe(
      '2026-12-01T06:00:00.000Z',
    );
  });

  it('la plataforma enciende el servicio y fija el tope', async () => {
    await db.fijarAjustesMensajes(a.id, { activo: true, topeMensual: 250 });
    const leido = await db.negocioPorSlug('prueba-mensajes-a');
    expect(leido?.ajustes.mensajes).toEqual({ activo: true, topeMensual: 250 });
    expect((await db.negocioPorSlug('prueba-mensajes-b'))?.ajustes.mensajes).toBeNull();
  });

  it('confirma el correo de la cuenta solo con el correo con que se firmó', async () => {
    expect(await en(a, () => db.cuentaParaConfirmar(actor.userId))).toMatchObject({
      email: 'duenio-mensajes@ejemplo.mx',
      confirmado: false,
    });
    expect(await en(a, () => db.confirmarCorreoUsuario(actor.userId, 'otro@ejemplo.mx'))).toBe(
      false,
    );
    expect(
      await en(a, () => db.confirmarCorreoUsuario(actor.userId, 'DUENIO-mensajes@ejemplo.mx')),
    ).toBe(true);
    expect((await en(a, () => db.cuentaParaConfirmar(actor.userId)))?.confirmado).toBe(true);
    expect(await en(b, () => db.cuentaParaConfirmar(actor.userId))).toBeNull();
    expect(await en(a, () => db.puedeMandarConfirmacion(actor.userId))).toBe(true);
    expect(await en(a, () => db.puedeMandarConfirmacion(actor.userId))).toBe(true);
    expect(await en(a, () => db.puedeMandarConfirmacion(actor.userId))).toBe(true);
    expect(await en(a, () => db.puedeMandarConfirmacion(actor.userId))).toBe(false);
  });
});
