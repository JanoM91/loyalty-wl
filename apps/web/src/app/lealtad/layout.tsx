import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { LogoMarca } from '@/components/Marca';
import { exigirNegocio } from '@/lib/negocio';

export async function generateMetadata(): Promise<Metadata> {
  const { nombre } = await exigirNegocio();
  return {
    title: { default: 'Programa de lealtad', template: `%s · ${nombre}` },
    robots: { index: false, follow: false },
    // La tarjeta se puede agregar a la pantalla de inicio como una app. El
    // manifest es dinámico (lleva el acceso de esta sesión); ver
    // lealtad/manifest.webmanifest/route.ts.
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'black' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await exigirNegocio()).marca.colores.fondo };
}

/**
 * Contenedor del programa de lealtad: <negocio>.<dominio>/lealtad.
 *
 * Es una aplicación de una columna pensada para el celular, con la marca
 * arriba y los enlaces legales abajo. No lleva el encabezado del sitio:
 * quien abre su tarjeta frente a la caja necesita su código, no el menú.
 */
export default async function LealtadLayout({ children }: { children: ReactNode }) {
  const negocio = await exigirNegocio();
  const sitio = negocio.marca.contacto.sitio;
  return (
    <div className="min-h-screen bg-crumb">
      {/* Con credenciales: el manifest personaliza start_url según la sesión. */}
      <link rel="manifest" href="/lealtad/manifest.webmanifest" crossOrigin="use-credentials" />
      <header className="bg-ink text-cream">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <a
            href="/lealtad"
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
          >
            <LogoMarca sobre="oscuro" className="h-9 text-xl" />
          </a>
          <span className="text-[11px] font-semibold tracking-[0.16em] text-crust-light uppercase">
            Lealtad
          </span>
        </div>
      </header>

      <main id="contenido" className="mx-auto grid max-w-md gap-4 px-4 pt-5 pb-28">
        {children}
      </main>

      <footer className="mx-auto max-w-md px-4 pb-24 text-xs text-muted">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/lealtad/terminos" className="underline underline-offset-4 hover:text-ink">
            Términos del programa
          </a>
          <a href="/lealtad/privacidad" className="underline underline-offset-4 hover:text-ink">
            Aviso de privacidad
          </a>
          {sitio ? (
            <a href={sitio} className="underline underline-offset-4 hover:text-ink">
              {sitio.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : null}
        </nav>
      </footer>
    </div>
  );
}
