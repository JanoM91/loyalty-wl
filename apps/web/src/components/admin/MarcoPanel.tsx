import type { ReactNode } from 'react';
import { ROLES_DIRECCION } from '@wl/database';

import type { Sesion } from '@/lib/admin/sesion';
import { comandosDelPanel } from '@/lib/admin/panel';
import { salir } from '@/app/admin/entrar/acciones';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

import { AvisoClub } from './AvisoClub';
import { Paleta } from './Paleta';

/**
 * Marco de cada pantalla del panel, en el estilo del mapa del club: sin barra
 * de navegación fija. Arriba a la izquierda, la miga para volver al mapa; a la
 * derecha, la paleta de acciones (⌘K), que lleva a cualquier sección. El
 * permiso de verdad lo comprueba cada página, no este marco.
 */
export async function MarcoPanel({
  sesion,
  titulo,
  descripcion,
  acciones,
  children,
}: {
  sesion: Sesion;
  /** Ruta de la sección (se conserva por compatibilidad; la miga no la necesita). */
  actual?: string;
  titulo: string;
  descripcion?: string;
  /** Botones de la esquina, como "Nuevo producto". */
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const [negocio, base] = await Promise.all([exigirNegocio(), rutaBase()]);
  const conMapa = ROLES_DIRECCION.includes(sesion.rol);
  const comandos = comandosDelPanel(sesion.rol).map((c) => ({
    id: c.id,
    texto: c.texto,
    grupo: c.grupo,
    claves: c.claves,
    href: `${base}${c.ruta}`,
  }));

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <nav
          aria-label="Ubicación"
          className="flex min-w-0 items-center gap-2 text-[14px] text-muted"
        >
          {conMapa ? (
            <a
              href={`${base}/admin`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/70 px-4 font-semibold text-ink hover:bg-white"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
              {negocio.nombre}
            </a>
          ) : (
            <span className="font-semibold text-ink">{negocio.nombre}</span>
          )}
          <span aria-hidden="true">/</span>
          <span className="truncate font-semibold text-ink">{titulo}</span>
        </nav>

        <div className="flex items-center gap-3 text-[13px] text-muted">
          <Paleta
            comandos={comandos}
            buscarClientes={conMapa ? `${base}/admin/lealtad/tarjetas` : null}
          />
          {/* Cerrar sesión cambia el estado del servidor: va en un formulario y
              no en un enlace, que cualquier precarga podría disparar. */}
          <form action={salir}>
            <button type="submit" className="min-h-[44px] px-1 hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>

      <AvisoClub sesion={sesion} />

      <main id="contenido" className="mt-6 min-w-0">
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
