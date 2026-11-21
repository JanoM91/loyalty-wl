'use client';

import type { ReactNode } from 'react';

/** Abre el cuadro de impresión del navegador (ahí también se guarda en PDF). */
export function Imprimir({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
