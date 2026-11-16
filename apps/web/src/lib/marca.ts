import type { CSSProperties } from 'react';
import type { Negocio } from '@wl/database';

import type { MarcaVisible } from '@/components/Marca';

/**
 * Los colores de la marca del negocio como variables CSS.
 *
 * Se ponen en el `<html>` y reemplazan los tokens de `globals.css`. Así cada
 * negocio se ve con sus colores sin recompilar los estilos.
 */
export function estiloDeMarca(negocio: Negocio): CSSProperties {
  const c = negocio.marca.colores;
  return {
    '--color-ink': c.fondo,
    '--color-cream': c.sobreFondo,
    '--color-crust': c.acento,
    '--color-crust-light': c.acento,
    '--color-crust-dark': c.tinta,
    '--color-ink-soft': c.tinta,
    '--color-crumb': c.papel,
  } as CSSProperties;
}

/** Lo que los componentes necesitan de la marca (ver components/Marca.tsx). */
export function marcaVisible(negocio: Negocio): MarcaVisible {
  return {
    nombre: negocio.nombre,
    logoClaroUrl: negocio.marca.logoClaroUrl,
    logoUrl: negocio.marca.logoUrl,
    iconoUrl: negocio.marca.iconoUrl,
    ejemploCodigo: `${negocio.prefijoCodigo}-XXXX-XXXX`,
    prefijoCodigo: negocio.prefijoCodigo,
  };
}
