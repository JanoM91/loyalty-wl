import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@fontsource-variable/fredoka';

import { ESTILO_PANEL } from '@/lib/admin/panel';

export const metadata: Metadata = {
  title: { default: 'Plataforma', template: '%s · Plataforma' },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Panel de plataforma (Exkalibur). No comprueba la sesión aquí: cada página
 * llama a `exigirPlataforma()`. Lleva la identidad de club-lealtad, igual que
 * el panel del dueño.
 */
export default function PlataformaLayout({ children }: { children: ReactNode }) {
  return (
    <div data-plantilla="aire" style={ESTILO_PANEL} className="min-h-screen bg-crumb text-ink">
      {children}
    </div>
  );
}
