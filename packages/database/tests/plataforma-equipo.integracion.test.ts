import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, comoDuenio, en, negocioDePrueba } from './ayuda';

const sufijo = randomBytes(4).toString('hex');
const correo = (nombre: string) => `${nombre}-${sufijo}@ejemplo.mx`;
const clave = () => `${randomBytes(9).toString('base64url')} frase larga`;

describe.skipIf(!CON_BD)('equipo de plataforma', () => {
  const jano = { email: correo('jano'), clave: clave() };
  let janoId = '';
  let negocio: db.Negocio;

  beforeAll(async () => {
    await db.crearUsuarioPlataforma({ email: jano.email, nombre: 'Jano', clave: jano.clave });
    const [fila] = await comoDuenio<{ id: string }>(
      'SELECT id FROM platform_user WHERE email = $1',
      [jano.email],
    );
    janoId = fila!.id;
    negocio = await negocioDePrueba({
      slug: 'prueba-equipo',
      nombre: 'Equipo',
      prefijoCodigo: 'EQ',
    });
  });

  afterAll(async () => {
    await comoDuenio('DELETE FROM platform_user WHERE email LIKE $1', [`%-${sufijo}@ejemplo.mx`]);
    await comoDuenio('DELETE FROM platform_audit WHERE actor_email LIKE $1', [
      `%-${sufijo}@ejemplo.mx`,
    ]);
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('invita sin contraseña: no entra hasta usar el enlace, que sirve una sola vez', async () => {
    const email = correo('beto');
    const r = await db.invitarCuentaPlataforma({ email, nombre: 'Beto' }, jano.email);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Sin contraseña no entra con nada, y responde igual que una cuenta que no existe.
    expect(await db.entrarPlataforma(email, 'lo que sea, largo')).toEqual(
      await db.entrarPlataforma('nadie@ejemplo.mx', 'lo que sea, largo'),
    );
    expect(await db.consultarEnlacePlataforma(r.token)).toEqual({
      ok: true,
      email,
      nombre: 'Beto',
      primeraVez: true,
    });
    expect((await db.definirContrasenaPlataforma(r.token, 'corta')).ok).toBe(false);
    const nueva = clave();
    expect((await db.definirContrasenaPlataforma(r.token, nueva)).ok).toBe(true);
    expect((await db.definirContrasenaPlataforma(r.token, clave())).ok).toBe(false);
    expect(await db.consultarEnlacePlataforma(r.token)).toEqual({ ok: false });
    expect((await db.entrarPlataforma(email, nueva)).ok).toBe(true);
    // Repetir la invitación con el mismo correo no pisa la cuenta.
    expect((await db.invitarCuentaPlataforma({ email, nombre: 'Otro' }, jano.email)).ok).toBe(
      false,
    );
    const cuentas = await db.listarCuentasPlataforma();
    expect(cuentas.find((c) => c.email === email)).toMatchObject({
      conContrasena: true,
      activa: true,
      invitadaPor: jano.email,
    });
  });

  it('un enlace nuevo anula el anterior y cerrar con él quita sesiones y bloqueo', async () => {
    const email = correo('ana');
    const inv = await db.invitarCuentaPlataforma({ email, nombre: 'Ana' }, jano.email);
    if (!inv.ok) throw new Error(inv.error);
    const primera = clave();
    await db.definirContrasenaPlataforma(inv.token, primera);
    const sesion = await db.entrarPlataforma(email, primera);
    if (!sesion.ok) throw new Error('no entró');
    const [fila] = await comoDuenio<{ id: string }>(
      'SELECT id FROM platform_user WHERE email = $1',
      [email],
    );
    const id = fila!.id;
    const uno = await db.enlaceParaCuentaPlataforma(id, jano.email);
    const dos = await db.enlaceParaCuentaPlataforma(id, jano.email);
    if (!uno.ok || !dos.ok) throw new Error('sin enlace');
    expect((await db.consultarEnlacePlataforma(uno.token)).ok).toBe(false);
    expect(await db.consultarEnlacePlataforma(dos.token)).toMatchObject({ primeraVez: false });
    for (let i = 0; i < 5; i += 1) await db.entrarPlataforma(email, 'equivocada pero larga');
    expect((await db.entrarPlataforma(email, primera)).ok).toBe(false);
    const otra = clave();
    expect((await db.definirContrasenaPlataforma(dos.token, otra)).ok).toBe(true);
    expect(await db.leerSesionPlataforma(sesion.token)).toBeNull();
    expect((await db.entrarPlataforma(email, otra)).ok).toBe(true);
  });

  it('recuperación por correo: solo cuentas activas con contraseña, tres por hora', async () => {
    expect(await db.solicitarRecuperacionPlataforma('nadie@ejemplo.mx')).toBeNull();
    const pendiente = correo('pendiente');
    await db.invitarCuentaPlataforma({ email: pendiente, nombre: 'Pendiente' }, jano.email);
    expect(await db.solicitarRecuperacionPlataforma(pendiente)).toBeNull();

    const r = await db.solicitarRecuperacionPlataforma(jano.email.toUpperCase());
    expect(r).toMatchObject({ email: jano.email, nombre: 'Jano' });
    expect(await db.consultarEnlacePlataforma(r!.token)).toMatchObject({ ok: true });
    expect(await db.solicitarRecuperacionPlataforma(jano.email)).not.toBeNull();
    expect(await db.solicitarRecuperacionPlataforma(jano.email)).not.toBeNull();
    expect(await db.solicitarRecuperacionPlataforma(jano.email)).toBeNull();
    // La contraseña de siempre sigue sirviendo mientras no use el enlace.
    expect((await db.entrarPlataforma(jano.email, jano.clave)).ok).toBe(true);
  });

  it('baja: nunca a sí mismo ni a la última cuenta; cierra sesiones y anula enlaces', async () => {
    const yo = await db.cambiarEstadoCuentaPlataforma(janoId, false, janoId);
    expect(yo).toMatchObject({ ok: false });

    const email = correo('baja');
    const inv = await db.invitarCuentaPlataforma({ email, nombre: 'Baja' }, jano.email);
    if (!inv.ok) throw new Error(inv.error);
    const c = clave();
    await db.definirContrasenaPlataforma(inv.token, c);
    const s = await db.entrarPlataforma(email, c);
    if (!s.ok) throw new Error('no entró');
    const [fila] = await comoDuenio<{ id: string }>(
      'SELECT id FROM platform_user WHERE email = $1',
      [email],
    );
    const id = fila!.id;
    const enlace = await db.enlaceParaCuentaPlataforma(id, jano.email);
    if (!enlace.ok) throw new Error('sin enlace');
    expect((await db.cambiarEstadoCuentaPlataforma(id, false, janoId)).ok).toBe(true);
    expect(await db.leerSesionPlataforma(s.token)).toBeNull();
    expect((await db.consultarEnlacePlataforma(enlace.token)).ok).toBe(false);
    expect((await db.entrarPlataforma(email, c)).ok).toBe(false);
    expect((await db.enlaceParaCuentaPlataforma(id, jano.email)).ok).toBe(false);
    expect((await db.cambiarEstadoCuentaPlataforma(id, true, janoId)).ok).toBe(true);
    expect((await db.entrarPlataforma(email, c)).ok).toBe(true);
  });

  it('cambiar la contraseña propia pide la actual y deja abierta solo esta sesión', async () => {
    const a = await db.entrarPlataforma(jano.email, jano.clave);
    const b = await db.entrarPlataforma(jano.email, jano.clave);
    if (!a.ok || !b.ok) throw new Error('no entró');
    const nueva = clave();
    expect(
      (await db.cambiarContrasenaPlataforma(janoId, 'equivocada larga', nueva, a.token)).ok,
    ).toBe(false);
    expect((await db.cambiarContrasenaPlataforma(janoId, jano.clave, nueva, a.token)).ok).toBe(
      true,
    );
    expect(await db.leerSesionPlataforma(a.token)).not.toBeNull();
    expect(await db.leerSesionPlataforma(b.token)).toBeNull();
    expect((await db.entrarPlataforma(jano.email, nueva)).ok).toBe(true);
    jano.clave = nueva;
  });

  it('la bitácora anota, filtra por club y la aplicación no la puede leer', async () => {
    await db.anotarPlataforma({
      actor: jano.email,
      accion: 'club.pago',
      club: { id: negocio.id, slug: negocio.slug },
      detalle: { periodo: 'MES' },
      ip: '203.0.113.7',
    });
    await db.anotarPlataforma({ actor: jano.email, accion: 'equipo.invitar' });
    const delClub = await db.listarBitacoraPlataforma({ clubId: negocio.id });
    expect(delClub).toHaveLength(1);
    expect(delClub[0]).toMatchObject({
      actor: jano.email,
      accion: 'club.pago',
      clubSlug: 'prueba-equipo',
      detalle: { periodo: 'MES' },
    });
    expect(
      (await db.listarBitacoraPlataforma({ actor: jano.email, accion: 'equipo.' })).length,
    ).toBeGreaterThan(0);
    expect(await db.actoresDeBitacoraPlataforma()).toContain(jano.email);
    await expect(
      en(negocio, () => db.transaccion((tx) => tx.$queryRaw`SELECT 1 FROM platform_audit`)),
    ).rejects.toThrow();
    await expect(
      en(negocio, () =>
        db.transaccion((tx) => tx.$queryRaw`SELECT 1 FROM platform_password_token`),
      ),
    ).rejects.toThrow();
  });
});
