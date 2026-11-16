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

export const ROLES_USUARIO: readonly UserRole[] = [
  'ADMIN',
  'DUENO',
  'GERENTE',
  'SUCURSAL',
  'MARKETING',
  'LECTOR',
];

export const ETIQUETA_ROL: Record<UserRole, string> = {
  ADMIN: 'Administración',
  DUENO: 'Dueño',
  GERENTE: 'Gerencia',
  SUCURSAL: 'Sucursal',
  MARKETING: 'Marketing',
  LECTOR: 'Solo lectura',
};

export const DESCRIPCION_ROLES: Record<UserRole, string> = {
  ADMIN: 'todo, incluidos usuarios y datos sensibles',
  DUENO: 'lo mismo que gerencia; su cuenta se distingue en la bitácora',
  GERENTE: 'productos, precios, costos, sucursales, contenido y programa de lealtad',
  SUCURSAL: 'disponibilidad diaria y caja de lealtad de su sucursal',
  MARKETING: 'textos, promociones y contenido; no toca precios',
  LECTOR: 'solo mirar',
};

/**
 * Quién dirige el negocio: ve y edita todo el panel salvo usuarios.
 * Las cuentas de sucursal solo operan la caja de lealtad.
 */
export const ROLES_DIRECCION: readonly UserRole[] = ['ADMIN', 'DUENO', 'GERENTE'];

export function esRol(valor: string): valor is UserRole {
  return (ROLES_USUARIO as readonly string[]).includes(valor);
}
