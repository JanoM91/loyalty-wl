import type { Metadata } from 'next';

import { LogotipoClub } from '@/components/ClubLealtad';

import { FormularioRecuperar } from '../../equipo/Formularios';

export const metadata: Metadata = { title: 'Recuperar contraseña' };
export const dynamic = 'force-dynamic';

export default function RecuperarPlataformaPage() {
  return (
    <main id="contenido" className="mx-auto grid min-h-screen max-w-sm content-center gap-8 px-5">
      <div className="grid gap-2">
        <LogotipoClub tam={22} />
        <h1 className="mt-4 text-4xl">¿Olvidaste tu contraseña?</h1>
        <p className="text-[15px] text-muted">
          Te mandamos un enlace para elegir una nueva. Vence en una hora.
        </p>
      </div>
      <FormularioRecuperar />
      <a href="/plataforma/entrar" className="text-[15px] text-ink underline underline-offset-4">
        Volver a entrar
      </a>
    </main>
  );
}
