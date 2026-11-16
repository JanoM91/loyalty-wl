'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * La marca del negocio, disponible en cualquier componente.
 *
 * El layout raíz la lee de la base (por el subdominio) y la reparte por
 * contexto, para que la tarjeta, la cabecera o el cartel la pinten sin que
 * cada pantalla tenga que pasarla a mano.
 */
export interface MarcaVisible {
  readonly nombre: string;
  /** Logotipo para fondos oscuros. Null: se escribe el nombre. */
  readonly logoClaroUrl: string | null;
  /** Logotipo para fondos claros. */
  readonly logoUrl: string | null;
  /** Isotipo: es el sello de cada estampa. Null: una palomita. */
  readonly iconoUrl: string | null;
  /** Ejemplo de código de tarjeta: "CB-XXXX-XXXX". */
  readonly ejemploCodigo: string;
  readonly prefijoCodigo: string;
}

const SIN_MARCA: MarcaVisible = {
  nombre: 'Programa de lealtad',
  logoClaroUrl: null,
  logoUrl: null,
  iconoUrl: null,
  ejemploCodigo: 'WL-XXXX-XXXX',
  prefijoCodigo: 'WL',
};

const Contexto = createContext<MarcaVisible>(SIN_MARCA);

export function ProveedorMarca({
  marca,
  children,
}: {
  marca: MarcaVisible | null;
  children: ReactNode;
}) {
  return <Contexto.Provider value={marca ?? SIN_MARCA}>{children}</Contexto.Provider>;
}

export function useMarca(): MarcaVisible {
  return useContext(Contexto);
}

/**
 * El logotipo del negocio. Si todavía no subió uno, su nombre con la
 * tipografía de títulos: nunca queda un hueco ni la marca de otro.
 */
export function LogoMarca({
  sobre,
  className = '',
}: {
  /** Sobre qué fondo va: `oscuro` (cabecera, tarjeta) o `claro` (cartel, panel). */
  sobre: 'oscuro' | 'claro';
  className?: string;
}) {
  const marca = useMarca();
  const url = sobre === 'oscuro' ? marca.logoClaroUrl : marca.logoUrl;
  if (url) return <img src={url} alt={marca.nombre} className={`w-auto ${className}`} />;
  return (
    <span className={`font-display leading-tight font-bold tracking-wide ${className}`}>
      {marca.nombre}
    </span>
  );
}
