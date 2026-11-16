import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Plataforma', template: '%s · Plataforma' },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Panel de plataforma (Exkalibur). No comprueba la sesión aquí: cada página
 * llama a `exigirPlataforma()`.
 */
export default function PlataformaLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-crumb">{children}</div>;
}
