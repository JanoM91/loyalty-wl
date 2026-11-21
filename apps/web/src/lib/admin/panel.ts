import type { CSSProperties } from 'react';
import type { UserRole } from '@wl/database';

type Rol = UserRole;

/**
 * Identidad del panel del negocio.
 *
 * El panel es la herramienta de club-lealtad, no una pantalla del negocio: se
 * ve siempre con los colores y la tipografía del servicio. La marca de cada
 * negocio aparece solo donde muestra lo que ven sus clientes (la tarjeta).
 * Estas variables reemplazan las de la marca dentro del panel.
 */
export const ESTILO_PANEL = {
  '--wl-fondo': '#06231C',
  '--wl-sobre': '#F1FBF6',
  '--wl-acento': '#00C389',
  '--wl-papel': '#F1FBF6',
  '--wl-tinta': '#06231C',
} as CSSProperties;

export interface ComandoPanel {
  readonly id: string;
  readonly texto: string;
  readonly grupo: string;
  /** Ruta interna sin el tramo del negocio: «/admin/lealtad/caja». */
  readonly ruta: string;
  /** Palabras extra para encontrarlo. */
  readonly claves?: string;
}

const DIRECCION: readonly Rol[] = ['ADMIN', 'DUENO', 'GERENTE'];
const ADMINISTRA: readonly Rol[] = ['ADMIN', 'DUENO'];

/** Las secciones del panel como comandos de la paleta, según el rol. */
export function comandosDelPanel(rol: Rol): ComandoPanel[] {
  const todos: (ComandoPanel & { roles: readonly Rol[] })[] = [
    {
      id: 'mapa',
      texto: 'Ver el mapa del club',
      grupo: 'Vista',
      ruta: '/admin',
      claves: 'inicio mapa club',
      roles: DIRECCION,
    },
    {
      id: 'caja',
      texto: 'Sumar sello de visita',
      grupo: 'Caja',
      ruta: '/admin/lealtad/caja',
      claves: 'caja escanear cobrar premio entregar',
      roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
    },
    {
      id: 'clientes',
      texto: 'Ver clientes y tarjetas',
      grupo: 'Clientes',
      ruta: '/admin/lealtad/tarjetas',
      claves: 'tarjetas clientes buscar',
      roles: DIRECCION,
    },
    {
      id: 'premio',
      texto: 'Cambiar el premio o los sellos',
      grupo: 'Premio',
      ruta: '/admin/lealtad/programa',
      claves: 'programa premio sellos reglas',
      roles: DIRECCION,
    },
    {
      id: 'sucursales',
      texto: 'Imprimir cartel QR',
      grupo: 'Sucursales',
      ruta: '/admin/lealtad/sucursales',
      claves: 'cartel qr sucursal codigo',
      roles: DIRECCION,
    },
    {
      id: 'numeros',
      texto: 'Ver cómo va el programa',
      grupo: 'Números',
      ruta: '/admin/lealtad/analitica',
      claves: 'analitica numeros reportes',
      roles: DIRECCION,
    },
    {
      id: 'pendientes',
      texto: 'Revisar visitas pendientes',
      grupo: 'Por revisar',
      ruta: '/admin/lealtad/pendientes',
      claves: 'pendientes revisar contingencia',
      roles: DIRECCION,
    },
    {
      id: 'marca',
      texto: 'Cambiar logotipo, colores y datos',
      grupo: 'Marca',
      ruta: '/admin/marca',
      claves: 'marca logo colores domicilio contacto',
      roles: ADMINISTRA,
    },
    {
      id: 'equipo',
      texto: 'Invitar a alguien de caja',
      grupo: 'Equipo',
      ruta: '/admin/usuarios',
      claves: 'usuarios equipo invitar',
      roles: ADMINISTRA,
    },
    {
      id: 'lugares',
      texto: 'Agregar o editar sucursales',
      grupo: 'Sucursales',
      ruta: '/admin/sucursales',
      claves: 'sucursales direccion horario',
      roles: DIRECCION,
    },
    {
      id: 'ayuda',
      texto: 'Ayuda',
      grupo: 'Ayuda',
      ruta: '/admin/ayuda',
      claves: 'como se usa ayuda',
      roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
    },
    {
      id: 'cuenta',
      texto: 'Mi cuenta y contraseña',
      grupo: 'Cuenta',
      ruta: '/admin/cuenta',
      claves: 'contraseña cuenta',
      roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
    },
  ];
  return todos.filter((c) => c.roles.includes(rol)).map(({ roles: _r, ...c }) => c);
}
