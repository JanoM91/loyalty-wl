import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import {
  fechaLocal,
  formarCodigoTarjeta,
  normalizarCelular,
  normalizarCorreo,
  type PremioGenerado,
  type ProgramaLealtad,
} from '@wl/domain';

import {
  prisma,
  transaccion,
  negocioActual,
  AJUSTES_POR_OMISION,
  type AjustesNegocio,
  esErrorUnico,
  camposDelError,
} from '../index';
import { ORIGEN_MIGRACION, bloquearTarjeta, fechaBD, sumarEstampas } from './caja';
import { programaVigente } from './programa';
import { VERSION_TERMINOS } from './tarjetas';

/**
 * «Nuevo cliente leal»: alta desde el mostrador y migración de la tarjeta
 * física.
 *
 * Regla heredada del sistema de referencia: quien llega con prisa no se registra solo.
 * El personal captura nombre completo y un contacto, y el sistema manda el
 * acceso a la tarjeta para que la persona entre con calma después, ya con su
 * primera visita acumulada.
 *
 * Reglas de la migración (una sola vez por cliente):
 * - Se capturan las visitas que traía la tarjeta física. Con la visita de hoy
 *   la tarjeta digital no pasa de `posiciones − 1` estampas: nunca nace con
 *   la tarjeta llena.
 * - Con `UMBRAL_EVIDENCIA` o más estampas en total se exige foto de la
 *   tarjeta física, celular y correo. Es la medida contra la fuga de premios;
 *   lo demás se confía al personal, y todo queda en bitácora con su nombre.
 */

/** Estampas totales (migradas + la de hoy) a partir de las cuales se pide evidencia. */
/** Valor por omisión; cada negocio lo ajusta (`ajustes.umbralEvidenciaMigracion`). */
export const UMBRAL_EVIDENCIA = AJUSTES_POR_OMISION.umbralEvidenciaMigracion;

/** Las dos reglas de la migración que un negocio puede cambiar. */
export type ReglasMigracion = Pick<AjustesNegocio, 'umbralEvidenciaMigracion' | 'margenMigracion'>;

export interface DatosAltaCaja {
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno: string;
  readonly celular: string;
  readonly correo: string;
  /** Visitas que traía la tarjeta física. 0 si no trae tarjeta. */
  readonly visitasFisicas: number;
  readonly fotoTarjetaFisicaUrl: string | null;
  readonly sucursalId: string;
  readonly usuarioId: string;
}

export interface TarjetaCreadaEnCaja {
  readonly cardId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly correo: string | null;
  readonly celular: string | null;
  readonly estampas: number;
  readonly ciclo: number;
  readonly premios: readonly PremioGenerado[];
  readonly visitasMigradas: number;
}

export type ResultadoAltaCaja =
  | { readonly ok: true; readonly tarjeta: TarjetaCreadaEnCaja }
  | { readonly ok: false; readonly error: string };

