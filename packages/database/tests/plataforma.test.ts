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
});
