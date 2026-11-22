import { createHash, randomBytes } from 'node:crypto';

import {
  esCumpleanosValido,
  formarCodigoTarjeta,
  interpretarContacto,
  normalizarCelular,
  normalizarCorreo,
  TOPE_TARJETAS_PRUEBA,
} from '@wl/domain';

import { prisma, negocioActual, esErrorUnico, camposDelError } from '../index';
import { estadoComercialDe } from '../negocio';
import { describirPremioGanado } from './caja';
import { programaVigente } from './programa';
import { regalosDeTarjeta, type RegaloTarjeta } from '../regalos';

/**
 * Tarjetas de lealtad del lado del cliente: alta, sesión y perfil.
 *
 * La tarjeta vive en el navegador como una cookie con un token; aquí solo se
 * guarda su hash. Es el mismo esquema que el panel, por la misma razón: una
 * fuga de la base no entrega sesiones utilizables.
 */

export const NOMBRE_COOKIE_TARJETA = 'wl_card';

/** Versión de los términos del programa que acepta quien se da de alta. */
export const VERSION_TERMINOS = '2026-11';

/**
 * Más de un año. Una tarjeta de lealtad que se cierra sola cada mes es una
 * tarjeta que la gente deja de usar.
 */
const DURACION_SESION_DIAS = 400;

