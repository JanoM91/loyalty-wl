import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { negocioDeLaPeticion } from '@/lib/negocio';

/**
 * El sitio del servicio (inicio, cómo funciona, negocios, gamificación, planes
 * y guía) solo existe en la instalación compartida y fuera de la dirección de
 * un negocio. En una instalación privada o en un subdominio, esas rutas dan 404.
 */
export async function exigirSitioDelServicio(): Promise<void> {
  if (await negocioDeLaPeticion()) notFound();
}

/** Metadatos de una página del sitio. A diferencia de tarjetas y paneles, sí se indexa. */
export function metadatosDelSitio(titulo: string, descripcion: string): Metadata {
  const sitio = process.env.WL_NOMBRE_SITIO?.trim() || 'Club Lealtad';
  return {
    title: { absolute: `${titulo} | ${sitio}` },
    description: descripcion,
    robots: { index: true, follow: true },
  };
}
