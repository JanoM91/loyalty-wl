import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import {
  enmascararContacto,
  extraerCodigoTarjeta,
  interpretarContacto,
  normalizarCorreo,
  validarContrasenaTarjeta,
} from '@wl/domain';

import { prisma, transaccion, lote, negocioActual } from '../index';
import { hashContrasena } from '../auth/password';
import { crearSesionTarjeta } from './tarjetas';

/**
 * Códigos de un solo uso del programa de lealtad.
 *
 * Dos usos:
 *
 * 1. **Verificar el correo** con un código de seis dígitos. Verificar es lo
 *    que permite canjear premios: quien controla el correo controla la
 *    tarjeta.
 * 2. **Recuperar la tarjeta** en otro navegador con un enlace al correo de la
 *    tarjeta, esté verificado o no: el enlace solo llega a quien controla ese
 *    buzón, así que abrirlo demuestra lo mismo que el código de seis dígitos
 *    y de paso deja el correo verificado. Escribir un correo en un formulario
 *    nunca da acceso por sí solo a una tarjeta existente.
 * 3. **Enlace desde el panel** para quien no puede recibir correo (tarjeta
 *    solo con celular, buzón perdido): el personal, con la persona enfrente,
 *    genera un enlace o QR de un solo uso que abre la tarjeta en su celular.
 *    No verifica ningún contacto: solo repone el acceso.
 *
 * Aquí no se envía nada: estas funciones devuelven el código o el enlace y la
 * aplicación decide cómo mandarlo. Así el proveedor de correo se puede
 * cambiar sin tocar las reglas.
 */

const MINUTOS_CODIGO = 10;
const MINUTOS_ENLACE = 30;
const MAX_INTENTOS = 3;
/** Códigos por tarjeta y hora. Frena a quien quiera saturar un buzón ajeno. */
const MAX_CODIGOS_POR_HORA = 5;

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/**
 * El código de seis dígitos se guarda con el id de la tarjeta delante. Sin eso,
 * dos tarjetas con el mismo código chocarían en la restricción única y, peor,
 * el hash de seis dígitos solos se revierte en milisegundos.
 */
function hashCodigo(cardId: string, codigo: string): string {
  return hash(`${cardId}:${codigo}`);
}

export type ResultadoEmision =
  | { readonly ok: true; readonly codigo: string; readonly correo: string }
  | { readonly ok: false; readonly error: string };

