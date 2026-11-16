import type { Prisma } from '@prisma/client';
import {
  PROGRAMA_BASE,
  programaDesdeDatos,
  validarPrograma,
  type ProgramaLealtad,
} from '@wl/domain';

import { prisma, transaccion, negocioActual } from '../index';

/**
 * Programa de lealtad vigente, leído de la base.
 *
 * **Por qué una caché corta.** La caja, la tarjeta del cliente y los pases de
 * Wallet preguntan por el programa en cada petición. Las reglas cambian pocas
 * veces al año; releerlas cada medio minuto es más que suficiente y evita una
 * consulta por página. Al guardar desde el panel se vacía la caché de ese
 * proceso; otras instancias la renuevan solas en segundos.
 *
 * **Respaldo.** Si la base no tiene una versión activa (o guarda algo que no
 * se puede leer), se usa `PROGRAMA_BASE` y se deja un aviso en el registro: la
 * caja nunca debe dejar de acreditar por un problema de configuración.
 */

const SEGUNDOS_CACHE = 30;

/** Por negocio: el programa de uno no puede servirle a otro. */
const cache = new Map<string, { programa: ProgramaLealtad; vence: number }>();

export function olvidarProgramaEnCache(): void {
  cache.clear();
}

export async function programaVigente(): Promise<ProgramaLealtad> {
  const negocio = await negocioActual();
  const guardado = cache.get(negocio.id);
  if (guardado && guardado.vence > Date.now()) return guardado.programa;

  // Si la base falla, falla la operación: acreditar con un programa que no es
  // el del negocio regalaría o negaría premios.
  const fila = await prisma.loyaltyProgram.findFirst({ where: { isActive: true } });
  let programa: ProgramaLealtad = PROGRAMA_BASE;

  if (fila) {
    const leido = programaDesdeDatos({
      version: fila.version,
      posiciones: fila.positions,
      modalidad: fila.mode,
      hitos: fila.milestones,
      tramos: fila.tiers,
      ventanaContingenciaDias: fila.contingencyWindowDays,
    });
    if (leido && validarPrograma(leido).length === 0) {
      programa = leido;
    } else {
      console.error(
        `[lealtad] La versión ${fila.version} del programa no se puede leer; se usa el programa base.`,
      );
    }
  }

  cache.set(negocio.id, { programa, vence: Date.now() + SEGUNDOS_CACHE * 1000 });
  return programa;
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------

export interface VersionPrograma {
  readonly programa: ProgramaLealtad;
  readonly activa: boolean;
  readonly nota: string | null;
  readonly creadaPor: string | null;
  readonly creada: Date;
  readonly activada: Date | null;
}

export async function versionesDelPrograma(): Promise<VersionPrograma[]> {
  const filas = await prisma.loyaltyProgram.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });
  const salida: VersionPrograma[] = [];
  for (const f of filas) {
    const p = programaDesdeDatos({
      version: f.version,
      posiciones: f.positions,
      modalidad: f.mode,
      hitos: f.milestones,
      tramos: f.tiers,
      ventanaContingenciaDias: f.contingencyWindowDays,
    });
    if (!p) continue;
    salida.push({
      programa: p,
      activa: f.isActive,
      nota: f.note,
      creadaPor: f.createdBy?.name ?? null,
      creada: f.createdAt,
      activada: f.activatedAt,
    });
  }
  return salida;
}

/** "v7" → 7. Para proponer la versión siguiente. */
function numeroDeVersion(v: string): number {
  const n = Number(v.replace(/^v/, ''));
  return Number.isInteger(n) ? n : 0;
}

export async function siguienteVersion(): Promise<string> {
  const filas = await prisma.loyaltyProgram.findMany({ select: { version: true } });
  const mayor = filas.reduce(
    (m: number, f: { version: string }) => Math.max(m, numeroDeVersion(f.version)),
    0,
  );
  return `v${mayor + 1}`;
}

export type ResultadoGuardarPrograma =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly problemas: readonly string[] };

/**
 * Publica una versión nueva del programa y la deja activa.
 *
 * La versión anterior se conserva inactiva: las acreditaciones la referencian
 * por `programVersion`. Los pases de Wallet de todas las tarjetas activas se
 * marcan para regenerarse, porque muestran los premios del programa.
 */
export async function guardarPrograma(
  propuesta: Omit<ProgramaLealtad, 'version'>,
  opciones: { readonly usuarioId: string; readonly nota?: string | null },
): Promise<ResultadoGuardarPrograma> {
  const version = await siguienteVersion();
  const programa: ProgramaLealtad = { ...propuesta, version };
  const problemas = validarPrograma(programa);
  if (problemas.length > 0) return { ok: false, problemas };

  const ahora = new Date();
  await transaccion(async (tx) => {
    await tx.loyaltyProgram.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const fila = await tx.loyaltyProgram.create({
      data: {
        version,
        positions: programa.posiciones,
        mode: programa.modalidad,
        milestones: programa.hitos as unknown as Prisma.InputJsonValue,
        tiers: programa.tramos as unknown as Prisma.InputJsonValue,
        contingencyWindowDays: programa.ventanaContingenciaDias,
        isActive: true,
        note: opciones.nota?.trim().slice(0, 300) || null,
        createdById: opciones.usuarioId,
        activatedAt: ahora,
      },
      select: { id: true },
    });
    await tx.loyaltyCard.updateMany({
      where: { isActive: true },
      data: { walletUpdatedAt: ahora },
    });
    await tx.auditLog.create({
      data: {
        userId: opciones.usuarioId,
        action: 'lealtad.programa',
        entityType: 'loyalty_program',
        entityId: fila.id,
        metadata: {
          version,
          posiciones: programa.posiciones,
          modalidad: programa.modalidad,
          premios: programa.hitos.map((h) => `${h.posicion}: ${h.nombre}`),
        },
      },
    });
  });

  olvidarProgramaEnCache();
  return { ok: true, version };
}
