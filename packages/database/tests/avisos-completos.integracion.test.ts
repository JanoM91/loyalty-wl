import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, comoDuenio, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('avisos completos: programados, entrega, plantillas y buzón', () => {
  let a: db.Negocio;
  let b: db.Negocio;

  beforeAll(async () => {
    a = await negocioDePrueba({ slug: 'prueba-buzon-a', nombre: 'Buzón A', prefijoCodigo: 'BA' });
    b = await negocioDePrueba({ slug: 'prueba-buzon-b', nombre: 'Buzón B', prefijoCodigo: 'BB' });
  });

  afterAll(async () => {
    await comoDuenio("DELETE FROM platform_notice WHERE sent_by = 'avisos@ejemplo.mx'");
    await comoDuenio("DELETE FROM platform_notice_template WHERE updated_by = 'avisos@ejemplo.mx'");
    for (const n of [a, b]) if (n) await db.borrarNegocio(n.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  const base = {
    asunto: 'Novedad',
    mensaje: 'Ya puedes dar regalos de cumpleaños.',
    audiencia: 'Un club',
    valorAudiencia: 'club:prueba-buzon-a',
    enviadoPor: 'avisos@ejemplo.mx',
  };

  it('un programado sale una sola vez cuando toca y se puede cancelar antes', async () => {
    const pronto = await db.crearAvisoPlataforma({
      ...base,
      programadoPara: new Date(Date.now() + 60_000),
    });
    const luego = await db.crearAvisoPlataforma({
      ...base,
      programadoPara: new Date(Date.now() + 3_600_000),
    });
    expect((await db.leerAvisoPlataforma(pronto))?.estado).toBe('PROGRAMADO');
    expect(await db.tomarAvisosQueTocan(new Date())).not.toContain(pronto);
    const tomados = await db.tomarAvisosQueTocan(new Date(Date.now() + 120_000));
    expect(tomados).toContain(pronto);
    expect(tomados).not.toContain(luego);
    // Una segunda corrida ya no lo toma.
    expect(await db.tomarAvisosQueTocan(new Date(Date.now() + 120_000))).not.toContain(pronto);
    expect((await db.leerAvisoPlataforma(pronto))?.estado).toBe('ENVIANDO');
    expect(await db.cancelarAvisoProgramado(pronto)).toBe(false);
    expect(await db.cancelarAvisoProgramado(luego)).toBe(true);
    expect((await db.leerAvisoPlataforma(luego))?.estado).toBe('CANCELADO');
  });

  it('cerrar anota destinatarios, deja copia en el buzón y cuenta lo que salió', async () => {
    const id = await db.crearAvisoPlataforma(base);
    const r = await db.cerrarAvisoPlataforma(id, {
      audiencia: 'Buzón A',
      destinatarios: [
        {
          negocioId: a.id,
          club: 'Buzón A',
          email: 'uno@ejemplo.mx',
          nombre: 'Uno',
          resendId: 're_1',
        },
        {
          negocioId: a.id,
          club: 'Buzón A',
          email: 'dos@ejemplo.mx',
          nombre: 'Dos',
          resendId: null,
        },
      ],
      clubes: [a.id],
    });
    expect(r).toEqual({ enviados: 1, fallidos: 1 });
    expect(await db.leerAvisoPlataforma(id)).toMatchObject({
      estado: 'ENVIADO',
      enviados: 1,
      fallidos: 1,
      clubes: 1,
    });
    const lista = await db.destinatariosDeAviso(id);
    expect(lista.map((d) => d.estado).sort()).toEqual(['ENVIADO', 'FALLIDO']);
    expect(
      await db.actualizarEntregas(
        new Map([
          ['re_1', 'delivered'],
          ['re_x', 'opened'],
        ]),
      ),
    ).toBe(1);
    expect(
      (await db.destinatariosDeAviso(id)).find((d) => d.email === 'uno@ejemplo.mx')?.estado,
    ).toBe('ENTREGADO');
    // Un evento desconocido no cambia nada.
    expect(await db.actualizarEntregas(new Map([['re_1', 'raro']]))).toBe(0);
  });

  it('el buzón solo se ve en su club, se marca leído y la aplicación no escribe en él', async () => {
    const enA = await en(a, () => db.avisosDelClub());
    expect(enA.some((x) => x.asunto === 'Novedad')).toBe(true);
    expect(await en(b, () => db.avisosDelClub())).toEqual([]);
    expect(await en(a, () => db.avisosSinLeer())).toBeGreaterThan(0);
    await en(a, () => db.marcarAvisosLeidos());
    expect(await en(a, () => db.avisosSinLeer())).toBe(0);
    await expect(
      en(b, () =>
        db.prisma.clubNotice.create({
          data: { noticeId: a.id, subject: 'x', body: 'y' },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      en(a, () => db.transaccion((tx) => tx.$queryRaw`SELECT 1 FROM platform_notice_recipient`)),
    ).rejects.toThrow();
  });

  it('plantillas: guardar con el mismo nombre la reemplaza', async () => {
    await db.guardarPlantillaAviso(
      { nombre: 'Prueba avisos', asunto: 'Uno', mensaje: 'Primer texto largo' },
      'avisos@ejemplo.mx',
    );
    await db.guardarPlantillaAviso(
      { nombre: 'Prueba avisos', asunto: 'Dos', mensaje: 'Segundo texto largo' },
      'avisos@ejemplo.mx',
    );
    const mias = (await db.listarPlantillasAviso()).filter((p) => p.nombre === 'Prueba avisos');
    expect(mias).toHaveLength(1);
    expect(mias[0]).toMatchObject({ asunto: 'Dos' });
    await db.borrarPlantillaAviso(mias[0]!.id);
    expect((await db.listarPlantillasAviso()).some((p) => p.nombre === 'Prueba avisos')).toBe(
      false,
    );
  });
});