export function hashTokenTarjeta(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export type ResultadoAlta =
  | { readonly ok: true; readonly token: string; readonly expira: Date; readonly codigo: string }
  | { readonly ok: false; readonly error: string; readonly yaExiste?: boolean };

export interface DatosAlta {
  /** Celular o correo, como lo escribió la persona. */
  readonly contacto: string;
  readonly aceptaTerminos: boolean;
  readonly aceptaPromociones: boolean;
  /** Sucursal cuyo código QR de mostrador se escaneó, si fue así. */
  readonly sucursalSlug?: string | null;
  readonly userAgent?: string | null;
}

/**
 * Crea una tarjeta y abre su sesión en este navegador.
 *
 * No se pide código para crearla: la persona puede acumular desde la primera
 * compra. Lo que exige verificar el contacto es canjear un premio. Así el alta
 * en el mostrador tarda segundos y nadie se queda sin su primera estampa
 * porque el código tardó en llegar.
 */
export async function crearTarjeta(datos: DatosAlta): Promise<ResultadoAlta> {
  if (!datos.aceptaTerminos) {
    return {
      ok: false,
      error: 'Para crear tu tarjeta necesitas aceptar los términos del programa.',
    };
  }

  const contacto = interpretarContacto(datos.contacto);
  if (!contacto) {
    return {
      ok: false,
      error: 'Escribe un celular de 10 dígitos o un correo válido.',
    };
  }

  const campo = contacto.tipo === 'CORREO' ? { email: contacto.valor } : { phone: contacto.valor };

  // Un club con la prueba vencida no admite tarjetas nuevas; en prueba, hasta el tope.
  const negocio = await negocioActual();
  const comercial = estadoComercialDe(negocio);
  if (comercial === 'PAUSADO') {
    return {
      ok: false,
      error: 'Este programa está en pausa por ahora. Pregunta en el negocio.',
    };
  }
  if (comercial === 'PRUEBA' && (await prisma.loyaltyCard.count()) >= TOPE_TARJETAS_PRUEBA) {
    return {
      ok: false,
      error: 'Este programa llegó a su límite de tarjetas por ahora. Pregunta en el negocio.',
    };
  }

  const existente = await prisma.loyaltyCard.findFirst({ where: campo, select: { id: true } });
  if (existente) {
    return {
      ok: false,
      yaExiste: true,
      error:
        contacto.tipo === 'CORREO'
          ? 'Ya hay una tarjeta con ese correo. Si es tuya, recupérala con el enlace que te mandamos.'
          : 'Ya hay una tarjeta con ese celular. Si es tuya, recupérala con tu correo verificado o pide ayuda en caja.',
    };
  }

  const sucursal = datos.sucursalSlug
    ? await prisma.branch.findFirst({ where: { slug: datos.sucursalSlug }, select: { id: true } })
    : null;

  const ahora = new Date();

  // El código se genera al azar; si choca con uno existente (muy improbable),
  // se intenta con otro. La restricción única de la base es la que decide.
  const prefijo = negocio.prefijoCodigo;
  for (let intento = 0; intento < 5; intento++) {
    const codigo = formarCodigoTarjeta(randomBytes(8), prefijo);
    try {
      const tarjeta = await prisma.loyaltyCard.create({
        data: {
          ...campo,
          publicCode: codigo,
          termsVersion: VERSION_TERMINOS,
          termsAcceptedAt: ahora,
          marketingOptIn: datos.aceptaPromociones,
          marketingOptInAt: datos.aceptaPromociones ? ahora : null,
          enrolledBranchId: sucursal?.id ?? null,
        },
        select: { id: true, publicCode: true },
      });
      const sesion = await crearSesionTarjeta(tarjeta.id, datos.userAgent ?? null);
      return { ok: true, token: sesion.token, expira: sesion.expira, codigo: tarjeta.publicCode };
    } catch (e) {
      if (esErrorUnico(e)) {
        const campos = camposDelError(e);
        if (campos.includes('public_code')) continue;
        // Dos altas con el mismo contacto al mismo tiempo: gana la primera.
        return { ok: false, yaExiste: true, error: 'Ya hay una tarjeta con ese contacto.' };
      }
      throw e;
    }
  }

  throw new Error('No se pudo generar un código de tarjeta único.');
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

export async function crearSesionTarjeta(
  cardId: string,
  userAgent: string | null,
): Promise<{ token: string; expira: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACION_SESION_DIAS * 24 * 60 * 60 * 1000);
  await prisma.loyaltySession.create({
    data: {
      tokenHash: hashTokenTarjeta(token),
      cardId,
      expiresAt: expira,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });
  return { token, expira };
}

/** El id de la tarjeta de esta sesión, o null si no hay sesión válida. */
export async function leerSesionTarjeta(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const sesion = await prisma.loyaltySession.findUnique({
    where: { tokenHash: hashTokenTarjeta(token) },
    select: {
      id: true,
      cardId: true,
      expiresAt: true,
      lastSeenAt: true,
      card: { select: { isActive: true } },
    },
  });
  if (!sesion || sesion.expiresAt <= new Date() || !sesion.card.isActive) return null;

  // Se anota la última visita como mucho una vez por hora: escribir en cada
  // carga de página no aporta nada y cuesta una consulta.
  if (Date.now() - sesion.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.loyaltySession.update({
      where: { id: sesion.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return sesion.cardId;
}

export async function cerrarSesionTarjeta(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.loyaltySession.deleteMany({ where: { tokenHash: hashTokenTarjeta(token) } });
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export interface PremioTarjeta {
  readonly id: string;
  /** Clave del premio. */
  readonly tipo: string;
  /** Nombre y detalle tal como se prometieron al ganarlo. */
  readonly nombre: string;
  readonly incluye: string;
  readonly posicion: number;
  readonly ciclo: number;
  readonly disponible: boolean;
  readonly generado: Date;
  readonly entregado: Date | null;
  readonly sucursalEntrega: string | null;
}

export interface VisitaTarjeta {
  readonly id: string;
  readonly fecha: Date;
  readonly sucursal: string;
  readonly folio: string;
  readonly estampas: number;
  readonly pendiente: boolean;
  readonly rechazada: boolean;
}

export interface VistaTarjeta {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string | null;
  readonly celular: string | null;
  readonly correo: string | null;
  readonly correoVerificado: boolean;
  readonly celularVerificado: boolean;
  /** Ya creó su contraseña. Si no, la tarjeta muestra el aviso para crearla. */
  readonly tieneContrasena: boolean;
  /** Puede canjear: tiene al menos un contacto verificado. */
  readonly verificada: boolean;
  readonly estampas: number;
  readonly ciclo: number;
  readonly posiciones: number;
  readonly promociones: boolean;
  readonly cumpleDia: number | null;
  readonly cumpleMes: number | null;
  readonly alta: Date;
  readonly premios: readonly PremioTarjeta[];
  /** Regalos automáticos sin cobrar y sin vencer («Te extrañamos», cumpleaños). */
  readonly regalos: readonly RegaloTarjeta[];
  readonly visitas: readonly VisitaTarjeta[];
}

/** Todo lo que necesita la tarjeta del cliente para pintarse. */
export async function obtenerTarjeta(cardId: string): Promise<VistaTarjeta | null> {
  const t = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    include: {
      rewards: {
        orderBy: { createdAt: 'desc' },
        include: { redeemedBranch: { select: { name: true } } },
      },
      accruals: {
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: { branch: { select: { name: true } } },
      },
    },
  });
  if (!t) return null;
  const [programa, regalos] = await Promise.all([programaVigente(), regalosDeTarjeta(t.id)]);

  return {
    id: t.id,
    codigo: t.publicCode,
    nombre: t.name,
    celular: t.phone,
    correo: t.email,
    correoVerificado: t.emailVerifiedAt !== null,
    celularVerificado: t.phoneVerifiedAt !== null,
    tieneContrasena: t.passwordHash !== null,
    verificada: t.emailVerifiedAt !== null || t.phoneVerifiedAt !== null,
    estampas: t.stamps,
    ciclo: t.cycle,
    posiciones: programa.posiciones,
    promociones: t.marketingOptIn,
    cumpleDia: t.birthDay,
    cumpleMes: t.birthMonth,
    alta: t.createdAt,
    premios: t.rewards.map((r) => ({
      id: r.id,
      tipo: r.kind,
      ...describirPremioGanado(programa, r),
      posicion: r.milestone,
      ciclo: r.cycle,
      disponible: r.status === 'DISPONIBLE',
      generado: r.createdAt,
      entregado: r.redeemedAt,
      sucursalEntrega: r.redeemedBranch?.name ?? null,
    })),
    regalos,
    visitas: t.accruals.map((a) => ({
      id: a.id,
      fecha: a.purchaseDate,
      sucursal: a.branch.name,
      folio: a.ticketFolio,
      estampas: a.stampsAwarded,
      pendiente: a.status === 'PENDIENTE',
      rechazada: a.status === 'RECHAZADA',
    })),
  };
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export interface CambiosPerfil {
  readonly nombre?: string | null;
  readonly cumpleDia?: number | null;
  readonly cumpleMes?: number | null;
  readonly promociones?: boolean;
}

export async function actualizarPerfil(
  cardId: string,
  cambios: CambiosPerfil,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nombre = cambios.nombre?.trim().slice(0, 120) || null;

  const dia = cambios.cumpleDia ?? null;
  const mes = cambios.cumpleMes ?? null;
  if ((dia === null) !== (mes === null)) {
    return { ok: false, error: 'Para tu cumpleaños escribe el día y el mes.' };
  }
  if (dia !== null && mes !== null && !esCumpleanosValido(dia, mes)) {
    return { ok: false, error: 'Esa fecha de cumpleaños no existe en el calendario.' };
  }

  const actual = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { marketingOptIn: true },
  });
  if (!actual) return { ok: false, error: 'No encontramos tu tarjeta.' };

  const promociones = cambios.promociones ?? actual.marketingOptIn;

  await prisma.loyaltyCard.update({
    where: { id: cardId },
    data: {
      name: nombre,
      birthDay: dia,
      birthMonth: mes,
      marketingOptIn: promociones,
      // El nombre va en el pase de Apple Wallet.
      walletUpdatedAt: new Date(),
      // La fecha del consentimiento es evidencia: solo cambia cuando cambia.
      ...(promociones !== actual.marketingOptIn
        ? {
            marketingOptInAt: promociones ? new Date() : null,
            // Volver a aceptar desde el perfil deshace una baja anterior.
            ...(promociones ? { campaignOptOutAt: null } : {}),
          }
        : {}),
    },
  });

  return { ok: true };
}

/**
 * Agrega o cambia el correo de la tarjeta (queda sin verificar).
 *
 * Es el camino para quien se dio de alta con su celular: hoy la verificación
 * solo llega por correo.
 */
export async function cambiarCorreo(
  cardId: string,
  correoCrudo: string,
): Promise<{ ok: true; correo: string } | { ok: false; error: string }> {
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return { ok: false, error: 'Escribe un correo válido.' };

  const otra = await prisma.loyaltyCard.findFirst({
    where: { email: correo },
    select: { id: true },
  });
  if (otra && otra.id !== cardId) {
    return { ok: false, error: 'Ese correo ya está en otra tarjeta.' };
  }

  const actual = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { email: true },
  });
  if (actual?.email === correo) return { ok: true, correo };

  await prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { email: correo, emailVerifiedAt: null },
  });
  return { ok: true, correo };
}

/**
 * Agrega o cambia el celular de la tarjeta (queda sin verificar).
 *
 * Es el camino para quien se dio de alta con su correo: así la caja puede
 * buscarla por celular y, cuando haya WhatsApp, avisarle por ahí.
 */
export async function cambiarCelular(
  cardId: string,
  celularCrudo: string,
): Promise<{ ok: true; celular: string } | { ok: false; error: string }> {
  const celular = normalizarCelular(celularCrudo);
  if (!celular) return { ok: false, error: 'Escribe un celular de 10 dígitos.' };

  const otra = await prisma.loyaltyCard.findFirst({
    where: { phone: celular },
    select: { id: true },
  });
  if (otra && otra.id !== cardId) {
    return { ok: false, error: 'Ese celular ya está en otra tarjeta.' };
  }

  const actual = await prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { phone: true },
  });
  if (actual?.phone === celular) return { ok: true, celular };

  await prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { phone: celular, phoneVerifiedAt: null },
  });
  return { ok: true, celular };
}
