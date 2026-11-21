import {
  DESCRIPCION_ROLES,
  ETIQUETA_ROL,
  ROLES_OFRECIDOS,
  prisma,
  type UserRole,
} from '@wl/database';

import type { OpcionRol, OpcionSucursal } from './FormularioUsuario';

/** Datos que los formularios (navegador) no pueden pedir a la base por su cuenta. */

/**
 * Roles que se ofrecen. «Administración» solo aparece si alguien ya lo tiene
 * (`ademas`): así su cuenta se puede editar sin cambiarle el rol.
 */
export function opcionesRol(ademas: readonly UserRole[] = []): OpcionRol[] {
  const roles = [...ademas.filter((r) => r === 'ADMIN'), ...ROLES_OFRECIDOS].filter(
    (r, i, todos) => todos.indexOf(r) === i,
  );
  return roles.map((r) => {
    const d = DESCRIPCION_ROLES[r];
    return {
      valor: r,
      etiqueta: ETIQUETA_ROL[r],
      descripcion: d.charAt(0).toUpperCase() + d.slice(1),
    };
  });
}

export async function opcionesSucursal(): Promise<OpcionSucursal[]> {
  const filas = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return filas.map((s) => ({ id: s.id, nombre: s.name }));
}
