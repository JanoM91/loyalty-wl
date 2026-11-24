import type { ReactNode } from 'react';
import type { SesionPlataforma } from '@wl/database';

import { Icono } from '@/components/admin/Icono';
import { Paleta } from '@/components/admin/Paleta';
import { LogotipoClub } from '@/components/ClubLealtad';
import {
  PESTANA_MAS,
  SECCIONES_PLATAFORMA,
  SECCION_CUENTA,
  estadoDelClub,
  negociosDelPanel,
  type IdSeccionPlataforma,
} from '@/lib/plataforma/panel';

import { salir } from './acciones';

const FONDO_PUNTEADO =
  'bg-[radial-gradient(#E3D5C3_1.2px,transparent_1.2px)] [background-size:24px_24px]';

/**
 * Marco del panel de plataforma: un panel tradicional pensado primero para el
 * celular, igual que el del dueño. En la computadora, menú lateral oscuro con
 * las secciones; en el celular, barra inferior. La búsqueda (paleta ⌘K)
 * encuentra secciones y clubes. El permiso lo comprueba cada página.
 */
export async function MarcoPlataforma({
  sesion,
  actual,
  titulo,
  antetitulo,
  descripcion,
  acciones,
  miga,
  buscadorGrande = false,
  enTarjeta = false,
  children,
}: {
  sesion: SesionPlataforma;
  /** La sección que se marca en el menú. */
  actual: IdSeccionPlataforma;
  titulo: string;
  /** Línea chica arriba del título, como la fecha de hoy. */
  antetitulo?: string;
  descripcion?: string;
  /** Botones junto al título. */
  acciones?: ReactNode;
  /** Paso anterior, p. ej. «Clubes» en la ficha de un club. */
  miga?: { readonly texto: string; readonly ruta: string };
  /** La búsqueda como barra grande bajo el título (el inicio). */
  buscadorGrande?: boolean;
  /** El contenido dentro de una tarjeta blanca (formularios y fichas). */
  enTarjeta?: boolean;
  children: ReactNode;
}) {
  const negocios = await negociosDelPanel();
  const enPausa = negocios.filter((f) => estadoDelClub(f) === 'pausa').length;
  const insignia = (id: IdSeccionPlataforma) => (id === 'clubes' && enPausa > 0 ? enPausa : null);

  // Verbos primero; después, cada club por su nombre, su dirección o su dueño.
  const comandos = [
    ...[...SECCIONES_PLATAFORMA, SECCION_CUENTA].map((s) => ({
      id: `seccion-${s.id}`,
      texto: s.texto,
      grupo: 'Ir a',
      claves: `${s.descripcion} ${s.claves ?? ''}`,
      href: s.ruta,
    })),
    {
      id: 'exportar',
      texto: 'Descargar clubes y dueños (Excel)',
      grupo: 'Hacer',
      claves: 'exportar csv excel lista correos whatsapp',
      href: '/plataforma/exportar',
    },
    ...negocios.map(({ negocio }) => ({
      id: `club-${negocio.id}`,
      texto: negocio.nombre,
      grupo: 'Club',
      claves: `${negocio.slug} ${negocio.ajustes.alta?.correo ?? ''} ${negocio.ajustes.alta?.whatsapp ?? ''}`,
      href: `/plataforma/${negocio.slug}`,
    })),
  ];
  const paleta = (
    <Paleta
      variante={buscadorGrande ? 'barra' : 'buscar'}
      comandos={comandos}
      buscarClientes={null}
      etiqueta="Buscar un club o una sección"
      marcador="Nombre del club, su dirección o el correo del dueño…"
      sugerencia="Prueba con el nombre del club o con «precios»."
    />
  );

  const enlaceMenu = (s: (typeof SECCIONES_PLATAFORMA)[number]) => {
    const on = s.id === actual;
    const n = insignia(s.id);
    return (
      <li key={s.id}>
        <a
          href={s.ruta}
          aria-current={on ? 'page' : undefined}
          className={`flex min-h-[46px] items-center gap-3 rounded-[13px] px-3.5 text-[15px] font-semibold transition-colors ${on ? 'bg-[#C6FF3D] text-[#120A2A]' : 'text-[#FFF6EA]/85 hover:bg-white/10 hover:text-[#FFF6EA]'}`}
        >
          <Icono nombre={s.icono} tam={20} />
          <span className="min-w-0 flex-1 truncate">{s.texto}</span>
          {n ? (
            <span
              className={`grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-[12px] font-bold ${on ? 'bg-[#120A2A] text-[#FFF6EA]' : 'bg-[#FF5B3A] text-white'}`}
            >
              <span className="sr-only">En pausa: </span>
              {n}
            </span>
          ) : null}
        </a>
      </li>
    );
  };
  const principales = SECCIONES_PLATAFORMA.filter((s) => s.grupo === 'principal');
  const administracion = SECCIONES_PLATAFORMA.filter((s) => s.grupo === 'administracion');

  return (
    <div className={`min-h-screen lg:flex ${FONDO_PUNTEADO}`}>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-ink px-4 py-3 text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-screen w-[288px] flex-none flex-col gap-6 overflow-y-auto bg-[#120A2A] px-4 py-5 text-[#FFF6EA] lg:flex">
        <a
          href="/plataforma"
          aria-label="club-lealtad, Plataforma"
          className="flex min-h-[56px] items-center justify-between gap-2 rounded-[16px] bg-[#FFF6EA] px-4 text-[#120A2A]"
        >
          <LogotipoClub tam={18} />
          <span className="rounded-full bg-[#C6FF3D] px-2.5 py-1 text-[12px] font-bold">
            Plataforma
          </span>
        </a>

        <nav aria-label="Secciones de la plataforma" className="flex flex-1 flex-col gap-5">
          <ul className="flex flex-col gap-1">{principales.map(enlaceMenu)}</ul>
          <div className="flex flex-col gap-1.5">
            <span className="px-3.5 text-[12px] font-bold tracking-[.08em] text-[#FFF6EA]/60 uppercase">
              Administración
            </span>
            <ul className="flex flex-col gap-1">{administracion.map(enlaceMenu)}</ul>
          </div>

          <div className="mt-auto flex flex-col gap-1 border-t border-white/15 pt-4">
            <a
              href={SECCION_CUENTA.ruta}
              aria-current={actual === 'cuenta' ? 'page' : undefined}
              title="Mi cuenta"
              className={`flex items-center gap-3 rounded-[13px] px-2 py-2 ${actual === 'cuenta' ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              <span
                aria-hidden="true"
                className="grid size-[38px] flex-none place-items-center rounded-full bg-white/10 font-display text-[16px] font-semibold"
              >
                {sesion.nombre.trim().charAt(0).toUpperCase() || 'E'}
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[14px] font-semibold">{sesion.nombre}</b>
                <span className="truncate text-[12px] text-[#FFF6EA]/65">Mi cuenta</span>
              </span>
            </a>
            {/* Cerrar sesión cambia el estado del servidor: va en un formulario. */}
            <form action={salir}>
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center gap-3 rounded-[13px] px-3.5 text-[15px] font-semibold text-[#FFF6EA]/85 hover:bg-white/10 hover:text-[#FFF6EA]"
              >
                <Icono nombre="salir" tam={20} />
                Salir
              </button>
            </form>
          </div>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-4 pb-1 lg:px-10 lg:pt-6">
          <a
            href="/plataforma"
            aria-label="club-lealtad, Plataforma"
            className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-ink lg:hidden"
          >
            <LogotipoClub tam={17} />
            <span className="rounded-full bg-[#C6FF3D] px-2 py-0.5 text-[11px] font-bold text-[#120A2A]">
              Plataforma
            </span>
          </a>
          <div className="hidden flex-1 lg:block" />
          {!buscadorGrande && paleta}
          <form action={salir} className="lg:hidden">
            <button
              type="submit"
              aria-label="Salir"
              className="grid size-[44px] place-items-center rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white text-ink"
            >
              <Icono nombre="salir" tam={20} />
            </button>
          </form>
        </header>

        <main id="contenido" className="mx-auto max-w-6xl px-5 pt-3 pb-32 lg:px-10 lg:pb-14">
          {miga && (
            <a
              href={miga.ruta}
              className="mb-1 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-ink"
            >
              <Icono nombre="atras" tam={18} />
              {miga.texto}
            </a>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {antetitulo && <p className="mb-1 text-[15px] text-[#5A4F63]">{antetitulo}</p>}
              <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] text-ink">{titulo}</h1>
              {descripcion && (
                <p className="mt-1.5 max-w-prose text-[15px] text-[#5A4F63]">{descripcion}</p>
              )}
            </div>
            {acciones}
          </div>
          {buscadorGrande && <div className="mt-6">{paleta}</div>}
          <div
            className={`mt-6 animate-[wl-entra_.4s_cubic-bezier(.2,.7,.2,1)_both] motion-reduce:animate-none ${enTarjeta ? 'rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white p-5 sm:p-8' : ''}`}
          >
            {children}
          </div>
        </main>
      </div>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t-[1.5px] border-[#E8D8C6] bg-white px-2.5 pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
      >
        {[
          ...SECCIONES_PLATAFORMA.filter((s) => s.enBarra),
          { ...PESTANA_MAS, icono: 'mas' as const, enBarra: PESTANA_MAS.texto },
        ].map((s) => {
          // «Nuevo club» no va en la barra: marca «Clubes». Lo que no está en la barra marca «Más».
          const enLaBarra = SECCIONES_PLATAFORMA.some((x) => x.enBarra && x.id === actual);
          const on =
            s.id === actual ||
            (s.id === 'clubes' && actual === 'nuevo') ||
            (s.id === 'mas' && !enLaBarra && actual !== 'nuevo');
          const n = s.id === 'mas' ? null : insignia(s.id as IdSeccionPlataforma);
          return (
            <a
              key={s.id}
              href={s.ruta}
              aria-current={on ? 'page' : undefined}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] ${on ? 'font-bold text-ink' : 'text-[#5A4F63]'}`}
            >
              <span
                className={`grid h-[30px] w-[52px] place-items-center rounded-full transition-colors ${on ? 'bg-[#C6FF3D] text-ink' : ''}`}
              >
                <Icono nombre={s.icono} tam={21} />
              </span>
              {s.enBarra}
              {n ? (
                <span className="absolute top-1 right-[calc(50%-26px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5B3A] px-1 text-[11px] font-bold text-white">
                  {n}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
