import { DESCRIPCION_ROLES, ETIQUETA_ROL, ROLES_USUARIO, prisma } from '@wl/database';

import type { OpcionRol, OpcionSucursal } from './FormularioUsuario';

/** Datos que los formularios (navegador) no pueden pedir a la base por su cuenta. */

export function opcionesRol(): OpcionRol[] {
  return ROLES_USUARIO.map((r) => {
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
