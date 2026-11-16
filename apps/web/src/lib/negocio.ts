import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { negocioPorSlug, type Negocio } from '@wl/database';

/**
 * El negocio de la petición en curso.
 *
 * El middleware saca el subdominio del `Host` y lo deja en la cabecera
 * `x-wl-negocio` (pisando cualquier valor que mande el navegador). Aquí se
 * busca ese negocio en la base, una sola vez por petición.
 *
 * `instrumentation.ts` registra `negocioDeLaPeticion` como resolutor del
 * paquete de datos: por eso las páginas y acciones llaman a las funciones de
 * `@wl/database` sin pasar el negocio, y aun así cada consulta queda acotada.
 */

/** Cabecera interna con el subdominio. Solo la escribe el middleware. */
export const CABECERA_NEGOCIO = 'x-wl-negocio';
/** Cabecera interna con la dirección base del negocio: "https://sitio.mx/cafe". */
export const CABECERA_ORIGEN = 'x-wl-origen';

// Un negocio suspendido no atiende: ni su tarjeta ni su panel.
const buscar = cache(async (slug: string): Promise<Negocio | null> => {
  const negocio = await negocioPorSlug(slug);
  return negocio?.activo ? negocio : null;
});

/** El negocio del subdominio, o null si la petición no es de ningún negocio. */
export async function negocioDeLaPeticion(): Promise<Negocio | null> {
  let slug: string | null;
  try {
    slug = (await headers()).get(CABECERA_NEGOCIO);
  } catch {
    // Fuera de una petición (un script, una tarea): no hay subdominio.
    return null;
  }
  if (!slug) return null;
  return buscar(slug);
}

/** El negocio de la petición. Si no existe, 404. */
export async function exigirNegocio(): Promise<Negocio> {
  const negocio = await negocioDeLaPeticion();
  if (!negocio) notFound();
  return negocio;
}

/** Origen público de la petición, sin barra final: "https://cafe.ejemplo.mx". */
export async function origenDeLaPeticion(): Promise<string> {
  const h = await headers();
  const origen = h.get(CABECERA_ORIGEN);
  if (origen) return origen;
  const host = h.get('host') ?? 'localhost';
  return `${host.startsWith('localhost') || host.includes('.localhost') ? 'http' : 'https'}://${host}`;
}

/** Dirección para mostrar, sin protocolo: "cafe.ejemplo.mx". */
export async function sitioDeLaPeticion(): Promise<string> {
  return (await origenDeLaPeticion()).replace(/^https?:\/\//, '');
}

/**
 * Tramo del negocio en la dirección: "/cafe" en la instalación compartida por
 * ruta; "" en la privada y por subdominio. Es también la ruta de sus cookies.
 */
export async function rutaBase(): Promise<string> {
  return (await headers()).get('x-wl-base') ?? '';
}

/**
 * Una ruta interna con el tramo del negocio delante: `/lealtad` → `/cafe/lealtad`
 * en la instalación compartida. Úsala en toda redirección:
 * `redirect(await ruta('/lealtad'))`.
 */
export async function ruta(interna: string): Promise<string> {
  return `${await rutaBase()}${interna}`;
}
