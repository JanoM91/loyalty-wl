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

/**
 * Dirección base para las imágenes al compartir. Con `WL_DOMINIO_RAIZ` se usa
 * ese dominio; sin él, Next toma el de producción de Vercel.
 */
function baseDelSitio(): URL | undefined {
  const raiz = process.env.WL_DOMINIO_RAIZ?.trim();
  if (!raiz) return undefined;
  try {
    return new URL(`https://${raiz}`);
  } catch {
    return undefined;
  }
}

/**
 * Metadatos de una página del sitio. A diferencia de tarjetas y paneles, sí se
 * indexa. Lleva la marca de club-lealtad (favicon, ícono e imagen al compartir);
 * las tarjetas y paneles de cada negocio llevan la del negocio.
 */
export function metadatosDelSitio(titulo: string, descripcion: string): Metadata {
  const sitio = process.env.WL_NOMBRE_SITIO?.trim() || 'Club Lealtad';
  return {
    metadataBase: baseDelSitio(),
    title: { absolute: `${titulo} | ${sitio}` },
    description: descripcion,
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: '/club-lealtad-favicon.svg', type: 'image/svg+xml' },
        { url: '/club-lealtad-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: { url: '/club-lealtad-180.png', sizes: '180x180' },
    },
    openGraph: {
      type: 'website',
      locale: 'es_MX',
      siteName: sitio,
      title: titulo,
      description: descripcion,
      images: [
        {
          url: '/club-lealtad-compartir.png',
          width: 1200,
          height: 630,
          alt: 'club-lealtad: Sello a sello, eres VIP.',
        },
      ],
    },
  };
}
