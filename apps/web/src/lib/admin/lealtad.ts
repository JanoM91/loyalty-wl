import { ROLES_DIRECCION, prisma, type AlcanceSolicitudes, type UserRole } from '@wl/database';

import type { Sesion } from './sesion';

/** Quién opera la caja de lealtad. Las cuentas de sucursal, solo la suya. */
export const ROLES_CAJA: readonly UserRole[] = ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'];

/**
 * Quién administra el programa: reglas y premios, sucursales, pendientes y
 * reportes. Regla heredada de LAPANA (oct-2026): Administración, Dueño y Gerencia.
 */
export const ROLES_PROGRAMA: readonly UserRole[] = ['ADMIN', 'DUENO', 'GERENTE'];

export interface SucursalCaja {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
  readonly participa: boolean;
}

/**
 * La sucursal en la que opera esta sesión.
 *
 * **Una cuenta de sucursal no elige.** Aunque mande otro `slug` en la URL o
 * en una acción, se usa la sucursal de su cuenta. La administración central sí
 * puede escoger, porque cubre a cualquier mostrador.
 */
export async function sucursalDeCaja(
  sesion: Sesion,
  slugPedido?: string | null,
): Promise<{ sucursal: SucursalCaja | null; opciones: readonly SucursalCaja[] }> {
  const filas = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(sesion.rol === 'SUCURSAL'
        ? { id: sesion.branchId ?? '00000000-0000-0000-0000-000000000000' }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, loyaltyEnabled: true },
  });
  const opciones = filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.name,
    participa: f.loyaltyEnabled,
  }));

  if (sesion.rol === 'SUCURSAL') return { sucursal: opciones[0] ?? null, opciones };
  return { sucursal: opciones.find((o) => o.slug === slugPedido) ?? null, opciones };
}

/**
 * Qué solicitudes de acceso ve esta sesión en la caja: una cuenta de
 * sucursal, solo las de su sucursal; Administración, Dueño y Gerencia, todas.
 */
export function alcanceSolicitudes(sesion: Sesion): AlcanceSolicitudes {
  return { todas: ROLES_DIRECCION.includes(sesion.rol), branchId: sesion.branchId };
}