function limpiarNombre(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Reglas de la migración: tope de visitas y evidencia exigida.
 * Devuelve el mensaje de error o null. Sirve para el alta y para una tarjeta
 * que ya existe (`estampasActuales` > 0).
 */
export function validarMigracion(
  d: {
    readonly visitas: number;
    readonly fotoUrl: string | null;
    readonly celular: string | null;
    readonly correo: string | null;
  },
  programa: ProgramaLealtad,
  estampasActuales = 0,
  reglas: ReglasMigracion = AJUSTES_POR_OMISION,
): string | null {
  const v = d.visitas;
  if (!Number.isInteger(v) || v < 0) return 'Las visitas de la tarjeta física deben ser un número.';
  if (v === 0) return null;
  // La visita de hoy también cuenta: la tarjeta no puede quedar llena.
  const tope = Math.max(0, programa.posiciones - reglas.margenMigracion - estampasActuales);
  if (v > tope) {
    return `Con la visita de hoy, la tarjeta no puede pasar de ${programa.posiciones - 1} estampas: captura como máximo ${tope} ${tope === 1 ? 'visita' : 'visitas'} de la tarjeta física.`;
  }
  if (v + estampasActuales + 1 >= reglas.umbralEvidenciaMigracion) {
    if (!d.fotoUrl)
      return `A partir de ${reglas.umbralEvidenciaMigracion} estampas se necesita la foto de la tarjeta física.`;
    if (!d.celular || !d.correo)
      return `A partir de ${reglas.umbralEvidenciaMigracion} estampas se necesitan el celular y el correo del cliente.`;
  }
  return null;
}

/** Lo que puede fallar en el alta antes de tocar la base. Devuelve el mensaje o null. */
export function validarAltaCaja(
  d: Pick<
    DatosAltaCaja,
    | 'nombre'
    | 'apellidoPaterno'
    | 'apellidoMaterno'
    | 'celular'
    | 'correo'
    | 'visitasFisicas'
    | 'fotoTarjetaFisicaUrl'
  >,
  programa: ProgramaLealtad,
  reglas: ReglasMigracion = AJUSTES_POR_OMISION,
): string | null {
  if (limpiarNombre(d.nombre).length < 2) return 'Escribe el nombre del cliente.';
  if (limpiarNombre(d.apellidoPaterno).length < 2) return 'Escribe el apellido paterno.';
  if (limpiarNombre(d.apellidoMaterno).length < 1)
    return 'Escribe el apellido materno (un guion si no tiene).';

  const celular = d.celular.trim() === '' ? null : normalizarCelular(d.celular);
  const correo = d.correo.trim() === '' ? null : normalizarCorreo(d.correo);
  if (d.celular.trim() !== '' && !celular) return 'El celular debe tener 10 dígitos.';
  if (d.correo.trim() !== '' && !correo) return 'Ese correo no parece válido.';
  if (!celular && !correo) return 'Captura el celular o el correo del cliente (al menos uno).';

  return validarMigracion(
    { visitas: d.visitasFisicas, fotoUrl: d.fotoTarjetaFisicaUrl, celular, correo },
    programa,
    0,
    reglas,
  );
}

/** Registra las visitas migradas y las suma a la tarjeta. Dentro de la transacción. */
async function migrarEnTransaccion(
  tx: Prisma.TransactionClient,
  tarjeta: { id: string; stamps: number; cycle: number; is_active: boolean },
  d: {
    visitas: number;
    fotoUrl: string | null;
    sucursalId: string;
    usuarioId: string;
    programa: ProgramaLealtad;
  },
): Promise<{ despues: { estampas: number; ciclo: number }; premios: readonly PremioGenerado[] }> {
  const hoy = fechaLocal(new Date(), (await negocioActual()).zonaHoraria);
  const ahora = new Date();
  const hhmmss = ahora.toISOString().slice(11, 19).replace(/:/g, '');
  const folio = `MIG-${hhmmss}`;

  const acreditacion = await tx.loyaltyAccrual.create({
    data: {
      cardId: tarjeta.id,
      branchId: d.sucursalId,
      status: 'ACREDITADA',
      purchaseDate: fechaBD(hoy),
      ticketFolio: folio,
      ticketRegister: 'MIG',
      ticketKey: `${d.sucursalId}|MIG|${hoy}|${tarjeta.id}`,
      totalCents: 0,
      eligibleCents: 0,
      stampsAwarded: d.visitas,
      programVersion: d.programa.version,
      captureSource: ORIGEN_MIGRACION,
      photoUrl: d.fotoUrl,
      note: `Tarjeta física: ${d.visitas} ${d.visitas === 1 ? 'visita' : 'visitas'} migradas`,
      createdById: d.usuarioId,
    },
    select: { id: true },
  });
  const r = await sumarEstampas(tx, tarjeta, acreditacion.id, d.visitas, d.programa);

  await tx.loyaltyCard.update({
    where: { id: tarjeta.id },
    data: {
      physicalMigratedAt: ahora,
      physicalMigratedStamps: d.visitas,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: d.usuarioId,
      action: 'lealtad.migrar_fisica',
      entityType: 'loyalty_card',
      entityId: tarjeta.id,
      metadata: {
        visitas: d.visitas,
        conFoto: Boolean(d.fotoUrl),
        premios: r.premios.length,
        acreditacion: acreditacion.id,
      },
    },
  });
  return { despues: r.despues, premios: r.premios };
}

/**
 * Crea la tarjeta desde caja. No acredita la visita de hoy: eso lo hace la
 * caja con `acreditarVisita` justo después, con el folio si lo capturó.
 */
export async function crearTarjetaEnCaja(d: DatosAltaCaja): Promise<ResultadoAltaCaja> {
  const negocio = await negocioActual();
  const programa = await programaVigente();
  const problema = validarAltaCaja(d, programa, negocio.ajustes);
  if (problema) return { ok: false, error: problema };

  const celular = d.celular.trim() === '' ? null : normalizarCelular(d.celular);
  const correo = d.correo.trim() === '' ? null : normalizarCorreo(d.correo);
  const nombre = [d.nombre, d.apellidoPaterno, d.apellidoMaterno]
    .map(limpiarNombre)
    .filter((x) => x !== '-' && x !== '—')
    .join(' ')
    .slice(0, 120);

  const repetida = await prisma.loyaltyCard.findFirst({
    where: {
      OR: [...(celular ? [{ phone: celular }] : []), ...(correo ? [{ email: correo }] : [])],
    },
    select: { publicCode: true, name: true, phone: true, email: true },
  });
  if (repetida) {
    const por = repetida.phone === celular ? 'ese celular' : 'ese correo';
    return {
      ok: false,
      error: `Ya existe una tarjeta con ${por} (${repetida.publicCode}${repetida.name ? `, ${repetida.name}` : ''}). Búscala con «Registrar visita» o repón su acceso.`,
    };
  }

  const sucursal = await prisma.branch.findUnique({
    where: { id: d.sucursalId },
    select: { isActive: true, loyaltyEnabled: true },
  });
  if (!sucursal?.isActive || !sucursal.loyaltyEnabled) {
    return { ok: false, error: 'Esta sucursal todavía no participa en el programa.' };
  }

  const ahora = new Date();
  for (let intento = 0; intento < 5; intento++) {
    const codigo = formarCodigoTarjeta(randomBytes(8), negocio.prefijoCodigo);
    try {
      const creada = await transaccion(async (tx) => {
        const t = await tx.loyaltyCard.create({
          data: {
            publicCode: codigo,
            name: nombre,
            phone: celular,
            email: correo,
            termsVersion: VERSION_TERMINOS,
            termsAcceptedAt: ahora,
            // Regla heredada del sistema de referencia: las altas nacen con promociones
            // activas; la persona puede darse de baja desde su tarjeta.
            marketingOptIn: true,
            marketingOptInAt: ahora,
            enrolledBranchId: d.sucursalId,
            enrolledById: d.usuarioId,
          },
          select: { id: true, publicCode: true, stamps: true, cycle: true },
        });
        await tx.auditLog.create({
          data: {
            userId: d.usuarioId,
            action: 'lealtad.alta_caja',
            entityType: 'loyalty_card',
            entityId: t.id,
            metadata: {
              codigo: t.publicCode,
              conCelular: Boolean(celular),
              conCorreo: Boolean(correo),
            },
          },
        });

        let estampas = t.stamps;
        let ciclo = t.cycle;
        let premios: readonly PremioGenerado[] = [];
        if (d.visitasFisicas > 0) {
          const r = await migrarEnTransaccion(
            tx,
            { id: t.id, stamps: t.stamps, cycle: t.cycle, is_active: true },
            {
              visitas: d.visitasFisicas,
              fotoUrl: d.fotoTarjetaFisicaUrl,
              sucursalId: d.sucursalId,
              usuarioId: d.usuarioId,
              programa,
            },
          );
          estampas = r.despues.estampas;
          ciclo = r.despues.ciclo;
          premios = r.premios;
        }
        return { cardId: t.id, codigo: t.publicCode, estampas, ciclo, premios };
      });
      return {
        ok: true,
        tarjeta: {
          ...creada,
          nombre,
          correo,
          celular,
          visitasMigradas: d.visitasFisicas,
        },
      };
    } catch (e) {
      if (esErrorUnico(e)) {
        const campos = camposDelError(e);
        if (campos.includes('public_code')) continue;
        return { ok: false, error: 'Ya existe una tarjeta con ese contacto.' };
      }
      throw e;
    }
  }
  throw new Error('No se pudo generar un código de tarjeta único.');
}

// ---------------------------------------------------------------------------
// Buscar por contacto (visita sin tarjeta a la mano)
// ---------------------------------------------------------------------------

export type ResultadoBusquedaContacto =
  | { readonly ok: true; readonly codigo: string | null }
  | { readonly ok: false; readonly error: string };

/**
 * ¿De quién es este celular o correo? Devuelve el código de la tarjeta, o null
 * si no hay ninguna. Si se dan los dos y pertenecen a tarjetas distintas, es
 * un error: la caja debe aclarar con la persona cuál es la suya.
 */
export async function tarjetaPorContacto(d: {
  readonly celular: string;
  readonly correo: string;
}): Promise<ResultadoBusquedaContacto> {
  const celular = d.celular.trim() === '' ? null : normalizarCelular(d.celular);
  const correo = d.correo.trim() === '' ? null : normalizarCorreo(d.correo);
  if (d.celular.trim() !== '' && !celular)
    return { ok: false, error: 'El celular debe tener 10 dígitos.' };
  if (d.correo.trim() !== '' && !correo)
    return { ok: false, error: 'Ese correo no parece válido.' };
  if (!celular && !correo)
    return { ok: false, error: 'Escribe el celular o el correo del cliente.' };

  const [porCelular, porCorreo] = await Promise.all([
    celular
      ? prisma.loyaltyCard.findFirst({
          where: { phone: celular },
          select: { publicCode: true, isActive: true },
        })
      : null,
    correo
      ? prisma.loyaltyCard.findFirst({
          where: { email: correo },
          select: { publicCode: true, isActive: true },
        })
      : null,
  ]);
  if (porCelular && porCorreo && porCelular.publicCode !== porCorreo.publicCode) {
    return {
      ok: false,
      error:
        'El celular y el correo son de dos tarjetas distintas. Pregunta cuál es la suya y captura solo ese dato.',
    };
  }
  const t = porCelular ?? porCorreo;
  if (t && !t.isActive) return { ok: false, error: 'La tarjeta de ese contacto está desactivada.' };
  return { ok: true, codigo: t?.publicCode ?? null };
}

// ---------------------------------------------------------------------------
// Migrar la tarjeta física a una tarjeta digital que ya existe
// ---------------------------------------------------------------------------

export type ResultadoMigracion =
  | {
      readonly ok: true;
      readonly estampas: number;
      readonly ciclo: number;
      readonly premios: readonly PremioGenerado[];
    }
  | { readonly ok: false; readonly error: string };

export async function migrarTarjetaFisica(d: {
  readonly codigo: string;
  readonly visitas: number;
  readonly fotoUrl: string | null;
  readonly sucursalId: string;
  readonly usuarioId: string;
}): Promise<ResultadoMigracion> {
  const reglas = (await negocioActual()).ajustes;
  const programa = await programaVigente();
  if (!Number.isInteger(d.visitas) || d.visitas < 1) {
    return { ok: false, error: 'Escribe cuántas visitas traía la tarjeta física (al menos 1).' };
  }

  return transaccion(async (tx) => {
    const tarjeta = await bloquearTarjeta(tx, d.codigo);
    if (!tarjeta) return { ok: false, error: 'No encontramos esa tarjeta.' } as const;

    const datos = await tx.loyaltyCard.findUnique({
      where: { id: tarjeta.id },
      select: { physicalMigratedAt: true, phone: true, email: true, name: true },
    });
    if (!datos) return { ok: false, error: 'No encontramos esa tarjeta.' } as const;
    if (datos.physicalMigratedAt) {
      return {
        ok: false,
        error: 'A esta tarjeta ya se le pasaron sus visitas físicas. Solo se hace una vez.',
      } as const;
    }

    const problema = validarMigracion(
      { visitas: d.visitas, fotoUrl: d.fotoUrl, celular: datos.phone, correo: datos.email },
      programa,
      tarjeta.stamps,
      reglas,
    );
    if (problema) return { ok: false, error: problema } as const;

    const r = await migrarEnTransaccion(tx, tarjeta, {
      visitas: d.visitas,
      fotoUrl: d.fotoUrl,
      sucursalId: d.sucursalId,
      usuarioId: d.usuarioId,
      programa,
    });
    return {
      ok: true,
      estampas: r.despues.estampas,
      ciclo: r.despues.ciclo,
      premios: r.premios,
    } as const;
  });
}
