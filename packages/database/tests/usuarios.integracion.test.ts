import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Solo el tipo: el módulo real se carga dentro de la prueba, después de saber
// que hay una base de pruebas, porque al importarse crea la conexión.
import type * as ModuloBd from '../src/index';
import { negocioDePrueba } from './ayuda';

/**
 * Usuarios del panel contra una base real: alta, enlaces de contraseña,
 * recuperación y los frenos que impiden dejar el panel sin administración.
 *
 * Igual que la prueba de lealtad, solo corre con `WL_PRUEBAS_BD=1` y se
 * niega a correr contra cualquier dirección de Neon.
 */

const URL = process.env.DATABASE_URL ?? '';
const ACTIVA = process.env.WL_PRUEBAS_BD === '1' && URL !== '' && !URL.includes('neon.tech');

type Db = typeof ModuloBd;

describe.skipIf(!ACTIVA)('usuarios del panel contra la base', () => {
  let db: Db;
  let negocio: ModuloBd.Negocio;
  const sufijo = Math.random().toString(36).slice(2, 8);
  const correo = (n: string) => `${n}-${sufijo}@prueba.mx`;
  const ids = { admin: '', sucursal: '' };
  const creados: string[] = [];
  const CLAVE = 'una frase de prueba larga';

  beforeAll(async () => {
    db = await import('../src/index');
    negocio = await negocioDePrueba({ slug: 'prueba-usuarios', nombre: 'Café El Buentueste' });
    // Todo lo de este archivo corre dentro de ese negocio.
    db.fijarResolutorDeNegocio(() => negocio);
    ids.sucursal = (
      await db.prisma.branch.create({
        data: {
          slug: `prueba-usuarios-${sufijo}`,
          name: `Prueba usuarios ${sufijo}`,
          addressLine: 'Calle 1',
          neighborhood: 'Centro',
          postalCode: '91000',
        },
      })
    ).id;
    ids.admin = (
      await db.prisma.userAccount.create({
        data: {
          email: correo('admin'),
          name: 'Admin de prueba',
          role: 'ADMIN',
          passwordHash: await db.hashContrasena(CLAVE),
        },
      })
    ).id;
    creados.push(ids.admin);
  });

  afterAll(async () => {
    if (!db) return;
    db.fijarResolutorDeNegocio(() => null);
    // Borrar el negocio se lleva todo lo que estas pruebas crearon.
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  const actor = () => ({ userId: ids.admin, ip: '127.0.0.1' });

  async function alta(nombre: string, rol = 'GERENTE', sucursalId: string | null = null) {
    const r = await db.crearUsuario(
      { email: correo(nombre), nombre: `Persona ${nombre}`, rol, sucursalId },
      actor(),
    );
    if (!r.ok) throw new Error(r.error);
    creados.push(r.id);
    return r.id;
  }

  it('valida el alta: sucursal obligatoria para Sucursal y correo único', async () => {
    const sinSucursal = await db.crearUsuario(
      { email: correo('caja'), nombre: 'Caja', rol: 'SUCURSAL' },
      actor(),
    );
    expect(sinSucursal).toEqual({ ok: false, error: 'El rol Sucursal necesita una sucursal.' });

    const id = await alta('caja', 'SUCURSAL', ids.sucursal);
    const u = await db.leerUsuario(id);
    expect(u).toMatchObject({ rol: 'SUCURSAL', tieneContrasena: false, activo: true });
    expect(u?.sucursal?.id).toBe(ids.sucursal);

    const repetido = await db.crearUsuario(
      { email: correo('caja').toUpperCase(), nombre: 'Otra', rol: 'GERENTE' },
      actor(),
    );
    expect(repetido.ok).toBe(false);

    // Un rol global no guarda sucursal aunque llegue una.
    const lector = await alta('lector', 'GERENTE', ids.sucursal);
    expect((await db.leerUsuario(lector))?.sucursal).toBeNull();
  });

  it('el enlace por correo fija la contraseña, confirma el correo y sirve una sola vez', async () => {
    const id = await alta('gabriela');
    const e = await db.emitirEnlaceContrasena(id, { porCorreo: true }, actor());
    if (!e.ok) throw new Error(e.error);
    expect(e.primeraVez).toBe(true);

    expect((await db.leerUsuario(id))?.enlaceVigenteHasta).not.toBeNull();
    const consulta = await db.consultarEnlace(e.token);
    expect(consulta).toMatchObject({ ok: true, email: correo('gabriela'), primeraVez: true });

    expect((await db.definirContrasenaConEnlace(e.token, 'corta')).ok).toBe(false);
    const r = await db.definirContrasenaConEnlace(e.token, CLAVE);
    expect(r).toEqual({ ok: true, email: correo('gabriela') });

    const u = await db.leerUsuario(id);
    expect(u).toMatchObject({
      tieneContrasena: true,
      correoVerificado: true,
      enlaceVigenteHasta: null,
    });
    expect((await db.iniciarSesion(correo('gabriela'), CLAVE)).ok).toBe(true);

    // Gastado: ni se puede ver ni se puede volver a usar.
    expect((await db.consultarEnlace(e.token)).ok).toBe(false);
    expect((await db.definirContrasenaConEnlace(e.token, 'otra frase larga más')).ok).toBe(false);
  });

  it('un enlace mostrado en pantalla no confirma el correo; uno nuevo anula el anterior', async () => {
    const id = await alta('caja-montemagno');
    const primero = await db.emitirEnlaceContrasena(id, { porCorreo: false }, actor());
    const segundo = await db.emitirEnlaceContrasena(id, { porCorreo: false }, actor());
    if (!primero.ok || !segundo.ok) throw new Error('no se emitió');

    expect((await db.consultarEnlace(primero.token)).ok).toBe(false);
    expect((await db.definirContrasenaConEnlace(segundo.token, CLAVE)).ok).toBe(true);
    expect((await db.leerUsuario(id))?.correoVerificado).toBe(false);

    // Sin correo confirmado no hay recuperación por correo.
    const rec = await db.solicitarRecuperacion(correo('caja-montemagno'));
    expect(rec.token).toBeNull();
    expect(rec.email).toBe(correo('caja-montemagno'));
  });

  it('la recuperación solo sirve con correo confirmado, cierra sesiones y desbloquea', async () => {
    const id = await alta('jano');
    const e = await db.emitirEnlaceContrasena(id, { porCorreo: true }, actor());
    if (!e.ok) throw new Error(e.error);
    await db.definirContrasenaConEnlace(e.token, CLAVE);
    const sesion = await db.iniciarSesion(correo('jano'), CLAVE);
    if (!sesion.ok) throw new Error(sesion.motivo);

    // Se le olvida y se bloquea a fuerza de intentos.
    for (let i = 0; i < 8; i++) await db.iniciarSesion(correo('jano'), 'no es esta contraseña');
    const bloqueado = await db.iniciarSesion(correo('jano'), CLAVE);
    expect(bloqueado.ok).toBe(false);

    const rec = await db.solicitarRecuperacion(`  ${correo('jano').toUpperCase()} `);
    expect(rec.token).not.toBeNull();
    const nueva = 'mi frase nueva de recuperación';
    expect((await db.definirContrasenaConEnlace(rec.token!, nueva)).ok).toBe(true);

    // La sesión anterior ya no sirve, y los fallos de antes del cambio no bloquean.
    expect(await db.leerSesion(sesion.token)).toBeNull();
    expect((await db.iniciarSesion(correo('jano'), CLAVE)).ok).toBe(false);
    expect((await db.iniciarSesion(correo('jano'), nueva)).ok).toBe(true);

    // Correo desconocido: misma forma de respuesta, sin token.
    expect(await db.solicitarRecuperacion(correo('nadie'))).toEqual({
      token: null,
      email: correo('nadie'),
      nombre: null,
    });
  });

  it('cambiar el correo apaga la recuperación y anula los enlaces pendientes', async () => {
    const id = await alta('marketing', 'GERENTE');
    const e = await db.emitirEnlaceContrasena(id, { porCorreo: true }, actor());
    if (!e.ok) throw new Error(e.error);
    await db.definirContrasenaConEnlace(e.token, CLAVE);
    expect((await db.leerUsuario(id))?.correoVerificado).toBe(true);

    const pendiente = await db.emitirEnlaceContrasena(id, { porCorreo: true }, actor());
    if (!pendiente.ok) throw new Error(pendiente.error);

    const r = await db.actualizarUsuario(
      id,
      { email: correo('marketing-2'), nombre: 'Persona marketing', rol: 'GERENTE', activo: true },
      actor(),
    );
    expect(r).toEqual({ ok: true, cambios: 1 });
    expect((await db.leerUsuario(id))?.correoVerificado).toBe(false);
    expect((await db.consultarEnlace(pendiente.token)).ok).toBe(false);
  });

  it('nadie se quita su propio rol, y siempre queda una cuenta de administración', async () => {
    const yo = { email: correo('admin'), nombre: 'Admin de prueba', activo: true };
    const propio = await db.actualizarUsuario(ids.admin, { ...yo, rol: 'GERENTE' }, actor());
    expect(propio.ok).toBe(false);
    const desactivarme = await db.actualizarUsuario(
      ids.admin,
      { ...yo, rol: 'ADMIN', activo: false },
      actor(),
    );
    expect(desactivarme.ok).toBe(false);

    // Otra cuenta de administración intenta degradar a la única que queda.
    const otro = await alta('admin-2', 'ADMIN');
    const quitarSolo = async () => {
      // Se apagan todas las demás cuentas de administración de la base de
      // prueba para que esta sea la única.
      const demas = await db.prisma.userAccount.findMany({
        where: { role: 'ADMIN', isActive: true, id: { notIn: [ids.admin, otro] } },
        select: { id: true },
      });
      return demas.map((d) => d.id);
    };
    const apagadas = await quitarSolo();
    await db.prisma.userAccount.updateMany({
      where: { id: { in: apagadas } },
      data: { isActive: false },
    });
    try {
      // Con dos, se puede degradar a una.
      const r1 = await db.actualizarUsuario(
        otro,
        { email: correo('admin-2'), nombre: 'Persona admin-2', rol: 'GERENTE', activo: true },
        actor(),
      );
      expect(r1.ok).toBe(true);
      // Con una sola, ni degradarla ni apagarla desde otra cuenta.
      const r2 = await db.actualizarUsuario(
        ids.admin,
        { ...yo, rol: 'GERENTE' },
        { userId: otro, ip: null },
      );
      expect(r2).toEqual({
        ok: false,
        error:
          'Debe quedar al menos una cuenta activa que administre usuarios (Administración o Dueño).',
      });
    } finally {
      await db.prisma.userAccount.updateMany({
        where: { id: { in: apagadas } },
        data: { isActive: true },
      });
    }
  });

  it('desactivar cierra las sesiones y anula los enlaces', async () => {
    const id = await alta('temporal');
    const e = await db.emitirEnlaceContrasena(id, { porCorreo: false }, actor());
    if (!e.ok) throw new Error(e.error);
    await db.definirContrasenaConEnlace(e.token, CLAVE);
    const s = await db.iniciarSesion(correo('temporal'), CLAVE);
    if (!s.ok) throw new Error(s.motivo);
    const pendiente = await db.emitirEnlaceContrasena(id, { porCorreo: false }, actor());
    if (!pendiente.ok) throw new Error(pendiente.error);

    const r = await db.actualizarUsuario(
      id,
      { email: correo('temporal'), nombre: 'Persona temporal', rol: 'GERENTE', activo: false },
      actor(),
    );
    expect(r.ok).toBe(true);
    expect(await db.leerSesion(s.token)).toBeNull();
    expect((await db.consultarEnlace(pendiente.token)).ok).toBe(false);
    expect((await db.emitirEnlaceContrasena(id, { porCorreo: true }, actor())).ok).toBe(false);
  });

  it('cambiar la contraseña propia pide la actual y deja abierta solo esta sesión', async () => {
    const id = await alta('cuenta');
    const e = await db.emitirEnlaceContrasena(id, { porCorreo: false }, actor());
    if (!e.ok) throw new Error(e.error);
    await db.definirContrasenaConEnlace(e.token, CLAVE);
    const aqui = await db.iniciarSesion(correo('cuenta'), CLAVE);
    const alla = await db.iniciarSesion(correo('cuenta'), CLAVE);
    if (!aqui.ok || !alla.ok) throw new Error('no entró');

    const mal = await db.cambiarContrasenaPropia(
      id,
      'no es la actual',
      'frase nueva muy larga',
      aqui.token,
    );
    expect(mal.ok).toBe(false);

    const bien = await db.cambiarContrasenaPropia(id, CLAVE, 'frase nueva muy larga', aqui.token);
    expect(bien).toEqual({ ok: true, sesionesCerradas: 1 });
    expect(await db.leerSesion(aqui.token)).not.toBeNull();
    expect(await db.leerSesion(alla.token)).toBeNull();
  });
});
