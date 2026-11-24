import type { Metadata } from 'next';

import { LogotipoClub } from '@/components/ClubLealtad';

import { FormularioEntrar } from './FormularioEntrar';

export const metadata: Metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function EntrarPlataformaPage({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string }>;
}) {
  const { contrasena } = await searchParams;
  return (
    <main id="contenido" className="mx-auto grid min-h-screen max-w-sm content-center gap-8 px-5">
      <div className="grid gap-2">
        <LogotipoClub tam={22} />
        <h1 className="mt-4 text-4xl">Plataforma</h1>
        <p className="text-[15px] text-muted">Acceso del equipo de Exkalibur.</p>
      </div>
      {contrasena === 'lista' && (
        <p role="status" className="rounded-[14px] bg-ink px-4 py-3 text-[15px] text-cream">
          Tu contraseña quedó guardada. Ya puedes entrar.
        </p>
      )}
      <FormularioEntrar />
      <a
        href="/plataforma/entrar/recuperar"
        className="text-[15px] text-ink underline underline-offset-4"
      >
        ¿Olvidaste tu contraseña?
      </a>
    </main>
  );
}
