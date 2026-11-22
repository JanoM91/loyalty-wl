import type { Metadata } from 'next';

import { LogotipoClub } from '@/components/ClubLealtad';

import { FormularioEntrar } from './FormularioEntrar';

export const metadata: Metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default function EntrarPlataformaPage() {
  return (
    <main id="contenido" className="mx-auto grid min-h-screen max-w-sm content-center gap-8 px-5">
      <div className="grid gap-2">
        <LogotipoClub tam={22} />
        <h1 className="mt-4 text-4xl">Plataforma</h1>
        <p className="text-[15px] text-muted">Acceso del equipo de Exkalibur.</p>
      </div>
      <FormularioEntrar />
    </main>
  );
}
