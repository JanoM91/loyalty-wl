import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { LogoMarca } from '@/components/Marca';
import { sesionActual } from '@/lib/admin/sesion';
import { iconosDeApp } from '@/lib/iconos-app';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

export async function generateMetadata(): Promise<Metadata> {
  const [negocio, base] = await Promise.all([exigirNegocio(), rutaBase()]);
  const { nombre } = negocio;
  const iconos = iconosDeApp(negocio, base);
  return {
    title: { default: 'Programa de lealtad', template: `%s · ${nombre}` },
    robots: { index: false, follow: false },
    // La tarjeta se puede agregar a la pantalla de inicio como una app. El
    // manifest es dinámico (lleva el acceso de esta sesión); ver
    // lealtad/manifest.webmanifest/route.ts.
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'black' },
    icons: {
      icon: [{ url: iconos.chico, sizes: '192x192', type: 'image/png' }],
      apple: [{ url: iconos.apple, sizes: '180x180', type: 'image/png' }],
    },
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
  const [negocio, base, panel] = await Promise.all([exigirNegocio(), rutaBase(), sesionActual()]);
  const sitio = negocio.marca.contacto.sitio;
  return (
    <div className="min-h-screen bg-crumb">
      {/* Quien tiene sesión en el panel de este club ve su tarjeta como la verá
          su cliente, con un regreso a su panel. Los clientes no la ven. */}
      {panel ? (
        <div className="flex items-center justify-between gap-3 bg-[#120A2A] py-2 pr-2.5 pl-4 text-[13px] text-[#FFF6EA]">
          <span>Así lo verá tu cliente</span>
          <a
            href={`${base}/admin`}
            className="inline-flex min-h-[40px] items-center rounded-[11px] bg-[#C6FF3D] px-3 font-bold text-[#120A2A]"
          >
            Volver a mi panel
          </a>
        </div>
      ) : null}
      {/* Con credenciales: el manifest personaliza start_url según la sesión. */}
      <link rel="manifest" href="/lealtad/manifest.webmanifest" crossOrigin="use-credentials" />
      <header className="mx-auto flex max-w-md items-center px-5 pt-5 pb-1">
        <a href="/lealtad" className="text-ink">
          <LogoMarca sobre="claro" className="h-8 text-[19px]" />
        </a>
      </header>

      <main id="contenido" className="mx-auto grid max-w-md gap-4 px-5 pt-4 pb-28">
        {children}
      </main>

      <footer className="mx-auto max-w-md px-5 pb-28 text-[13px] text-muted">
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
