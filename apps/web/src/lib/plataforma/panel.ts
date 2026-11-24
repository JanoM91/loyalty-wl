import { cache } from 'react';
import { estadoComercialDe, listarNegocios, type NegocioEnLista } from '@wl/database';

import type { NombreIcono } from '@/components/admin/Icono';

/** Dirección de la lista de clubes. Vive en el inicio para no ocupar un slug. */
export const RUTA_CLUBES = '/plataforma?vista=clubes';

export type IdSeccionPlataforma = 'inicio' | 'clubes' | 'nuevo' | 'avisos' | 'ajustes';

export interface SeccionPlataforma {
  readonly id: IdSeccionPlataforma;
  readonly texto: string;
  /** Una línea que explica la sección (paleta y tarjetas del inicio). */
  readonly descripcion: string;
  readonly ruta: string;
  readonly icono: NombreIcono;
  readonly grupo: 'principal' | 'administracion';
  /** Palabras extra para encontrarla en la paleta. */
  readonly claves?: string;
  /** Nombre corto para la barra inferior del celular; sin él, no va en la barra. */
  readonly enBarra?: string;
}

/**
 * Secciones del panel de plataforma, en el orden del menú. Una sola lista
 * alimenta el menú lateral, la barra inferior del celular y la paleta. El
 * permiso de verdad lo comprueba cada página con `exigirPlataforma()`.
 */
export const SECCIONES_PLATAFORMA: readonly SeccionPlataforma[] = [
  {
    id: 'inicio',
    texto: 'Inicio',
    descripcion: 'La plataforma hoy',
    ruta: '/plataforma',
    icono: 'inicio',
    grupo: 'principal',
    enBarra: 'Inicio',
  },
  {
    id: 'clubes',
    texto: 'Clubes',
    descripcion: 'Todos los programas de lealtad',
    ruta: RUTA_CLUBES,
    icono: 'tienda',
    grupo: 'principal',
    claves: 'negocios lista',
    enBarra: 'Clubes',
  },
  {
    id: 'nuevo',
    texto: 'Nuevo club',
    descripcion: 'Darlo de alta en una pantalla',
    ruta: '/plataforma/nuevo',
    icono: 'nuevo',
    grupo: 'principal',
    claves: 'crear negocio alta',
  },
  {
    id: 'avisos',
    texto: 'Avisos a dueños',
    descripcion: 'Escríbeles por correo a los dueños',
    ruta: '/plataforma/avisos',
    icono: 'chat',
    grupo: 'administracion',
    claves: 'correo mensaje comunicado comunicacion',
    enBarra: 'Avisos',
  },
  {
    id: 'ajustes',
    texto: 'Precios y Arcade',
    descripcion: 'Lo que se cobra y la plantilla del Arcade',
    ruta: '/plataforma/ajustes',
    icono: 'plan',
    grupo: 'administracion',
    claves: 'cobro juega y gana lite',
    enBarra: 'Precios',
  },
];

/** Los negocios, una sola consulta por petición: la usan el marco y la página. */
export const negociosDelPanel = cache((): Promise<NegocioEnLista[]> => listarNegocios());

/** Cómo está un club, en una palabra, para filtrar y etiquetar. */
export type EstadoClub = 'activo' | 'prueba' | 'pausa' | 'suspendido';

export function estadoDelClub(f: NegocioEnLista, ahora: Date = new Date()): EstadoClub {
  if (!f.negocio.activo) return 'suspendido';
  const comercial = estadoComercialDe(f.negocio, ahora);
  if (comercial === 'PRUEBA') return 'prueba';
  if (comercial === 'PAUSADO') return 'pausa';
  return 'activo';
}

/** «Buenos días», según la hora del centro de México. */
export function saludo(ahora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(ahora),
  );
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** «Lunes, 23 de noviembre», en la fecha del centro de México. */
export function fechaDeHoy(ahora: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(ahora);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
