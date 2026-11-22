import type { ReactNode } from 'react';
import type { SesionPlataforma } from '@wl/database';

import { LogotipoClub } from '@/components/ClubLealtad';

import { salir } from './acciones';

/** Marco del panel de plataforma: quién eres, a dónde vas y salir. */
export function MarcoPlataforma({
  sesion,
  titulo,
  descripcion,
  acciones,
  children,
}: {
  sesion: SesionPlataforma;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
        <a
          href="/plataforma"
          aria-label="club-lealtad, Plataforma"
          className="flex min-h-[44px] items-center gap-2.5 text-ink"
        >
          <LogotipoClub tam={19} />
          <span className="rounded-full bg-[#C6FF3D] px-2.5 py-1 text-[12px] font-bold text-[#120A2A]">
            Plataforma
          </span>
        </a>
        <nav aria-label="Secciones" className="flex gap-1 text-[15px]">
          <a href="/plataforma" className="rounded-full px-4 py-2 text-muted hover:text-ink">
            Negocios
          </a>
          <a href="/plataforma/nuevo" className="rounded-full px-4 py-2 text-muted hover:text-ink">
            Nuevo negocio
          </a>
          <a
            href="/plataforma/ajustes"
            className="rounded-full px-4 py-2 text-muted hover:text-ink"
          >
            Precios y Arcade
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[13px] text-muted">
          <span>{sesion.nombre}</span>
          <form action={salir}>
            <button type="submit" className="hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main id="contenido" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2rem,5vw,2.75rem)] text-ink">{titulo}</h1>
            {descripcion && (
              <p className="mt-2 max-w-prose text-[15px] text-muted">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
