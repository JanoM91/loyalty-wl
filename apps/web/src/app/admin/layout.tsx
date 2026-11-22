import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@fontsource-variable/fredoka';

import { ESTILO_PANEL } from '@/lib/admin/panel';
import { iconosDeApp } from '@/lib/iconos-app';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

export async function generateMetadata(): Promise<Metadata> {
  const [base, negocio] = await Promise.all([rutaBase(), exigirNegocio()]);
  const iconos = iconosDeApp(negocio, base);
  return {
    title: { default: 'Panel', template: '%s · Panel' },
    // El panel nunca debe aparecer en un buscador. También está bloqueado en
    // robots.ts, pero esa es una petición y esto es una instrucción directa.
    robots: { index: false, follow: false, nocache: true },
    // Se puede instalar en el celular: «Agregar a pantalla de inicio».
    manifest: `${base}/admin/manifest.webmanifest`,
    applicationName: 'Mi panel',
    appleWebApp: { capable: true, title: 'Mi panel', statusBarStyle: 'default' },
    // Ícono con la marca del negocio, como su tarjeta.
    icons: {
      icon: [{ url: iconos.chico, sizes: '192x192', type: 'image/png' }],
      apple: [{ url: iconos.apple, sizes: '180x180', type: 'image/png' }],
    },
  };
}

export const viewport: Viewport = { themeColor: '#FFF6EA' };

/**
 * Contenedor del panel.
 *
 * Deliberadamente no comprueba la sesión: en Next, un layout no se vuelve a
 * ejecutar al navegar entre páginas de la misma sección, así que una
 * comprobación aquí se saltaría en la segunda pantalla. Cada página llama a
 * `exigirSesion()` por su cuenta. Ver `lib/admin/sesion.ts`.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // El panel es de un negocio: en una dirección que no es de ninguno, 404.
  await exigirNegocio();
  // El panel se ve con la identidad de club-lealtad, no con la del negocio:
  // la plantilla «aire» y sus colores reemplazan los de la marca aquí dentro.
  return (
    <div data-plantilla="aire" style={ESTILO_PANEL} className="min-h-screen bg-crumb text-ink">
      {children}
    </div>
  );
}
