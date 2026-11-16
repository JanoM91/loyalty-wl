import type { UserRole } from '@prisma/client';

/**
 * Roles del panel y qué puede hacer cada uno.
 *
 * Vive aparte, sin tocar la base, para que lo usen igual la pantalla de
 * usuarios y el script `pnpm admin:usuario`: si la descripción de un rol
 * cambia, cambia en los dos sitios a la vez.
 *
 * Lo que cada rol puede hacer de verdad lo decide cada página con
 * `exigirRol(...)`. Estas descripciones lo resumen para quien da de alta.
 */

/**
 * Roles que se pueden asignar desde el panel. `MARKETING` y `LECTOR` existen en
 * la base para cuando lleguen las campañas; hoy no tienen pantallas y no se
 * ofrecen.
 */
export const ROLES_USUARIO: readonly UserRole[] = ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'];

export const ETIQUETA_ROL: Record<UserRole, string> = {
  ADMIN: 'Administración',
  DUENO: 'Dueño',
  GERENTE: 'Gerencia',
  SUCURSAL: 'Sucursal',
  MARKETING: 'Marketing',
  LECTOR: 'Solo lectura',
};

export const DESCRIPCION_ROLES: Record<UserRole, string> = {
  ADMIN: 'todo, incluidos los usuarios del panel',
  DUENO: 'todo, incluidos los usuarios; su cuenta se distingue en la bitácora',
  GERENTE: 'programa de lealtad, sucursales, tarjetas y reportes; no administra usuarios',
  SUCURSAL: 'solo la caja de lealtad de su sucursal',
  MARKETING: 'reservado para campañas; todavía sin pantallas',
  LECTOR: 'reservado; todavía sin pantallas',
};

/**
 * Quién dirige el negocio: ve y edita el programa, las sucursales y los
 * reportes. Las cuentas de sucursal solo operan la caja de lealtad.
 */
export const ROLES_DIRECCION: readonly UserRole[] = ['ADMIN', 'DUENO', 'GERENTE'];

/** Quién da de alta, cambia y desactiva las cuentas del panel. */
export const ROLES_USUARIOS: readonly UserRole[] = ['ADMIN', 'DUENO'];

export function esRol(valor: string): valor is UserRole {
  return (ROLES_USUARIO as readonly string[]).includes(valor);
}