/** Genera un código para verificar el correo de la tarjeta. */
export async function emitirCodigoVerificacion(cardId: string): Promise<ResultadoEmision> {
  const tarjeta = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!tarjeta) return { ok: false, error: 'No encontramos tu tarjeta.' };
  if (!tarjeta.email) return { ok: false, error: 'Agrega primero un correo a tu tarjeta.' };
  if (tarjeta.emailVerifiedAt) return { ok: false, error: 'Tu correo ya está verificado.' };
  const correo = tarjeta.email;

  const recientes = await prisma.loyaltyCode.count({
    where: {
      cardId,
      purpose: 'VERIFICAR_CORREO',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recientes >= MAX_CODIGOS_POR_HORA) {
    return { ok: false, error: 'Ya pediste varios códigos. Espera una hora e inténtalo de nuevo.' };
  }

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

  // El código nuevo invalida los anteriores: solo sirve el último que llegó.
  await lote((tx) => [
    tx.loyaltyCode.updateMany({
      where: { cardId, purpose: 'VERIFICAR_CORREO', consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    tx.loyaltyCode.create({
      data: {
        cardId,
        purpose: 'VERIFICAR_CORREO',
        email: correo,
        codeHash: hashCodigo(cardId, codigo),
        expiresAt: new Date(Date.now() + MINUTOS_CODIGO * 60 * 1000),
      },
    }),
  ]);

  return { ok: true, codigo, correo: tarjeta.email };
}

export type ResultadoVerificacion =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly intentosRestantes?: number };

/** Comprueba el código y, si coincide, marca el correo como verificado. */
export async function verificarCodigo(
  cardId: string,
  codigoCrudo: string,
): Promise<ResultadoVerificacion> {
  const codigo = codigoCrudo.trim();

  const vigente = await prisma.loyaltyCode.findFirst({
    where: { cardId, purpose: 'VERIFICAR_CORREO', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!vigente || vigente.expiresAt <= new Date()) {
    return { ok: false, error: 'Ese código ya venció. Pide uno nuevo.' };
  }
  if (vigente.attempts >= MAX_INTENTOS) {
    return { ok: false, error: 'Se agotaron los intentos de este código. Pide uno nuevo.' };
  }

  const esperado = Buffer.from(vigente.codeHash, 'hex');
  const recibido = Buffer.from(hashCodigo(cardId, codigo), 'hex');
  const coincide = esperado.length === recibido.length && timingSafeEqual(esperado, recibido);

  if (!coincide) {
    const actualizado = await prisma.loyaltyCode.update({
      where: { id: vigente.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const restantes = Math.max(0, MAX_INTENTOS - actualizado.attempts);
    return {
      ok: false,
      intentosRestantes: restantes,
      error:
        restantes === 0
          ? 'Ese código no coincide y se agotaron los intentos. Pide uno nuevo.'
          : `Ese código no coincide. Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`}.`,
    };
  }

  await transaccion(async (tx) => {
    await tx.loyaltyCode.update({ where: { id: vigente.id }, data: { consumedAt: new Date() } });
    // Solo se verifica si el correo de la tarjeta sigue siendo al que se mandó
    // el código. Si alguien lo cambió entretanto, el código ya no vale.
    await tx.loyaltyCard.updateMany({
      where: { id: cardId, email: vigente.email },
      data: { emailVerifiedAt: new Date() },
    });
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recuperar la tarjeta en otro navegador
// ---------------------------------------------------------------------------

export interface OpcionesEnlace {
  /**
   * Enlace de «Olvidé mi contraseña»: al abrirlo hay que crear una contraseña
   * nueva aunque la tarjeta ya tenga una.
   */
  readonly restablece?: boolean;
  /**
   * Celular al que la caja lo manda por WhatsApp. Al usarlo, si la tarjeta
   * sigue con ese celular, el celular queda verificado.
   */
  readonly celular?: string | null;
}

/** Crea el enlace de acceso de una tarjeta, con el tope por hora. */
export async function crearEnlaceAcceso(
  cardId: string,
  email: string,
  minutos: number,
  opciones: OpcionesEnlace = {},
): Promise<{ readonly token: string; readonly expira: Date } | null> {
  const recientes = await prisma.loyaltyCode.count({
    where: {
      cardId,
      purpose: 'ACCESO',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recientes >= MAX_CODIGOS_POR_HORA) return null;

  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + minutos * 60 * 1000);
  await prisma.loyaltyCode.create({
    data: {
      cardId,
      purpose: 'ACCESO',
      email,
      codeHash: hash(token),
      expiresAt: expira,
      resetsPassword: opciones.restablece ?? false,
      sentToPhone: opciones.celular ?? null,
    },
  });
  return { token, expira };
}

/**
 * La caja tocó «Enviar acceso por WhatsApp» en la bienvenida del alta: el
 * enlace salió hacia el celular registrado de la tarjeta. Se anota para que,
 * al abrirlo, el celular quede verificado. Solo enlaces de acceso vigentes.
 */
export async function marcarEnlaceEnviadoPorWhatsApp(
  token: string,
  usuarioId: string,
): Promise<boolean> {
  const codigo = await prisma.loyaltyCode.findUnique({
    where: { codeHash: hash(token) },
    select: {
      id: true,
      cardId: true,
      purpose: true,
      consumedAt: true,
      expiresAt: true,
      card: { select: { phone: true } },
    },
  });
  if (
    !codigo ||
    codigo.purpose !== 'ACCESO' ||
    codigo.consumedAt ||
    codigo.expiresAt <= new Date() ||
    !codigo.card.phone
  ) {
    return false;
  }
  await lote((tx) => [
    tx.loyaltyCode.update({
      where: { id: codigo.id },
      data: { sentToPhone: codigo.card.phone },
    }),
    tx.auditLog.create({
      data: {
        userId: usuarioId,
        action: 'lealtad.enlace_whatsapp',
        entityType: 'loyalty_card',
        entityId: codigo.cardId,
        metadata: { celular: enmascararContacto(codigo.card.phone) },
      },
    }),
  ]);
  return true;
}

/**
 * Prepara un enlace de acceso para el correo dado.
 *
 * Devuelve `token: null` si no hay una tarjeta activa con ese correo (o si ya
 * se pidieron demasiados enlaces). Quien llama debe responder lo mismo en los
 * dos casos: decir "ese correo no está registrado" le confirmaría a cualquiera
 * quién tiene tarjeta.
 *
 * No exige que el correo esté verificado: el enlace llega solo a ese buzón, y
 * al canjearlo el correo queda verificado (ver `canjearEnlaceAcceso`).
 */
export async function emitirEnlaceAcceso(
  correoCrudo: string,
): Promise<{ readonly token: string | null; readonly correo: string | null }> {
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return { token: null, correo: null };

  const tarjeta = await prisma.loyaltyCard.findFirst({
    where: { email: correo, isActive: true },
    select: { id: true },
  });
  if (!tarjeta) return { token: null, correo };

  const enlace = await crearEnlaceAcceso(tarjeta.id, correo, MINUTOS_ENLACE);
  return { token: enlace?.token ?? null, correo };
}

/** Enlace generado desde el panel. Dura poco: se usa con la persona enfrente. */
export const MINUTOS_ENLACE_PANEL = 15;

export type ResultadoEnlacePanel =
  | {
      readonly ok: true;
      readonly token: string;
      readonly expira: Date;
      readonly codigo: string;
      readonly nombre: string | null;
      /** Contacto enmascarado, para que quien atiende confirme con la persona. */
      readonly contacto: string;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Enlace de acceso generado por el personal para una tarjeta concreta.
 *
 * Es la salida para quien no puede recibir correo: tarjeta solo con celular,
 * o correo al que ya no entra. Se busca por código de tarjeta, correo o
 * celular, tal como lo dicte la persona en caja. Quien lo genera queda en la
 * bitácora; el enlace no verifica ningún contacto (se guarda sin correo) y
 * sirve una sola vez.
 */
export async function emitirEnlaceAccesoDesdePanel(
  busqueda: string,
  usuarioId: string,
): Promise<ResultadoEnlacePanel> {
  // Un correo nunca es un código; un celular de diez dígitos tampoco pasa por
  // código (son ocho caracteres tras el LP), pero se decide primero por si acaso.
  const codigo = busqueda.includes('@') ? null : extraerCodigoTarjeta(busqueda);
  const contacto = codigo ? null : interpretarContacto(busqueda);
  if (!codigo && !contacto) {
    return { ok: false, error: 'Escribe el código de la tarjeta, el correo o el celular.' };
  }

  const tarjeta = await prisma.loyaltyCard.findFirst({
    where: codigo
      ? { publicCode: codigo }
      : contacto!.tipo === 'CORREO'
        ? { email: contacto!.valor }
        : { phone: contacto!.valor },
    select: { id: true, publicCode: true, isActive: true, name: true, email: true, phone: true },
  });
  if (!tarjeta) return { ok: false, error: 'No encontramos una tarjeta con ese dato.' };
  if (!tarjeta.isActive) return { ok: false, error: 'Esa tarjeta está desactivada.' };

  const enlace = await crearEnlaceAcceso(tarjeta.id, '', MINUTOS_ENLACE_PANEL);
  if (!enlace) {
    return {
      ok: false,
      error: 'Ya se generaron varios enlaces para esta tarjeta. Espera una hora.',
    };
  }

  await prisma.auditLog.create({
    data: {
      userId: usuarioId,
      action: 'lealtad.enlace_acceso',
      entityType: 'loyalty_card',
      entityId: tarjeta.id,
      metadata: { codigo: tarjeta.publicCode, vence: enlace.expira.toISOString() },
    },
  });

  return {
    ok: true,
    ...enlace,
    codigo: tarjeta.publicCode,
    nombre: tarjeta.name,
    contacto: enmascararContacto(tarjeta.email ?? tarjeta.phone),
  };
}

/** Treinta días: lo que tarda, como mucho, en abrirse por primera vez la app instalada. */
const MINUTOS_ENLACE_APP = 30 * 24 * 60;

/**
 * Enlace de arranque para la tarjeta instalada como aplicación.
 *
 * Cuando la persona agrega la tarjeta a su pantalla de inicio,
 * la app instalada arranca sin las cookies del navegador (iOS las separa).
 * El manifest lleva este token en su `start_url` para que la primera apertura
 * abra la tarjeta correcta sin pedir nada. Si ya existe uno vigente para esta
 * sesión (se guarda en una cookie), se reutiliza: Chrome vuelve a pedir el
 * manifest en cada carga y no tiene sentido llenar la tabla.
 */
export async function crearEnlaceApp(cardId: string): Promise<{ token: string; expira: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + MINUTOS_ENLACE_APP * 60 * 1000);
  await prisma.loyaltyCode.create({
    data: { cardId, purpose: 'ACCESO_APP', email: '', codeHash: hash(token), expiresAt: expira },
  });
  return { token, expira };
}

/** ¿Este token de app sigue vigente y es de esta tarjeta? */
export async function enlaceAppVigente(token: string, cardId: string): Promise<boolean> {
  const codigo = await prisma.loyaltyCode.findUnique({
    where: { codeHash: hash(token) },
    select: { cardId: true, purpose: true, consumedAt: true, expiresAt: true },
  });
  return Boolean(
    codigo &&
    codigo.cardId === cardId &&
    codigo.purpose === 'ACCESO_APP' &&
    !codigo.consumedAt &&
    codigo.expiresAt > new Date(),
  );
}

/**
 * ¿Qué pide la página del enlace antes de abrir la tarjeta?
 *
 * - `OBLIGATORIA`: crear contraseña nueva. Solo el enlace de «Olvidé mi
 *   contraseña».
 * - `OPCIONAL`: puede abrirla tal cual o aprovechar para crear (o cambiar) su
 *   contraseña.
 * - `NO`: arranque de la app instalada.
 *
 * Solo lee: no consume el enlace.
 */
export type ContrasenaEnEnlace = 'OBLIGATORIA' | 'OPCIONAL' | 'NO';

export type EstadoEnlaceAcceso =
  | { readonly valido: false }
  | {
      readonly valido: true;
      readonly contrasena: ContrasenaEnEnlace;
      readonly nombre: string | null;
      /**
       * Correo (o celular) de la tarjeta, para que el gestor de contraseñas
       * guarde la nueva con el dato con que se entra. Quien tiene el enlace ya
       * puede abrir la tarjeta: no revela nada que no tenga.
       */
      readonly usuario: string | null;
    };

const ENLACE_VENCIDO = 'Este enlace ya se usó o venció. Pide uno nuevo.';

function contrasenaQuePide(
  codigo: { purpose: string; resetsPassword: boolean },
  tieneContrasena: boolean,
): ContrasenaEnEnlace {
  if (codigo.purpose !== 'ACCESO') return 'NO';
  // Desde el 11 nov 2026 la contraseña es opcional: la tarjeta siempre se
  // puede abrir con el enlace personal (ver enlace-personal.ts). Solo
  // «Olvidé mi contraseña» obliga a poner una nueva, porque es lo que pidió.
  void tieneContrasena;
  return codigo.resetsPassword ? 'OBLIGATORIA' : 'OPCIONAL';
}

export async function consultarEnlaceAcceso(token: string): Promise<EstadoEnlaceAcceso> {
  const codigo = await prisma.loyaltyCode.findUnique({
    where: { codeHash: hash(token) },
    select: {
      purpose: true,
      resetsPassword: true,
      consumedAt: true,
      expiresAt: true,
      card: {
        select: { isActive: true, passwordHash: true, name: true, email: true, phone: true },
      },
    },
  });
  if (
    !codigo ||
    (codigo.purpose !== 'ACCESO' && codigo.purpose !== 'ACCESO_APP') ||
    codigo.consumedAt ||
    codigo.expiresAt <= new Date() ||
    !codigo.card.isActive
  ) {
    return { valido: false };
  }
  return {
    valido: true,
    contrasena: contrasenaQuePide(codigo, codigo.card.passwordHash !== null),
    nombre: codigo.card.name,
    usuario: codigo.card.email ?? codigo.card.phone,
  };
}

export type ResultadoCanje =
  | {
      readonly ok: true;
      readonly token: string;
      readonly expira: Date;
      /** Tarjeta que se abrió (comunicación mide la primera apertura de la app). */
      readonly cardId: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      /** El enlace sigue vigente: solo falta (o no sirve) la contraseña. */
      readonly contrasena?: boolean;
    };

/**
 * Canjea el enlace y abre sesión. Un enlace sirve una sola vez.
 *
 * Se llama desde un botón y no al abrir el enlace: los filtros de correo de
 * algunas empresas abren cada enlace para revisarlo, y si con eso bastara,
 * gastarían el acceso antes que la persona.
 *
 * **Contraseña.** Si la tarjeta no tiene, o el enlace es de «Olvidé mi
 * contraseña», hay que mandarla aquí: se valida antes de gastar el enlace (una
 * contraseña rechazada no obliga a pedir otro) y se guarda en el mismo paso.
 * Restablecerla cierra las demás sesiones de la tarjeta.
 *
 * **Verificación.** Un enlace que llegó por correo verifica ese correo; uno
 * que la caja mandó por WhatsApp verifica ese celular. En los dos casos, solo
 * si la tarjeta sigue con ese dato. Los enlaces que la caja muestra en
 * pantalla (QR) no verifican nada.
 */
export async function canjearEnlaceAcceso(
  token: string,
  userAgent: string | null,
  opciones: { readonly clave?: string | null } = {},
): Promise<ResultadoCanje> {
  const codigo = await prisma.loyaltyCode.findUnique({
    where: { codeHash: hash(token) },
    include: { card: { select: { isActive: true, passwordHash: true, phone: true } } },
  });

  if (
    !codigo ||
    (codigo.purpose !== 'ACCESO' && codigo.purpose !== 'ACCESO_APP') ||
    codigo.consumedAt ||
    codigo.expiresAt <= new Date() ||
    !codigo.card.isActive
  ) {
    return { ok: false, error: ENLACE_VENCIDO };
  }

  const pide = contrasenaQuePide(codigo, codigo.card.passwordHash !== null);
  const clave = pide === 'NO' ? '' : (opciones.clave ?? '');
  if (pide === 'OBLIGATORIA' && !clave) {
    return { ok: false, contrasena: true, error: 'Crea tu contraseña para abrir tu tarjeta.' };
  }
  let hashNuevo: string | null = null;
  if (clave) {
    const motivo = validarContrasenaTarjeta(clave, {
      celular: codigo.card.phone,
      negocio: (await negocioActual()).nombre,
    });
    if (motivo) return { ok: false, contrasena: true, error: motivo };
    hashNuevo = await hashContrasena(clave);
  }

  const consumido = await prisma.loyaltyCode.updateMany({
    where: { id: codigo.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumido.count === 0) {
    return { ok: false, error: 'Este enlace ya se usó. Pide uno nuevo.' };
  }

  const ahora = new Date();
  await transaccion(async (tx) => {
    // Abrir el enlace demuestra que la persona controla ese buzón: si la
    // tarjeta sigue con ese correo y aún no estaba verificado, queda
    // verificado. Los enlaces del panel se guardan sin correo.
    if (codigo.email) {
      await tx.loyaltyCard.updateMany({
        where: { id: codigo.cardId, email: codigo.email, emailVerifiedAt: null },
        data: { emailVerifiedAt: ahora },
      });
    }
    // Lo mismo con el celular al que la caja lo mandó por WhatsApp.
    if (codigo.sentToPhone) {
      await tx.loyaltyCard.updateMany({
        where: { id: codigo.cardId, phone: codigo.sentToPhone, phoneVerifiedAt: null },
        data: { phoneVerifiedAt: ahora },
      });
    }
    if (hashNuevo) {
      // Si ya tenía contraseña, quien la conocía no debe seguir dentro.
      if (codigo.card.passwordHash) {
        await tx.loyaltySession.deleteMany({ where: { cardId: codigo.cardId } });
      }
      await tx.loyaltyCard.update({
        where: { id: codigo.cardId },
        data: { passwordHash: hashNuevo, passwordChangedAt: ahora },
      });
    }
  });

  const sesion = await crearSesionTarjeta(codigo.cardId, userAgent);
  return { ok: true, ...sesion, cardId: codigo.cardId };
}
