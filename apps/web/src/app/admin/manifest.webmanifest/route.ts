import { NextResponse } from 'next/server';

import { iconosDeApp } from '@/lib/iconos-app';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

/**
 * Manifest del panel como aplicación: <sitio>/<club>/admin.
 *
 * Es público (el middleware lo deja pasar sin sesión) porque Android lo pide
 * sin cookies. No lleva datos de la sesión: solo el nombre del club y la
 * dirección de su panel. La app instalada no comparte cookies con el
 * navegador en iOS, así que la primera vez pide entrar con la contraseña.
 *
 * El ícono lleva siempre la marca del negocio (decisión de Jano, 21 nov
 * 2026). El nombre bajo el ícono, «Mi panel», lo distingue de la tarjeta.
 */
export async function GET() {
  const negocio = await exigirNegocio();
  const base = await rutaBase();
  const iconos = iconosDeApp(negocio, base);
  const c = negocio.marca.colores;
  const manifest = {
    name: `${negocio.nombre} · Panel de club-lealtad`,
    short_name: 'Mi panel',
    description: `Panel de ${negocio.nombre}: suma sellos, entrega premios y ve tus números.`,
    id: `${base}/admin`,
    start_url: `${base}/admin`,
    scope: `${base}/admin`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: c.fondo,
    theme_color: '#F1FBF6',
    lang: 'es-MX',
    icons: [
      { src: iconos.chico, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconos.grande, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconos.grande, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
