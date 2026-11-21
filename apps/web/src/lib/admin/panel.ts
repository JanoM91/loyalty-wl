import type { CSSProperties } from 'react';
import type { UserRole } from '@wl/database';

import type { NombreIcono } from '@/components/admin/Icono';

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
const TODOS: readonly Rol[] = ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL', 'MARKETING', 'LECTOR'];
const CAJA: readonly Rol[] = ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'];

export type GrupoSeccion = 'principal' | 'programa' | 'clientes' | 'negocio' | 'cuenta';

export interface SeccionPanel {
  readonly id: string;
  readonly texto: string;
  /** Una línea para la lista de «Más». */
  readonly descripcion: string;
  /** Ruta interna sin el tramo del negocio. */
  readonly ruta: string;
  readonly icono: NombreIcono;
  readonly grupo: GrupoSeccion;
  /** Otras rutas que cuentan como esta sección para marcarla activa. */
  readonly tambien?: readonly string[];
  readonly roles: readonly Rol[];
}

/**
 * Secciones del panel, en el orden del menú. Una sola lista alimenta el menú
 * lateral, la barra inferior del celular y la pantalla «Más». El permiso de
 * verdad lo comprueba cada página; esto solo decide qué se ofrece.
 */
const SECCIONES: readonly SeccionPanel[] = [
  {
    id: 'inicio',
    texto: 'Inicio',
    descripcion: 'Tu club hoy',
    ruta: '/admin',
    icono: 'inicio',
    grupo: 'principal',
    roles: DIRECCION,
  },
  {
    id: 'caja',
    texto: 'Caja',
    descripcion: 'Sumar sellos y entregar premios',
    ruta: '/admin/lealtad/caja',
    icono: 'caja',
    grupo: 'principal',
    roles: CAJA,
  },
  {
    id: 'clientes',
    texto: 'Clientes',
    descripcion: 'Tarjetas, sellos y premios',
    ruta: '/admin/lealtad/tarjetas',
    icono: 'clientes',
    grupo: 'clientes',
    roles: DIRECCION,
  },
  {
    id: 'premio',
    texto: 'Premio y reglas',
    descripcion: 'Sellos, premio y términos',
    ruta: '/admin/lealtad/programa',
    icono: 'reglas',
    grupo: 'programa',
    roles: DIRECCION,
  },
  {
    id: 'sucursales',
    texto: 'Sucursales y carteles QR',
    descripcion: 'Imprime o comparte tu QR',
    ruta: '/admin/lealtad/sucursales',
    icono: 'qr',
    grupo: 'programa',
    roles: DIRECCION,
  },
  {
    id: 'pendientes',
    texto: 'Por revisar',
    descripcion: 'Visitas que la caja te dejó',
    ruta: '/admin/lealtad/pendientes',
    icono: 'revisar',
    grupo: 'programa',
    roles: DIRECCION,
  },
  {
    id: 'numeros',
    texto: 'Números',
    descripcion: 'Quién vuelve y cuánto',
    ruta: '/admin/lealtad/analitica',
    icono: 'numeros',
    grupo: 'clientes',
    tambien: ['/admin/lealtad'],
    roles: DIRECCION,
  },
  {
    id: 'marca',
    texto: 'Marca y datos',
    descripcion: 'Logotipo, colores, contacto y domicilio',
    ruta: '/admin/marca',
    icono: 'marca',
    grupo: 'negocio',
    roles: ADMINISTRA,
  },
  {
    id: 'equipo',
    texto: 'Equipo',
    descripcion: 'Invita a quien atiende tu caja',
    ruta: '/admin/usuarios',
    icono: 'equipo',
    grupo: 'negocio',
    roles: ADMINISTRA,
  },
  {
    id: 'lugares',
    texto: 'Direcciones y contacto',
    descripcion: 'Dirección y WhatsApp de cada sucursal',
    ruta: '/admin/sucursales',
    icono: 'tienda',
    grupo: 'negocio',
    roles: DIRECCION,
  },
  {
    id: 'plan',
    texto: 'Mi plan',
    descripcion: 'Prueba, pago y precio',
    ruta: '/admin/plan',
    icono: 'plan',
    grupo: 'negocio',
    roles: ADMINISTRA,
  },
  {
    id: 'ayuda',
    texto: 'Ayuda',
    descripcion: 'Cómo se usa, paso a paso',
    ruta: '/admin/ayuda',
    icono: 'ayuda',
    grupo: 'cuenta',
    roles: TODOS,
  },
  {
    id: 'cuenta',
    texto: 'Mi cuenta',
    descripcion: 'Contraseña y sesiones',
    ruta: '/admin/cuenta',
    icono: 'cuenta',
    grupo: 'cuenta',
    roles: TODOS,
  },
];

