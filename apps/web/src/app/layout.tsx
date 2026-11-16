import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/onest';
import './globals.css';

import { negocioDeLaPeticion } from '@/lib/negocio';
import { ProveedorMarca } from '@/components/Marca';
import { estiloDeMarca, marcaVisible } from '@/lib/marca';

export async function generateMetadata(): Promise<Metadata> {
  const negocio = await negocioDeLaPeticion();
  const nombre = negocio?.nombre ?? 'Loyalty WL';
  return {
    title: { default: nombre, template: `%s | ${nombre}` },
    description: negocio
      ? `Programa de lealtad de ${negocio.nombre}.`
      : 'Programas de lealtad para negocios.',
    // Las tarjetas y los paneles no se indexan.
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const negocio = await negocioDeLaPeticion();
  return (
    <html
      lang="es-MX"
      data-plantilla={negocio?.marca.plantilla ?? 'aire'}
      style={negocio ? estiloDeMarca(negocio) : undefined}
    >
      <body>
        <ProveedorMarca marca={negocio ? marcaVisible(negocio) : null}>{children}</ProveedorMarca>
      </body>
    </html>
  );
}
