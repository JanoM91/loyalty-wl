import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaLocal, sumarDias } from '@wl/domain';
// Solo el tipo: el módulo real se carga dentro de la prueba, después de saber
// que hay una base de pruebas, porque al importarse crea la conexión.
import type * as ModuloBd from '../src/index';
import { negocioDePrueba } from './ayuda';

/**
 * Prueba de integración del programa de lealtad contra una base real.
 *
 * **Solo corre si `WL_PRUEBAS_BD=1`.** La enciende el flujo de CI, que
 * levanta un Postgres vacío para cada ejecución. En una computadora de
 * desarrollo, `DATABASE_URL` podría apuntar a datos reales, y una prueba que
 * crea y borra registros no tiene nada que hacer ahí. Por la misma razón se
 * niega a correr contra cualquier dirección de Neon. Cada archivo crea su
 * propio negocio de prueba y lo borra al terminar.
 *
 * Lo que comprueba es lo que ninguna prueba del dominio puede: que las
 * restricciones de la base y el bloqueo de la tarjeta sostienen las reglas
 * cuando dos cajas registran al mismo tiempo.
 */

const URL = process.env.DATABASE_URL ?? '';
const ACTIVA = process.env.WL_PRUEBAS_BD === '1' && URL !== '' && !URL.includes('neon.tech');

type Db = typeof ModuloBd;

