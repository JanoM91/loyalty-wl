import type { CSSProperties, ReactNode } from 'react';

/**
 * Devuelve la marca del negocio a lo que muestra lo que ven sus clientes (su
 * tarjeta) dentro del panel, que por lo demás usa la identidad de club-lealtad.
 */
export function MarcaDelNegocio({
  estilo,
  plantilla,
  children,
}: {
  estilo: CSSProperties;
  plantilla: string;
  children: ReactNode;
}) {
  return (
    <div data-plantilla={plantilla} style={estilo}>
      {children}
    </div>
  );
}
