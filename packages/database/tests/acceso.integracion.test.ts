import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ERROR_ACCESO_GENERICO, fechaLocal, formarCodigoTarjeta } from '@wl/domain';
// Solo el tipo: el módulo real se carga dentro de la prueba, después de saber
// que hay una base de pruebas, porque al importarse crea la conexión.
import type * as ModuloBd from '../src/index';
import { negocioDePrueba } from './ayuda';

/**
 * Acceso a la tarjeta con «correo o celular + contraseña» contra una base real.
 *
 * **Solo corre si `WL_PRUEBAS_BD=1`** y nunca contra Neon (ver
 * lealtad.integracion.test.ts). Cubre lo que el dominio no puede: el bloqueo
 * guardado en la base, los datos repetidos, la solicitud única por tarjeta y
 * la verificación del celular al abrir un enlace mandado por WhatsApp.
 * Flujo en docs/22-lealtad-acceso-con-contrasena.md.
 */

const URL = process.env.DATABASE_URL ?? '';
const ACTIVA = process.env.WL_PRUEBAS_BD === '1' && URL !== '' && !URL.includes('neon.tech');

type Db = typeof ModuloBd;

describe.skipIf(!ACTIVA)('acceso con contraseña contra la base', () => {
  let db: Db;
  let negocio: ModuloBd.Negocio;
  const sufijo = Math.random().toString(36).slice(2, 8);
  const inicio = new Date();
  const ids = { sucursal: '', otraSucursal: '', caja: '', cajaOtra: '', admin: '' };
  const tarjetas: string[] = [];
  let consecutivo = 0;

  const CLAVE = 'conchas con nata';

  /** Celular único por prueba: 228 + 7 dígitos. */
  function celularNuevo(): string {
    consecutivo += 1;
    const base = (parseInt(sufijo, 36) % 10000).toString().padStart(4, '0');
    return `228${base}${String(consecutivo).padStart(3, '0')}`;
  }

  /** IP única por prueba, para que los bloqueos no se crucen. */
  function ipNueva(): string {
    consecutivo += 1;
    return `10.${consecutivo % 250}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  }

  async function tarjeta(d: {
    celular?: string;
    correo?: string;
    clave?: string;
    sucursalId?: string;
  }): Promise<{ id: string; codigo: string; token: string }> {
    const r = await db.crearTarjeta({
      contacto: d.correo ?? d.celular!,
      aceptaTerminos: true,
      aceptaPromociones: false,
    });
    if (!r.ok) throw new Error(r.error);
    const id = (await db.leerSesionTarjeta(r.token))!;
    tarjetas.push(id);
    if (d.correo && d.celular) await db.cambiarCelular(id, d.celular);
    if (d.sucursalId) {
      await db.prisma.loyaltyCard.update({
        where: { id },
        data: { enrolledBranchId: d.sucursalId },
      });
    }
    if (d.clave) {
      const c = await db.crearContrasenaTarjeta(id, d.clave);
      if (!c.ok) throw new Error(c.error);
    }
    return { id, codigo: r.codigo, token: r.token };
  }

  const alcanceDe = (id: string, branchId: string | null, todas = false) => ({
    userId: id,
    branchId,
    todas,
  });

  beforeAll(async () => {
    db = await import('../src/index');
    negocio = await negocioDePrueba({ slug: 'prueba-acceso', nombre: 'Café El Buentueste' });
    // Todo lo de este archivo corre dentro de ese negocio.
    db.fijarResolutorDeNegocio(() => negocio);
    const base = { addressLine: 'Calle de prueba 1', neighborhood: 'Centro', postalCode: '91000' };
    ids.sucursal = (
      await db.prisma.branch.create({
        data: { ...base, slug: `acc-${sufijo}`, name: `Acceso ${sufijo}`, loyaltyEnabled: true },
      })
    ).id;
    ids.otraSucursal = (
      await db.prisma.branch.create({
        data: {
          ...base,
          slug: `acc-b-${sufijo}`,
          name: `Acceso B ${sufijo}`,
          loyaltyEnabled: true,
        },
      })
    ).id;
    const usuario = (email: string, role: 'SUCURSAL' | 'ADMIN', branchId: string | null) =>
      db.prisma.userAccount.create({
        data: { email, name: email, role, branchId },
        select: { id: true },
      });
    ids.caja = (await usuario(`caja-acc-${sufijo}@prueba.mx`, 'SUCURSAL', ids.sucursal)).id;
    ids.cajaOtra = (
      await usuario(`caja-accb-${sufijo}@prueba.mx`, 'SUCURSAL', ids.otraSucursal)
    ).id;
    ids.admin = (await usuario(`admin-acc-${sufijo}@prueba.mx`, 'ADMIN', null)).id;
  });

  afterAll(async () => {
    if (!db) return;
    db.fijarResolutorDeNegocio(() => null);
    // Borrar el negocio se lleva todo lo que estas pruebas crearon.
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('entra con el correo o con el celular, con una sola contraseña', async () => {
    const celular = celularNuevo();
    const t = await tarjeta({ correo: `ana-${sufijo}@correo.mx`, celular, clave: CLAVE });
    const ip = ipNueva();

    const porCorreo = await db.entrarConContrasena(` ANA-${sufijo}@Correo.MX `, CLAVE, { ip });
    expect(porCorreo.ok).toBe(true);
    if (porCorreo.ok) expect(await db.leerSesionTarjeta(porCorreo.token)).toBe(t.id);

    const conFormato = `+52 ${celular.slice(0, 3)}-${celular.slice(3, 6)} ${celular.slice(6)}`;
    const porCelular = await db.entrarConContrasena(conFormato, CLAVE, { ip });
    expect(porCelular.ok).toBe(true);
    if (porCelular.ok) expect(await db.leerSesionTarjeta(porCelular.token)).toBe(t.id);
  });

  it('responde siempre el mismo error genérico', async () => {
    const t = await tarjeta({ correo: `beto-${sufijo}@correo.mx`, clave: CLAVE });
    const sinClave = await tarjeta({ correo: `carla-${sufijo}@correo.mx` });
    const ip = ipNueva();
    const generico = { ok: false, error: ERROR_ACCESO_GENERICO };

    expect(await db.entrarConContrasena(`beto-${sufijo}@correo.mx`, 'otra cosa', { ip })).toEqual(
      generico,
    );
    expect(await db.entrarConContrasena(`nadie-${sufijo}@correo.mx`, CLAVE, { ip })).toEqual(
      generico,
    );
    // Tarjeta que aún no crea contraseña.
    expect(await db.entrarConContrasena(`carla-${sufijo}@correo.mx`, CLAVE, { ip })).toEqual(
      generico,
    );
    expect(await db.entrarConContrasena('no es nada', CLAVE, { ip })).toEqual(generico);
    expect(await db.entrarConContrasena(`beto-${sufijo}@correo.mx`, '', { ip })).toEqual(generico);

    // Una tarjeta desactivada tampoco entra.
    await db.prisma.loyaltyCard.update({ where: { id: t.id }, data: { isActive: false } });
    expect(await db.entrarConContrasena(`beto-${sufijo}@correo.mx`, CLAVE, { ip })).toEqual(
      generico,
    );
    expect(sinClave.id).toBeTruthy();
  });

  it('bloquea 15 minutos tras 5 fallos, por tarjeta y por IP', async () => {
    await tarjeta({ correo: `dani-${sufijo}@correo.mx`, clave: CLAVE });
    const correo = `dani-${sufijo}@correo.mx`;

    // Por tarjeta: cinco fallos desde IPs distintas.
    for (let i = 0; i < 5; i++) {
      expect((await db.entrarConContrasena(correo, `mala ${i} clave`, { ip: ipNueva() })).ok).toBe(
        false,
      );
    }
    const bloqueada = await db.entrarConContrasena(correo, CLAVE, { ip: ipNueva() });
    expect(bloqueada).toMatchObject({ ok: false, bloqueado: true });

    // Pasados los 15 minutos (se envejecen los intentos) vuelve a entrar.
    await db.prisma.loyaltyLoginAttempt.updateMany({
      where: { card: { email: correo } },
      data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
    });
    expect((await db.entrarConContrasena(correo, CLAVE, { ip: ipNueva() })).ok).toBe(true);

    // Por IP: cinco fallos con datos distintos desde la misma IP.
    const ip = ipNueva();
    for (let i = 0; i < 5; i++) {
      await db.entrarConContrasena(`nadie-${i}-${sufijo}@correo.mx`, CLAVE, { ip });
    }
    expect(await db.entrarConContrasena(correo, CLAVE, { ip })).toMatchObject({
      ok: false,
      bloqueado: true,
    });

    // Un dato que no es de nadie también se bloquea: el aviso no delata quién existe.
    const fantasma = `fantasma-${sufijo}@correo.mx`;
    for (let i = 0; i < 5; i++) await db.entrarConContrasena(fantasma, CLAVE, { ip: ipNueva() });
    expect(await db.entrarConContrasena(fantasma, CLAVE, { ip: ipNueva() })).toMatchObject({
      bloqueado: true,
    });
  });

  it('no deja entrar con un dato que está en más de una tarjeta y lo registra', async () => {
    const celular = celularNuevo();
    const a = await tarjeta({ celular, clave: CLAVE });
    // Un registro viejo con el mismo celular escrito distinto (el índice único
    // compara el texto, no el número).
    const b = await db.prisma.loyaltyCard.create({
      data: {
        publicCode: formarCodigoTarjeta(randomBytes(8)),
        phone: `+52 ${celular}`,
        termsVersion: 'prueba',
        termsAcceptedAt: new Date(),
      },
      select: { id: true },
    });
    tarjetas.push(b.id);

    expect(await db.entrarConContrasena(celular, CLAVE, { ip: ipNueva() })).toEqual({
      ok: false,
      error: ERROR_ACCESO_GENERICO,
    });
    const bitacora = await db.prisma.auditLog.findFirst({
      where: { action: 'lealtad.acceso_contacto_repetido', createdAt: { gte: inicio } },
      orderBy: { createdAt: 'desc' },
    });
    expect(bitacora?.metadata).toMatchObject({ donde: 'entrar', tipo: 'CELULAR' });

    // «Olvidé mi contraseña» con ese dato tampoco hace nada.
    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'NADA' });

    // Desactivada la repetida, vuelve a funcionar.
    await db.prisma.loyaltyCard.update({ where: { id: b.id }, data: { isActive: false } });
    expect((await db.entrarConContrasena(celular, CLAVE, { ip: ipNueva() })).ok).toBe(true);
    expect(a.id).toBeTruthy();
  });

  it('olvidé: con correo manda enlace que obliga a una contraseña nueva y cierra sesiones', async () => {
    const t = await tarjeta({
      correo: `eva-${sufijo}@correo.mx`,
      celular: celularNuevo(),
      clave: CLAVE,
    });
    const tarjetaDb = await db.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: t.id } });

    // Escribe su celular: el enlace va igual a su correo.
    const r = await db.olvideContrasena(tarjetaDb.phone!, { ip: ipNueva() });
    expect(r).toMatchObject({ tipo: 'CORREO', correo: `eva-${sufijo}@correo.mx` });
    if (r.tipo !== 'CORREO') throw new Error('se esperaba correo');

    expect(await db.consultarEnlaceAcceso(r.token)).toMatchObject({
      valido: true,
      contrasena: 'OBLIGATORIA',
    });
    // Sin contraseña nueva no abre, aunque la tarjeta ya tenga una.
    expect(await db.canjearEnlaceAcceso(r.token, 'prueba')).toMatchObject({
      ok: false,
      contrasena: true,
    });
    // Una contraseña que no cumple la política no gasta el enlace.
    expect(
      await db.canjearEnlaceAcceso(r.token, 'prueba', { clave: 'buentueste2026' }),
    ).toMatchObject({
      ok: false,
      contrasena: true,
    });
    const nueva = 'cafe recien molido';
    const canje = await db.canjearEnlaceAcceso(r.token, 'prueba', { clave: nueva });
    expect(canje.ok).toBe(true);

    // La sesión del alta se cerró; la del enlace sigue.
    expect(await db.leerSesionTarjeta(t.token)).toBeNull();
    if (canje.ok) expect(await db.leerSesionTarjeta(canje.token)).toBe(t.id);

    expect((await db.entrarConContrasena(`eva-${sufijo}@correo.mx`, CLAVE)).ok).toBe(false);
    expect((await db.entrarConContrasena(`eva-${sufijo}@correo.mx`, nueva)).ok).toBe(true);
  });

  it('olvidé: solo celular deja una solicitud abierta por tarjeta para su sucursal', async () => {
    const celular = celularNuevo();
    const t = await tarjeta({ celular, sucursalId: ids.sucursal });

    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'SOLICITUD' });
    // La segunda no crea otra: ya hay una abierta.
    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'NADA' });
    expect(
      await db.prisma.loyaltyAccessRequest.count({ where: { cardId: t.id, status: 'ABIERTA' } }),
    ).toBe(1);

    // La caja de su sucursal la ve; la de otra sucursal no; administración sí.
    const propias = await db.listarSolicitudesAcceso({ todas: false, branchId: ids.sucursal });
    expect(propias.map((s) => s.celular)).toContain(`••••••${celular.slice(-4)}`);
    const ajenas = await db.listarSolicitudesAcceso({ todas: false, branchId: ids.otraSucursal });
    expect(ajenas.some((s) => s.celular.endsWith(celular.slice(-4)))).toBe(false);
    const todas = await db.listarSolicitudesAcceso({ todas: true, branchId: null });
    expect(todas.some((s) => s.celular.endsWith(celular.slice(-4)))).toBe(true);
    // Sin sucursal asignada, una cuenta de sucursal no ve ninguna.
    expect(await db.contarSolicitudesAcceso({ todas: false, branchId: null })).toBe(0);

    // Otra sucursal no puede atenderla ni descartarla.
    const id = propias.find((s) => s.celular.endsWith(celular.slice(-4)))!.id;
    expect(
      await db.enviarSolicitudPorWhatsApp(id, alcanceDe(ids.cajaOtra, ids.otraSucursal)),
    ).toMatchObject({ ok: false });
    expect(
      await db.descartarSolicitudAcceso(id, alcanceDe(ids.cajaOtra, ids.otraSucursal)),
    ).toMatchObject({ ok: false });

    // Descartada, ya no aparece y se puede pedir otra.
    expect(await db.descartarSolicitudAcceso(id, alcanceDe(ids.caja, ids.sucursal))).toEqual({
      ok: true,
    });
    expect(
      (await db.listarSolicitudesAcceso({ todas: false, branchId: ids.sucursal })).some(
        (s) => s.id === id,
      ),
    ).toBe(false);
    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'SOLICITUD' });
  });

  it('las solicitudes vencen a las 48 h, sin sucursal de alta usan la primera visita, y hay tope por IP', async () => {
    const celular = celularNuevo();
    const t = await tarjeta({ celular });
    // Sin sucursal de alta: toma la de su primera visita.
    await db.acreditarVisita({
      codigo: t.codigo,
      sucursalId: ids.otraSucursal,
      usuarioId: ids.cajaOtra,
      ticket: {
        folio: `F${sufijo}${consecutivo}`,
        caja: '1',
        fecha: fechaLocal(new Date()),
        totalCentavos: 10_000,
        propinaCentavos: 0,
        descuentoCentavos: 0,
        fotoUrl: null,
        origen: 'MANUAL',
      },
    });

    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'SOLICITUD' });
    const solicitud = await db.prisma.loyaltyAccessRequest.findFirstOrThrow({
      where: { cardId: t.id, status: 'ABIERTA' },
    });
    expect(solicitud.branchId).toBe(ids.otraSucursal);
    expect(solicitud.expiresAt.getTime() - solicitud.createdAt.getTime()).toBe(48 * 3600 * 1000);

    // Vencida: sale de la caja, no se puede atender y se puede pedir otra.
    await db.prisma.loyaltyAccessRequest.update({
      where: { id: solicitud.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await db.listarSolicitudesAcceso({ todas: true, branchId: null })).some(
        (s) => s.id === solicitud.id,
      ),
    ).toBe(false);
    expect(
      await db.enviarSolicitudPorWhatsApp(solicitud.id, alcanceDe(ids.admin, null, true)),
    ).toMatchObject({ ok: false });
    expect(await db.olvideContrasena(celular, { ip: ipNueva() })).toEqual({ tipo: 'SOLICITUD' });
    expect(
      (await db.prisma.loyaltyAccessRequest.findUniqueOrThrow({ where: { id: solicitud.id } }))
        .status,
    ).toBe('VENCIDA');

    // Tope por IP: a partir de la sexta en una hora, ya no se crean.
    const ip = ipNueva();
    const resultados: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c = celularNuevo();
      await tarjeta({ celular: c, sucursalId: ids.sucursal });
      resultados.push((await db.olvideContrasena(c, { ip })).tipo);
    }
    expect(resultados).toEqual([
      'SOLICITUD',
      'SOLICITUD',
      'SOLICITUD',
      'SOLICITUD',
      'SOLICITUD',
      'NADA',
    ]);
  });

  it('el enlace que la caja manda por WhatsApp verifica el celular al abrirse', async () => {
    const celular = celularNuevo();
    const t = await tarjeta({ celular, sucursalId: ids.sucursal });
    await db.olvideContrasena(celular, { ip: ipNueva() });
    const [s] = (await db.listarSolicitudesAcceso({ todas: false, branchId: ids.sucursal })).filter(
      (x) => x.celular.endsWith(celular.slice(-4)),
    );

    const envio = await db.enviarSolicitudPorWhatsApp(s!.id, alcanceDe(ids.caja, ids.sucursal));
    expect(envio).toMatchObject({ ok: true, celular });
    if (!envio.ok) throw new Error(envio.error);
    // 24 horas.
    expect(Math.round((envio.expira.getTime() - Date.now()) / 3_600_000)).toBe(24);

    // Quedó enviada, con el enlace y en bitácora; no se puede atender dos veces.
    const atendida = await db.prisma.loyaltyAccessRequest.findUniqueOrThrow({
      where: { id: s!.id },
    });
    expect(atendida).toMatchObject({ status: 'ENVIADA', resolvedById: ids.caja });
    expect(atendida.codeId).not.toBeNull();
    expect(
      await db.prisma.auditLog.count({
        where: { action: 'lealtad.solicitud_acceso_enviada', entityId: s!.id },
      }),
    ).toBe(1);
    expect(
      await db.enviarSolicitudPorWhatsApp(s!.id, alcanceDe(ids.caja, ids.sucursal)),
    ).toMatchObject({ ok: false });

    // Antes de abrirlo, el celular no está verificado y no puede canjear.
    expect((await db.obtenerTarjeta(t.id))?.celularVerificado).toBe(false);
    const canje = await db.canjearEnlaceAcceso(envio.token, 'prueba', { clave: 'cuernito dorado' });
    expect(canje.ok).toBe(true);
    const vista = await db.obtenerTarjeta(t.id);
    expect(vista).toMatchObject({
      celularVerificado: true,
      verificada: true,
      tieneContrasena: true,
    });
    expect((await db.entrarConContrasena(celular, 'cuernito dorado')).ok).toBe(true);
  });

  it('la bienvenida del alta verifica el celular solo si la caja la mandó por WhatsApp', async () => {
    const enviada = await tarjeta({ celular: celularNuevo() });
    const mostrada = await tarjeta({ celular: celularNuevo() });

    const e1 = await db.crearEnlaceAcceso(enviada.id, '', 72 * 60);
    const e2 = await db.crearEnlaceAcceso(mostrada.id, '', 72 * 60);
    expect(await db.marcarEnlaceEnviadoPorWhatsApp(e1!.token, ids.caja)).toBe(true);
    // Un token que no existe no marca nada.
    expect(await db.marcarEnlaceEnviadoPorWhatsApp('no-existe', ids.caja)).toBe(false);

    expect((await db.canjearEnlaceAcceso(e1!.token, 'x', { clave: 'telera tostada' })).ok).toBe(
      true,
    );
    expect((await db.canjearEnlaceAcceso(e2!.token, 'x', { clave: 'telera tostada' })).ok).toBe(
      true,
    );
    expect((await db.obtenerTarjeta(enviada.id))?.celularVerificado).toBe(true);
    // El que se escaneó en pantalla (QR) no demuestra nada sobre el celular.
    expect((await db.obtenerTarjeta(mostrada.id))?.celularVerificado).toBe(false);
  });

  it('con sesión: crea la primera contraseña y la cambia pidiendo la actual', async () => {
    const t = await tarjeta({ celular: celularNuevo() });
    const otra = await db.crearSesionTarjeta(t.id, 'otro celular');
    const tarjetaDb = await db.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: t.id } });

    expect((await db.obtenerTarjeta(t.id))?.tieneContrasena).toBe(false);
    // El propio celular no vale.
    expect(await db.crearContrasenaTarjeta(t.id, tarjetaDb.phone!)).toMatchObject({ ok: false });
    expect(await db.crearContrasenaTarjeta(t.id, CLAVE)).toEqual({ ok: true });
    // No se puede «crear» encima de una existente.
    expect(await db.crearContrasenaTarjeta(t.id, 'otra frase larga')).toMatchObject({ ok: false });

    expect(
      await db.cambiarContrasenaTarjeta(t.id, 'no es la actual', 'otra frase larga', {
        tokenSesion: t.token,
      }),
    ).toEqual({ ok: false, error: 'Tu contraseña actual no coincide.' });
    expect(
      await db.cambiarContrasenaTarjeta(t.id, CLAVE, 'otra frase larga', { tokenSesion: t.token }),
    ).toEqual({ ok: true });

    // Esta sesión sigue; la del otro celular se cerró.
    expect(await db.leerSesionTarjeta(t.token)).toBe(t.id);
    expect(await db.leerSesionTarjeta(otra.token)).toBeNull();
    expect((await db.entrarConContrasena(tarjetaDb.phone!, 'otra frase larga')).ok).toBe(true);
  });

  it('la caja reenvía el enlace al contacto registrado y verifica ese dato al abrirlo', async () => {
    const celular = celularNuevo();
    const correo = `reenvio-${sufijo}@prueba.mx`;
    const t = await tarjeta({ correo, celular, sucursalId: ids.sucursal });
    // Como el alta en caja: sin sesión ni contraseña, nunca abierta en un celular.
    await db.prisma.loyaltySession.deleteMany({ where: { cardId: t.id } });
    expect(await db.accesoTarjetaCaja(t.codigo)).toEqual({
      abrioTarjeta: false,
      tieneContrasena: false,
    });

    // WhatsApp: al celular registrado, 3 días, en bitácora.
    const porWhatsApp = await db.reenviarAccesoTarjeta({
      codigo: t.codigo,
      canal: 'WHATSAPP',
      usuarioId: ids.caja,
      sucursalId: ids.sucursal,
    });
    expect(porWhatsApp).toMatchObject({
      ok: true,
      canal: 'WHATSAPP',
      celular,
      correo: null,
      tieneContrasena: false,
      minutos: 72 * 60,
    });
    if (!porWhatsApp.ok) throw new Error(porWhatsApp.error);
    expect(Math.round((porWhatsApp.expira.getTime() - Date.now()) / 3_600_000)).toBe(72);
    expect(
      await db.prisma.auditLog.count({
        where: { action: 'lealtad.enlace_reenviado', entityId: t.id, userId: ids.caja },
      }),
    ).toBe(1);

    // Al abrirlo crea su contraseña y el celular queda verificado.
    expect((await db.consultarEnlaceAcceso(porWhatsApp.token)).valido).toBe(true);
    const canje = await db.canjearEnlaceAcceso(porWhatsApp.token, 'prueba', {
      clave: 'cafe recien tostado',
    });
    expect(canje.ok).toBe(true);
    expect(await db.obtenerTarjeta(t.id)).toMatchObject({
      celularVerificado: true,
      correoVerificado: false,
      tieneContrasena: true,
    });
    expect(await db.accesoTarjetaCaja(t.codigo)).toEqual({
      abrioTarjeta: true,
      tieneContrasena: true,
    });

    // Correo: al correo registrado; al abrirlo, el correo queda verificado.
    const porCorreo = await db.reenviarAccesoTarjeta({
      codigo: t.codigo,
      canal: 'CORREO',
      usuarioId: ids.caja,
      sucursalId: ids.sucursal,
    });
    expect(porCorreo).toMatchObject({ ok: true, canal: 'CORREO', correo, celular: null });
    if (!porCorreo.ok) throw new Error(porCorreo.error);
    expect((await db.canjearEnlaceAcceso(porCorreo.token, 'prueba')).ok).toBe(true);
    expect((await db.obtenerTarjeta(t.id))?.correoVerificado).toBe(true);

    // QR en pantalla: 15 minutos y no verifica nada.
    const qr = await db.reenviarAccesoTarjeta({
      codigo: t.codigo,
      canal: 'PANTALLA',
      usuarioId: ids.caja,
      sucursalId: ids.sucursal,
    });
    expect(qr).toMatchObject({ ok: true, canal: 'PANTALLA', minutos: 15, celular: null });

    // Respeta el tope de enlaces por tarjeta y hora.
    let tope: Awaited<ReturnType<Db['reenviarAccesoTarjeta']>> | null = null;
    for (let i = 0; i < 6; i += 1) {
      tope = await db.reenviarAccesoTarjeta({
        codigo: t.codigo,
        canal: 'PANTALLA',
        usuarioId: ids.caja,
        sucursalId: ids.sucursal,
      });
      if (!tope.ok) break;
    }
    expect(tope).toMatchObject({ ok: false });
  });

  it('no reenvía por un canal que la tarjeta no tiene', async () => {
    const soloCelular = await tarjeta({ celular: celularNuevo() });
    const r = await db.reenviarAccesoTarjeta({
      codigo: soloCelular.codigo,
      canal: 'CORREO',
      usuarioId: ids.caja,
      sucursalId: ids.sucursal,
    });
    expect(r).toMatchObject({ ok: false });
    expect(
      await db.prisma.loyaltyCode.count({
        where: { cardId: soloCelular.id, purpose: 'ACCESO' },
      }),
    ).toBe(0);
    expect(
      await db.reenviarAccesoTarjeta({
        codigo: 'WL-NOEX-ISTE',
        canal: 'PANTALLA',
        usuarioId: ids.caja,
        sucursalId: null,
      }),
    ).toMatchObject({ ok: false });
  });
});
