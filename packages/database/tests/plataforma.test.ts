import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, comoDuenio, en, negocioDePrueba } from './ayuda';

describe.skipIf(!CON_BD)('panel de plataforma', () => {
  const email = `plataforma-${randomBytes(4).toString('hex')}@ejemplo.mx`;
  const clave = `${randomBytes(9).toString('base64url')} frase larga`;
  let negocio: db.Negocio;

  beforeAll(async () => {
    negocio = await negocioDePrueba({
      slug: 'prueba-plataforma',
      nombre: 'Negocio P',
      prefijoCodigo: 'PP',
    });
  });

  afterAll(async () => {
    await comoDuenio('DELETE FROM platform_user WHERE email = $1', [email]);
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('crea la cuenta, exige contraseña larga y deja entrar', async () => {
    expect((await db.crearUsuarioPlataforma({ email, nombre: 'Prueba', clave: 'corta' })).ok).toBe(
      false,
    );
    expect((await db.crearUsuarioPlataforma({ email, nombre: 'Prueba', clave })).ok).toBe(true);
    const r = await db.entrarPlataforma(email.toUpperCase(), clave);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await db.leerSesionPlataforma(r.token)).toMatchObject({ email, nombre: 'Prueba' });
    await db.salirPlataforma(r.token);
    expect(await db.leerSesionPlataforma(r.token)).toBeNull();
    expect(await db.leerSesionPlataforma('inventado')).toBeNull();
    expect(await db.leerSesionPlataforma(undefined)).toBeNull();
  });

  it('responde igual si la cuenta no existe y bloquea tras cinco fallos', async () => {
    const ajena = await db.entrarPlataforma('nadie@ejemplo.mx', clave);
    const mala = await db.entrarPlataforma(email, 'no es la contraseña');
    expect(ajena).toEqual(mala);
    for (let i = 0; i < 4; i += 1) await db.entrarPlataforma(email, 'no es la contraseña');
    // Ya bloqueada: ni la contraseña buena entra.
    const bloqueada = await db.entrarPlataforma(email, clave);
    expect(bloqueada).toMatchObject({ ok: false });
    expect(!bloqueada.ok && bloqueada.error).toMatch(/Demasiados intentos/);
  });

  it('la aplicación (rol de negocio) no puede leer las cuentas de plataforma', async () => {
    await expect(
      en(negocio, () => db.transaccion((tx) => tx.$queryRaw`SELECT email FROM platform_user`)),
    ).rejects.toThrow();
    await expect(
      en(negocio, () => db.transaccion((tx) => tx.$queryRaw`SELECT 1 FROM platform_session`)),
    ).rejects.toThrow();
  });

  it('lista los negocios con sus tamaños y cambia la modalidad', async () => {
    const lista = await db.listarNegocios();
    const fila = lista.find((n) => n.negocio.slug === 'prueba-plataforma');
    expect(fila).toMatchObject({ tarjetas: 0, usuarios: 0 });
    expect(fila?.negocio.ajustes.plan).toBe('LITE');
    await db.cambiarPlan(negocio.id, 'PRIVADA');
    expect((await db.negocioPorSlug('prueba-plataforma'))?.ajustes.plan).toBe('PRIVADA');
    // Suspender lo saca de los activos y reactivar lo devuelve.
    await db.cambiarEstadoNegocio(negocio.id, false);
    expect((await db.negocioPorSlug('prueba-plataforma'))?.activo).toBe(false);
    await db.cambiarEstadoNegocio(negocio.id, true);
    expect((await db.negocioPorSlug('prueba-plataforma'))?.activo).toBe(true);
  });
  it('un club en prueba opera, vencido se pausa y con el pago vuelve', async () => {
    const correo = `alta-${randomBytes(4).toString('hex')}@ejemplo.mx`;
    const whatsapp = `52228${Math.floor(1000000 + Math.random() * 8999999)}`;
    const club = await negocioDePrueba({
      slug: 'prueba-asistente',
      nombre: 'Club de prueba',
      prefijoCodigo: 'CP',
      ajustes: {
        pruebaVence: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        alta: { giro: 'barberia', correo, whatsapp, origen: 'belleza', legal: '' },
      },
      sucursales: [{ slug: 'principal', nombre: 'Principal', participa: true }],
    });
    try {
      expect(db.estadoComercialDe(club)).toBe('PRUEBA');
      expect(await db.contactoConClub(correo, '520000000000')).toBe(true);
      expect(await db.contactoConClub('otro@ejemplo.mx', whatsapp)).toBe(true);
      expect(await db.contactoConClub('otro@ejemplo.mx', '520000000000')).toBe(false);
      // La dirección ocupada no se repite: se propone la siguiente.
      expect(await db.direccionLibre('prueba-asistente')).toBe('prueba-asistente-2');

      const alta = (contacto: string, negocio: db.Negocio) =>
        en(negocio, () =>
          db.crearTarjeta({ contacto, aceptaTerminos: true, aceptaPromociones: false }),
        );
      expect((await alta('2281112233', club)).ok).toBe(true);

      // Prueba vencida: no se crean tarjetas.
      await db.fijarFinDePrueba(club.id, new Date(Date.now() - 1000).toISOString());
      const pausado = (await db.negocioPorSlug('prueba-asistente'))!;
      expect(db.estadoComercialDe(pausado)).toBe('PAUSADO');
      expect((await alta('2281112244', pausado)).ok).toBe(false);
      // El alta del dueño se conserva al cambiar la fecha.
      expect(pausado.ajustes.alta?.correo).toBe(correo);

      // Los clubes del asistente no piden ticket en caja.
      expect(pausado.ajustes.comprobanteConQr).toBe('NO_PEDIR');

      // Pago de un mes: activo hasta el fin del periodo.
      const hasta = await db.registrarPago(pausado, 'MES');
      const activo = (await db.negocioPorSlug('prueba-asistente'))!;
      expect(activo.ajustes.pagadoHasta).toBe(hasta);
      expect(db.estadoComercialDe(activo)).toBe('ACTIVO');
      expect((await alta('2281112244', activo)).ok).toBe(true);
      expect((await db.clubesEnPausa()).some((c) => c.negocio.id === club.id)).toBe(false);

      // 31 días después de que venza el pago: en pausa y listo para borrar.
      const despues = new Date(Date.parse(hasta) + 31 * 24 * 60 * 60 * 1000);
      expect((await db.clubesEnPausa(despues)).find((c) => c.negocio.id === club.id)?.listo).toBe(
        true,
      );

      // Con el borrado automático apagado no se borra nada.
      await db.fijarBorradoAutomatico(false, 'pruebas');
      expect(await db.borradoAutomaticoEncendido()).toBe(false);
      expect(await db.borrarClubesVencidos(despues)).toEqual({ encendido: false, borrados: [] });
      expect(await db.negocioPorSlug('prueba-asistente')).not.toBeNull();
    } finally {
      await db.borrarNegocio(club.id);
    }
  });
});