export const TITULOS_GRUPO: Record<GrupoSeccion, string> = {
  principal: 'Lo de todos los días',
  programa: 'Tu programa',
  clientes: 'Tus clientes',
  negocio: 'Tu negocio',
  cuenta: 'Cuenta',
};

/** Las secciones que este rol puede abrir, en el orden del menú. */
export function seccionesDelPanel(rol: Rol): SeccionPanel[] {
  return SECCIONES.filter((s) => s.roles.includes(rol));
}

/** La sección a la que pertenece una ruta del panel («/admin/lealtad/tarjetas/ABC»). */
export function seccionActiva(ruta: string | null): string | null {
  if (!ruta) return null;
  if (ruta === '/admin/mas') return 'mas';
  let mejor: { id: string; largo: number } | null = null;
  for (const s of SECCIONES) {
    for (const r of [s.ruta, ...(s.tambien ?? [])]) {
      const coincide = r === '/admin' ? ruta === '/admin' : ruta === r || ruta.startsWith(`${r}/`);
      if (coincide && (!mejor || r.length > mejor.largo)) mejor = { id: s.id, largo: r.length };
    }
  }
  return mejor?.id ?? null;
}

export interface PestanaInferior {
  readonly id: string;
  readonly texto: string;
  readonly ruta: string;
  readonly icono: NombreIcono;
}

/**
 * Barra inferior del celular: Inicio, Caja, Clientes y Más para quien dirige;
 * para las demás cuentas, sus pocas secciones.
 */
export function barraInferior(rol: Rol): PestanaInferior[] {
  const mias = seccionesDelPanel(rol);
  if (mias.some((s) => s.id === 'inicio')) {
    const base = ['inicio', 'caja', 'clientes']
      .map((id) => mias.find((s) => s.id === id))
      .filter((s): s is SeccionPanel => Boolean(s))
      .map(({ id, texto, ruta, icono }) => ({ id, texto, ruta, icono }));
    return [...base, { id: 'mas', texto: 'Más', ruta: '/admin/mas', icono: 'mas' }];
  }
  return mias.slice(0, 4).map(({ id, texto, ruta, icono }) => ({ id, texto, ruta, icono }));
}

/** Las secciones del panel como comandos de la paleta, según el rol. */
export function comandosDelPanel(rol: Rol): ComandoPanel[] {
  const todos: (ComandoPanel & { roles: readonly Rol[] })[] = [
    {
      id: 'inicio',
      texto: 'Ir al inicio',
      grupo: 'Inicio',
      ruta: '/admin',
      claves: 'inicio resumen hoy club',
      roles: DIRECCION,
    },
    {
      id: 'caja',
      texto: 'Sumar sello de visita',
      grupo: 'Caja',
      ruta: '/admin/lealtad/caja?accion=sumar',
      claves: 'caja escanear visita',
      roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
    },
    {
      id: 'premio-entregar',
      texto: 'Entregar premio',
      grupo: 'Caja',
      ruta: '/admin/lealtad/caja?accion=premio',
      claves: 'caja cobrar canjear premio',
      roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
    },
    {
      id: 'caja-abrir',
      texto: 'Abrir la caja',
      grupo: 'Caja',
      ruta: '/admin/lealtad/caja',
      claves: 'caja hoy operaciones sin tarjeta',
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
      id: 'plan',
      texto: 'Ver mi plan y activar',
      grupo: 'Cuenta',
      ruta: '/admin/plan',
      claves: 'plan pago precio prueba activar',
      roles: ADMINISTRA,
    },
    {
      id: 'cuenta',
      texto: 'Mi cuenta y contraseña',
      grupo: 'Cuenta',
      ruta: '/admin/cuenta',
      claves: 'contraseña cuenta',
      roles: TODOS,
    },
  ];
  return todos.filter((c) => c.roles.includes(rol)).map(({ roles: _r, ...c }) => c);
}