describe.skipIf(!ACTIVA)('programa de lealtad contra la base', () => {
  let db: Db;
  let negocio: ModuloBd.Negocio;
  const sufijo = Math.random().toString(36).slice(2, 8);
  const hoy = fechaLocal(new Date());
  const ids = { sucursal: '', sucursalApagada: '', usuario: '' };
  const tarjetas: string[] = [];

  const ticket = (folio: string, fecha = hoy) => ({
    folio,
    caja: '1',
    fecha,
    totalCentavos: 18_500,
    propinaCentavos: 2_000,
    descuentoCentavos: 0,
    fotoUrl: null,
    origen: 'MANUAL' as const,
  });

  async function nuevaTarjeta(
    contacto: string,
  ): Promise<{ codigo: string; id: string; token: string }> {
    const r = await db.crearTarjeta({ contacto, aceptaTerminos: true, aceptaPromociones: false });
    if (!r.ok) throw new Error(r.error);
    const id = (await db.leerSesionTarjeta(r.token))!;
    tarjetas.push(id);
    return { codigo: r.codigo, id, token: r.token };
  }

  beforeAll(async () => {
    db = await import('../src/index');
    negocio = await negocioDePrueba({ slug: 'prueba-lealtad', nombre: 'Café El Buentueste' });
    // Todo lo de este archivo corre dentro de ese negocio.
    db.fijarResolutorDeNegocio(() => negocio);
    const base = {
      addressLine: 'Calle de prueba 1',
      neighborhood: 'Centro',
      postalCode: '91000',
    };
    ids.sucursal = (
      await db.prisma.branch.create({
        data: { ...base, slug: `prueba-${sufijo}`, name: `Prueba ${sufijo}`, loyaltyEnabled: true },
      })
    ).id;
    ids.sucursalApagada = (
      await db.prisma.branch.create({
        data: { ...base, slug: `prueba-off-${sufijo}`, name: `Prueba off ${sufijo}` },
      })
    ).id;
    ids.usuario = (
      await db.prisma.userAccount.create({
        data: {
          email: `caja-${sufijo}@prueba.mx`,
          name: 'Caja de prueba',
          role: 'SUCURSAL',
          branchId: ids.sucursal,
        },
      })
    ).id;
    // El negocio nace con el programa base (v1); este es el suyo (v2).
    const base2 = await db.programaVigente();
    await db.guardarPrograma(
      {
        ...base2,
        hitos: [
          {
            posicion: 5,
            premio: 'CAFE_GRATIS',
            nombre: 'Café gratis',
            incluye: 'Un café del día.',
          },
          {
            posicion: 10,
            premio: 'CAFE_GRANDE_POSTRE',
            nombre: 'Café grande + postre',
            incluye: 'Un café grande y un postre de la vitrina.',
          },
        ],
      },
      { usuarioId: ids.usuario, nota: 'Programa del negocio de prueba' },
    );
  });

  afterAll(async () => {
    if (!db) return;
    db.fijarResolutorDeNegocio(() => null);
    // Borrar el negocio se lleva todo lo que estas pruebas crearon.
    if (negocio) await db.borrarNegocio(negocio.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('crea la tarjeta, abre sesión y no repite contacto', async () => {
    const t = await nuevaTarjeta(`ana-${sufijo}@correo.mx`);
    expect(t.codigo).toMatch(/^WL-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const repetida = await db.crearTarjeta({
      contacto: `ANA-${sufijo}@Correo.mx `,
      aceptaTerminos: true,
      aceptaPromociones: false,
    });
    expect(repetida).toMatchObject({ ok: false, yaExiste: true });

    const sinTerminos = await db.crearTarjeta({
      contacto: '228 555 0000',
      aceptaTerminos: false,
      aceptaPromociones: false,
    });
    expect(sinTerminos.ok).toBe(false);

    await db.cerrarSesionTarjeta(t.token);
    expect(await db.leerSesionTarjeta(t.token)).toBeNull();
  });

  it('acredita una visita por sucursal y día, y un ticket una sola vez', async () => {
    const a = await nuevaTarjeta(`luis-${sufijo}@correo.mx`);
    const b = await nuevaTarjeta(`22855${sufijo.replace(/\D/g, '').padEnd(5, '1').slice(0, 5)}`);

    const pedir = (codigo: string, folio: string, sucursalId = ids.sucursal) =>
      db.acreditarVisita({ codigo, sucursalId, usuarioId: ids.usuario, ticket: ticket(folio) });

    const primera = await pedir(a.codigo, `C1-${sufijo}-1`);
    expect(primera).toMatchObject({
      tipo: 'ACREDITADA',
      estampas: 1,
      despues: { estampas: 1, ciclo: 1 },
    });

    expect(await pedir(a.codigo, `C1-${sufijo}-2`)).toEqual({
      tipo: 'RECHAZADA',
      motivo: 'YA_ACUMULO_EN_FECHA',
    });
    // El mismo ticket, escrito distinto, para otra tarjeta.
    expect(await pedir(b.codigo, `c1 ${sufijo} 1`)).toEqual({
      tipo: 'RECHAZADA',
      motivo: 'TICKET_DUPLICADO',
    });
    expect(await pedir(b.codigo, `C1-${sufijo}-3`, ids.sucursalApagada)).toEqual({
      tipo: 'RECHAZADA',
      motivo: 'SUCURSAL_NO_PARTICIPA',
    });
    expect(await pedir('WL-ZZZZ-ZZZZ', `C1-${sufijo}-4`)).toEqual({
      tipo: 'RECHAZADA',
      motivo: 'TARJETA_NO_ENCONTRADA',
    });

    const vista = await db.vistaCaja(a.codigo, ids.sucursal);
    expect(vista).toMatchObject({ estampas: 1, acumuloHoyAqui: true, verificada: false });
  });

  it('con dos cajas al mismo tiempo, solo una acredita', async () => {
    const t = await nuevaTarjeta(`mar-${sufijo}@correo.mx`);
    const resultados = await Promise.all(
      [1, 2, 3].map((n) =>
        db.acreditarVisita({
          codigo: t.codigo,
          sucursalId: ids.sucursal,
          usuarioId: ids.usuario,
          ticket: ticket(`P-${sufijo}-${n}`),
        }),
      ),
    );
    expect(resultados.filter((r) => r.tipo === 'ACREDITADA')).toHaveLength(1);
    const tarjeta = await db.prisma.loyaltyCard.findUnique({ where: { id: t.id } });
    expect(tarjeta?.stamps).toBe(1);
  });

  it('los tickets de días anteriores quedan pendientes y administración los resuelve', async () => {
    const t = await nuevaTarjeta(`pau-${sufijo}@correo.mx`);
    const base = { codigo: t.codigo, sucursalId: ids.sucursal, usuarioId: ids.usuario };

    const ayer = sumarDias(hoy, -1);
    expect(await db.acreditarVisita({ ...base, ticket: ticket(`A-${sufijo}`, ayer) })).toEqual({
      tipo: 'PREGUNTAR_CONTINGENCIA',
      diasAtras: 1,
    });
    expect(
      await db.acreditarVisita({
        ...base,
        ticket: ticket(`A-${sufijo}`, ayer),
        registrarComo: 'CONTINGENCIA',
        nota: 'Sin internet',
      }),
    ).toEqual({ tipo: 'PENDIENTE', razon: 'CONTINGENCIA' });

    const viejo = sumarDias(hoy, -6);
    expect(await db.acreditarVisita({ ...base, ticket: ticket(`V-${sufijo}`, viejo) })).toEqual({
      tipo: 'RECHAZADA',
      motivo: 'FUERA_DE_VENTANA',
    });
    expect(
      await db.acreditarVisita({
        ...base,
        ticket: ticket(`V-${sufijo}`, viejo),
        registrarComo: 'REVISION',
      }),
    ).toEqual({ tipo: 'PENDIENTE', razon: 'REVISION' });

    const pendientes = (await db.listarPendientes()).filter((p) => p.codigo === t.codigo);
    expect(pendientes).toHaveLength(2);

    const contingencia = pendientes.find((p) => p.folio === `A-${sufijo}`)!;
    const revision = pendientes.find((p) => p.folio === `V-${sufijo}`)!;

    expect(await db.aprobarPendiente(contingencia.id, ids.usuario)).toEqual({ ok: true });
    expect(await db.aprobarPendiente(contingencia.id, ids.usuario)).toMatchObject({ ok: false });
    expect(await db.rechazarPendiente(revision.id, ids.usuario, 'no')).toMatchObject({ ok: false });
    expect(
      await db.rechazarPendiente(revision.id, ids.usuario, 'Ticket ilegible en la foto'),
    ).toEqual({
      ok: true,
    });

    const tarjeta = await db.prisma.loyaltyCard.findUnique({ where: { id: t.id } });
    expect(tarjeta?.stamps).toBe(1);
  });

  it('genera el premio en la quinta y solo lo entrega una vez, con contacto verificado', async () => {
    const t = await nuevaTarjeta(`rocio-${sufijo}@correo.mx`);
    await db.prisma.loyaltyCard.update({ where: { id: t.id }, data: { stamps: 4 } });

    const r = await db.acreditarVisita({
      codigo: t.codigo,
      sucursalId: ids.sucursal,
      usuarioId: ids.usuario,
      ticket: ticket(`R-${sufijo}`),
    });
    expect(r).toMatchObject({
      tipo: 'ACREDITADA',
      premios: [{ premio: 'CAFE_GRATIS', posicion: 5, ciclo: 1 }],
    });

    const [premio] = (await db.vistaCaja(t.codigo, ids.sucursal))!.premiosDisponibles;
    expect(premio?.tipo).toBe('CAFE_GRATIS');

    const entrega = {
      premioId: premio!.id,
      codigo: t.codigo,
      sucursalId: ids.sucursal,
      usuarioId: ids.usuario,
    };
    expect((await db.entregarPremio(entrega)).ok).toBe(false); // sin verificar

    const emision = await db.emitirCodigoVerificacion(t.id);
    if (!emision.ok) throw new Error(emision.error);
    const otro = emision.codigo === '000000' ? '111111' : '000000';
    expect(await db.verificarCodigo(t.id, otro)).toMatchObject({ ok: false, intentosRestantes: 2 });
    expect(await db.verificarCodigo(t.id, emision.codigo)).toEqual({ ok: true });

    expect(await db.entregarPremio({ ...entrega, codigo: 'WL-ZZZZ-ZZZZ' })).toMatchObject({
      ok: false,
    });
    expect(await db.entregarPremio({ ...entrega, sucursalId: ids.sucursalApagada })).toMatchObject({
      ok: false,
    });
    expect(await db.entregarPremio(entrega)).toEqual({
      ok: true,
      tipo: 'CAFE_GRATIS',
      nombre: 'Café gratis',
    });
    expect(await db.entregarPremio(entrega)).toMatchObject({ ok: false });

    const ops = await db.operacionesDeHoy(ids.sucursal);
    expect(ops.some((o) => o.que === 'Premio entregado · Café gratis')).toBe(true);
  });

  it('el programa vigente sale de la base y cada versión nueva deja la anterior', async () => {
    // El negocio nace con v1 (el programa base) y publicó v2.
    const vigente = await db.programaVigente();
    expect(vigente.version).toBe('v2');
    expect(vigente.hitos.find((h) => h.posicion === 10)?.nombre).toBe('Café grande + postre');

    const malo = await db.guardarPrograma(
      { ...vigente, hitos: [{ posicion: 11, premio: 'X', nombre: 'Fuera', incluye: '' }] },
      { usuarioId: ids.usuario },
    );
    expect(malo.ok).toBe(false);

    const nueva = await db.guardarPrograma(
      {
        ...vigente,
        hitos: vigente.hitos.map((h) =>
          h.posicion === 5 ? { ...h, premio: 'GALLETA', nombre: 'Galleta' } : h,
        ),
      },
      { usuarioId: ids.usuario, nota: 'Prueba de integración' },
    );
    expect(nueva).toEqual({ ok: true, version: 'v3' });
    expect((await db.programaVigente()).version).toBe('v3');

    const versiones = await db.versionesDelPrograma();
    expect(versiones.filter((v) => v.activa).map((v) => v.programa.version)).toEqual(['v3']);
    expect(versiones.map((v) => v.programa.version)).toEqual(
      expect.arrayContaining(['v1', 'v2', 'v3']),
    );

    // El premio nuevo nace con su nombre guardado.
    const t = await nuevaTarjeta(`galleta-${sufijo}@correo.mx`);
    await db.prisma.loyaltyCard.update({ where: { id: t.id }, data: { stamps: 4 } });
    const r = await db.acreditarVisita({
      codigo: t.codigo,
      sucursalId: ids.sucursal,
      usuarioId: ids.usuario,
      ticket: ticket(`CH-${sufijo}`),
    });
    expect(r).toMatchObject({ tipo: 'ACREDITADA', premios: [{ premio: 'GALLETA', posicion: 5 }] });
    const vista = await db.vistaCaja(t.codigo, ids.sucursal);
    expect(vista?.premiosDisponibles[0]).toMatchObject({ tipo: 'GALLETA', nombre: 'Galleta' });

    // Volver a v2 para el resto de las pruebas.
    await db.prisma.loyaltyProgram.updateMany({ data: { isActive: false } });
    await db.prisma.loyaltyProgram.updateMany({
      where: { version: 'v2' },
      data: { isActive: true },
    });
    db.olvidarProgramaEnCache();
    expect((await db.programaVigente()).version).toBe('v2');
  });

  it('da de alta desde caja con la visita de hoy y migra la tarjeta física una sola vez', async () => {
    const celular = `22866${sufijo.replace(/\D/g, '').padEnd(5, '2').slice(0, 5)}`;
    const base = {
      nombre: 'Mariana',
      apellidoPaterno: 'López',
      apellidoMaterno: 'Ruiz',
      celular,
      correo: '',
      fotoTarjetaFisicaUrl: null,
      sucursalId: ids.sucursal,
      usuarioId: ids.usuario,
    };

    // Con 4 migradas + hoy = 5 estampas: hace falta evidencia.
    expect(await db.crearTarjetaEnCaja({ ...base, visitasFisicas: 4 })).toMatchObject({
      ok: false,
    });

    const alta = await db.crearTarjetaEnCaja({ ...base, visitasFisicas: 3 });
    if (!alta.ok) throw new Error(alta.error);
    tarjetas.push(alta.tarjeta.cardId);
    expect(alta.tarjeta).toMatchObject({
      nombre: 'Mariana López Ruiz',
      celular,
      estampas: 3,
      visitasMigradas: 3,
    });

    // Las visitas migradas no cuentan para «una por día»: la de hoy entra.
    const hoyVisita = await db.acreditarVisita({
      codigo: alta.tarjeta.codigo,
      sucursalId: ids.sucursal,
      usuarioId: ids.usuario,
      ticket: ticket(''),
    });
    expect(hoyVisita).toMatchObject({ tipo: 'ACREDITADA', despues: { estampas: 4 } });

    const vista = await db.vistaCaja(alta.tarjeta.codigo, ids.sucursal);
    expect(vista).toMatchObject({
      estampas: 4,
      acumuloHoyAqui: true,
      migradaFisica: true,
      tieneCelular: true,
      tieneCorreo: false,
    });

    // Mismo contacto, segunda alta: no.
    expect(await db.crearTarjetaEnCaja({ ...base, visitasFisicas: 0 })).toMatchObject({
      ok: false,
    });
    // Migrar dos veces: no.
    expect(
      await db.migrarTarjetaFisica({
        codigo: alta.tarjeta.codigo,
        visitas: 1,
        fotoUrl: null,
        sucursalId: ids.sucursal,
        usuarioId: ids.usuario,
      }),
    ).toMatchObject({ ok: false });

    // Una tarjeta web existente sí puede migrar, respetando el tope.
    const web = await nuevaTarjeta(`fisica-${sufijo}@correo.mx`);
    expect(
      await db.migrarTarjetaFisica({
        codigo: web.codigo,
        visitas: 9,
        fotoUrl: null,
        sucursalId: ids.sucursal,
        usuarioId: ids.usuario,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await db.migrarTarjetaFisica({
        codigo: web.codigo,
        visitas: 2,
        fotoUrl: null,
        sucursalId: ids.sucursal,
        usuarioId: ids.usuario,
      }),
    ).toMatchObject({ ok: true, estampas: 2 });

    const ops = await db.operacionesDeHoy(ids.sucursal, 20);
    expect(ops.some((o) => o.que.startsWith('Tarjeta física migrada'))).toBe(true);
  });

  it('recupera la tarjeta con un enlace que sirve una sola vez y verifica el correo', async () => {
    const t = await nuevaTarjeta(`fer-${sufijo}@correo.mx`);

    // Un correo que no es de ninguna tarjeta no genera enlace, y la respuesta no lo delata.
    expect((await db.emitirEnlaceAcceso(`nadie-${sufijo}@correo.mx`)).token).toBeNull();

    // El correo no está verificado todavía: aun así hay enlace, porque solo
    // llega a ese buzón.
    const enlace = await db.emitirEnlaceAcceso(`FER-${sufijo}@correo.mx`);
    expect(enlace.token).toBeTruthy();

    // Desde nov 2026 la contraseña es opcional: aunque la tarjeta no tenga,
    // el enlace abre sin crearla (solo «Olvidé mi contraseña» la exige).
    expect(await db.consultarEnlaceAcceso(enlace.token!)).toMatchObject({
      valido: true,
      contrasena: 'OPCIONAL',
    });
    const acceso = await db.canjearEnlaceAcceso(enlace.token!, 'prueba');
    expect(acceso.ok).toBe(true);
    if (acceso.ok) expect(await db.leerSesionTarjeta(acceso.token)).toBe(t.id);
    // Sirve una sola vez.
    expect((await db.canjearEnlaceAcceso(enlace.token!, 'prueba')).ok).toBe(false);

    // Abrir el enlace demostró que controla el correo.
    const tarjeta = await db.prisma.loyaltyCard.findUnique({ where: { id: t.id } });
    expect(tarjeta?.emailVerifiedAt).not.toBeNull();
  });

  it('el enlace personal abre la tarjeta siempre, sin contraseña, hasta que se cambia', async () => {
    const t = await nuevaTarjeta(`hector-${sufijo}@correo.mx`);

    const token = await db.enlacePersonalDeTarjeta(t.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    // Es el mismo cada vez que se pide.
    expect(await db.enlacePersonalDeTarjeta(t.id)).toBe(token);
    expect(await db.tarjetaPorEnlacePersonal(token!)).toMatchObject({ cardId: t.id });

    // Abre sesión las veces que haga falta.
    for (let i = 0; i < 2; i++) {
      const r = await db.abrirConEnlacePersonal(token!, { userAgent: 'prueba' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(await db.leerSesionTarjeta(r.token)).toBe(t.id);
    }

    // Cambiarlo invalida el anterior.
    const nuevo = await db.regenerarEnlacePersonal(t.id);
    expect(nuevo).toBeTruthy();
    expect(nuevo).not.toBe(token);
    expect(await db.tarjetaPorEnlacePersonal(token!)).toBeNull();
    expect((await db.abrirConEnlacePersonal(token!, { userAgent: 'prueba' })).ok).toBe(false);
    expect((await db.abrirConEnlacePersonal(nuevo!, { userAgent: 'prueba' })).ok).toBe(true);
  });

  it('el panel repone el acceso por código, correo o celular sin verificar nada', async () => {
    const t = await nuevaTarjeta(`gus-${sufijo}@correo.mx`);

    expect(await db.emitirEnlaceAccesoDesdePanel('cualquier cosa', ids.usuario)).toMatchObject({
      ok: false,
    });
    expect(
      await db.emitirEnlaceAccesoDesdePanel(`nadie-${sufijo}@correo.mx`, ids.usuario),
    ).toMatchObject({ ok: false });

    const porCodigo = await db.emitirEnlaceAccesoDesdePanel(t.codigo, ids.usuario);
    expect(porCodigo).toMatchObject({ ok: true, codigo: t.codigo });
    const porCorreo = await db.emitirEnlaceAccesoDesdePanel(`GUS-${sufijo}@correo.mx`, ids.usuario);
    expect(porCorreo).toMatchObject({ ok: true, codigo: t.codigo });

    if (!porCodigo.ok) throw new Error(porCodigo.error);
    const acceso = await db.canjearEnlaceAcceso(porCodigo.token, 'prueba', {
      clave: 'rosca de reyes 2027',
    });
    expect(acceso.ok).toBe(true);
    if (acceso.ok) expect(await db.leerSesionTarjeta(acceso.token)).toBe(t.id);

    // El enlace del panel no demuestra nada sobre el correo: sigue sin verificar.
    const tarjeta = await db.prisma.loyaltyCard.findUnique({ where: { id: t.id } });
    expect(tarjeta?.emailVerifiedAt).toBeNull();
  });

  it('el perfil valida el cumpleaños y guarda el consentimiento', async () => {
    const t = await nuevaTarjeta(`kari-${sufijo}@correo.mx`);
    expect(await db.actualizarPerfil(t.id, { cumpleDia: 31, cumpleMes: 4 })).toMatchObject({
      ok: false,
    });
    expect(await db.actualizarPerfil(t.id, { cumpleDia: 3 })).toMatchObject({ ok: false });
    expect(
      await db.actualizarPerfil(t.id, {
        nombre: ' Kari ',
        cumpleDia: 29,
        cumpleMes: 2,
        promociones: true,
      }),
    ).toEqual({ ok: true });

    const vista = await db.obtenerTarjeta(t.id);
    expect(vista).toMatchObject({ nombre: 'Kari', cumpleDia: 29, cumpleMes: 2, promociones: true });
    const fila = await db.prisma.loyaltyCard.findUnique({ where: { id: t.id } });
    expect(fila?.marketingOptInAt).toBeInstanceOf(Date);

    expect(await db.cambiarCorreo(t.id, `ana-${sufijo}@correo.mx`)).toMatchObject({ ok: false });
    expect(await db.cambiarCorreo(t.id, 'no-es-correo')).toMatchObject({ ok: false });
  });

  it('el resumen cuenta lo registrado', async () => {
    await db.cambiarParticipacion(`prueba-off-${sufijo}`, true, ids.usuario);
    const r = await db.resumenLealtad(7);
    expect(r.tarjetas).toBeGreaterThanOrEqual(tarjetas.length);
    expect(r.visitas).toBeGreaterThanOrEqual(4);
    expect(r.porSucursal.find((s) => s.id === ids.sucursal)?.visitas).toBeGreaterThanOrEqual(4);
    expect(r.porSucursal.find((s) => s.id === ids.sucursalApagada)?.participa).toBe(true);
    expect(r.porDia).toHaveLength(7);

    const lista = await db.listarTarjetas({ busqueda: `kari-${sufijo}` });
    expect(lista).toHaveLength(1);
    expect(lista[0]?.contacto).toContain('•••@');
    expect(await db.detalleTarjeta(lista[0]!.codigo)).toMatchObject({ nombre: 'Kari' });

    const bitacora = await db.bitacoraLealtad(50);
    expect(bitacora.some((b) => b.accion === 'Premio entregado')).toBe(true);
  });

  it('la analítica cuadra con el resumen y cubre la serie completa', async () => {
    const a = await db.analiticaLealtad(28);
    const programa = await db.programaVigente();
    expect(a.porDia).toHaveLength(28);
    expect(a.porDia[a.porDia.length - 1]?.dia).toBe(hoy);
    expect(a.estampas.map((e) => e.estampas)).toEqual(
      Array.from({ length: programa.posiciones }, (_, i) => i),
    );
    expect(a.resumen.tarjetas).toBeGreaterThanOrEqual(tarjetas.length);
    expect(a.resumen.visitas7d).toBeLessThanOrEqual(a.resumen.visitas);
    // Cada visita cae en exactamente una categoría de comprobante.
    const comprobante = a.captura.filter((c) => c.grupo === 'comprobante');
    expect(comprobante.reduce((s, c) => s + c.n, 0)).toBe(a.resumen.visitas);
    expect(a.verificacion.find((p) => p.orden === 1)?.n).toBe(a.resumen.tarjetas);
    const sucursal = a.porSucursal.find((s) => s.sucursal === `Prueba ${sufijo}`);
    expect(sucursal?.estado).toBe('Participa');
    expect(sucursal?.visitas).toBeGreaterThanOrEqual(4);
  });

  it('las fotos de ticket vencen a los 90 días de la compra', async () => {
    const t = await nuevaTarjeta(`fotos-${sufijo}@correo.mx`);
    const fila = (diasAtras: number, folio: string) => ({
      cardId: t.id,
      branchId: ids.sucursal,
      status: 'ACREDITADA' as const,
      purchaseDate: new Date(`${sumarDias(hoy, -diasAtras)}T00:00:00Z`),
      ticketFolio: folio,
      ticketRegister: '1',
      ticketKey: `${ids.sucursal}|1|${sumarDias(hoy, -diasAtras)}|${folio}-${sufijo}`,
      totalCents: 10_000,
      eligibleCents: 10_000,
      stampsAwarded: 1,
      programVersion: 'v1',
      photoUrl: `https://fotos.example.test/${folio}-${sufijo}.jpg`,
    });
    const vieja = await db.prisma.loyaltyAccrual.create({ data: fila(91, 'VIEJA') });
    const reciente = await db.prisma.loyaltyAccrual.create({ data: fila(89, 'RECIENTE') });

    const vencidas = await db.fotosVencidas(500, hoy);
    expect(vencidas.map((f) => f.id)).toContain(vieja.id);
    expect(vencidas.map((f) => f.id)).not.toContain(reciente.id);

    const enUso = await db.fotosEnUso([
      reciente.photoUrl!,
      'https://fotos.example.test/huerfana.jpg',
    ]);
    expect([...enUso]).toEqual([reciente.photoUrl]);

    expect(await db.olvidarFotos([vieja.id], 1)).toBe(1);
    const despues = await db.prisma.loyaltyAccrual.findUnique({ where: { id: vieja.id } });
    expect(despues?.photoUrl).toBeNull();
    // La visita se conserva: solo se olvida la imagen.
    expect(despues?.stampsAwarded).toBe(1);
  });
});
