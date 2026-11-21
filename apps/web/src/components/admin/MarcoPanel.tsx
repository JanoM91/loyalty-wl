import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { ROLES_DIRECCION, prisma } from '@wl/database';

import type { Sesion } from '@/lib/admin/sesion';
import {
  TITULOS_GRUPO,
  barraInferior,
  comandosDelPanel,
  seccionActiva,
  seccionesDelPanel,
  type GrupoSeccion,
} from '@/lib/admin/panel';
import { salir } from '@/app/admin/entrar/acciones';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

import { AvisoClub } from './AvisoClub';
import { Icono } from './Icono';
import { Paleta } from './Paleta';

const FONDO_PUNTEADO =
  'bg-[radial-gradient(#C9E7DA_1.2px,transparent_1.2px)] [background-size:24px_24px]';

/**
 * El sello del negocio dentro del panel: su Sello (hecho de su logotipo o
 * subido aparte) o, si no tiene, su inicial en sus colores.
 */
function Inicial({
  nombre,
  fondo,
  acento,
  sello,
}: {
  nombre: string;
  fondo: string;
  acento: string;
  sello: string | null;
}) {
  if (sello)
    return (
      <span
        aria-hidden="true"
        className="grid size-[42px] flex-none place-items-center overflow-hidden rounded-[13px]"
        style={{ background: fondo }}
      >
        <img src={sello} alt="" className="size-[34px] object-contain" />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className="grid size-[42px] flex-none place-items-center rounded-[13px] font-display text-[20px] font-extrabold"
      style={{ background: fondo, color: acento }}
    >
      {nombre.trim().charAt(0).toUpperCase() || 'C'}
    </span>
  );
}

/**
 * Marco de cada pantalla del panel: un panel tradicional pensado primero para
 * el celular. En el celular, arriba el negocio y la lupa (paleta ⌘K), abajo
 * la barra Inicio · Caja · Clientes · Más. En la computadora, menú lateral
 * con todas las secciones y la barra de búsqueda arriba. El permiso de verdad
 * lo comprueba cada página, no este marco.
 */
export async function MarcoPanel({
  sesion,
  titulo,
  descripcion,
  acciones,
  enfoque = false,
  miga,
  tituloOculto = false,
  sinAviso = false,
  children,
}: {
  sesion: Sesion;
  /** Paso anterior, p. ej. «Clientes» en el detalle de una tarjeta. */
  miga?: { readonly texto: string; readonly ruta: string };
  /**
   * Modo enfoque: una sola tarjeta al centro, sin menús, para tareas de
   * mostrador (la caja). Lo demás del panel queda a un toque.
   */
  enfoque?: boolean;
  /** Ruta de la sección (se conserva por compatibilidad; el marco la lee de la petición). */
  actual?: string;
  titulo: string;
  descripcion?: string;
  /** El título solo para lectores de pantalla en el celular (el inicio). */
  tituloOculto?: boolean;
  /** Sin el aviso de prueba o pausa: la pantalla ya lo muestra a su modo. */
  sinAviso?: boolean;
  /** Botones junto al título, como «Invitar a alguien». */
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const [negocio, base, cabeceras] = await Promise.all([exigirNegocio(), rutaBase(), headers()]);
  const dirige = ROLES_DIRECCION.includes(sesion.rol);
  const activa = seccionActiva(cabeceras.get('x-ruta-panel'));
  const { fondo, acento } = negocio.marca.colores;

  // «Mi plan» es del plan Lite: solo para los clubes que vienen del asistente.
  const conPlan = Boolean(negocio.ajustes.alta);
  const comandos = comandosDelPanel(sesion.rol)
    .filter((c) => c.id !== 'plan' || conPlan)
    .map((c) => ({
      id: c.id,
      texto: c.texto,
      grupo: c.grupo,
      claves: c.claves,
      href: `${base}${c.ruta}`,
    }));
  const paleta = (
    <Paleta
      variante="buscar"
      comandos={comandos}
      buscarClientes={dirige ? `${base}/admin/lealtad/tarjetas` : null}
    />
  );

  if (enfoque) {
    return (
      <div className={`min-h-screen px-3 pb-16 sm:px-5 ${FONDO_PUNTEADO}`}>
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-3 sm:py-5">
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[14px] text-cream">
            <span className="truncate">
              <b className="font-semibold">{titulo}</b>
            </span>
            <a
              href={`${base}${dirige ? '/admin' : '/admin/ayuda'}`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-cream px-3.5 text-[13px] font-semibold text-ink"
            >
              <Icono nombre="cerrar" tam={16} />
              {dirige ? 'Volver al inicio' : 'Cerrar'}
            </a>
          </div>
          {paleta}
        </header>

        <div className="mx-auto max-w-xl">
          <AvisoClub sesion={sesion} />
        </div>

        <main
          id="contenido"
          className="mx-auto mt-4 max-w-xl animate-[wl-entra_.4s_cubic-bezier(.2,.7,.2,1)_both] rounded-[26px] border-2 border-ink bg-white p-4 shadow-[0_30px_60px_-30px_rgba(6,35,28,.45)] motion-reduce:animate-none sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[clamp(1.6rem,4vw,2rem)] text-ink">{titulo}</h1>
              {descripcion && <p className="mt-1 text-[15px] text-[#3C5A51]">{descripcion}</p>}
            </div>
            {acciones}
          </div>
          {children}
        </main>
      </div>
    );
  }

  const secciones = seccionesDelPanel(sesion.rol).filter((s) => s.id !== 'plan' || conPlan);
  const pestanas = barraInferior(sesion.rol);
  const pendientes = dirige
    ? await prisma.loyaltyAccrual.count({ where: { status: 'PENDIENTE' } })
    : 0;
  const insignia = (id: string) => (id === 'pendientes' && pendientes > 0 ? pendientes : null);
  const grupos: GrupoSeccion[] = ['principal', 'programa', 'clientes', 'negocio'];

  const enlaceMenu = (s: (typeof secciones)[number]) => {
    const on = s.id === activa;
    const n = insignia(s.id);
    return (
      <li key={s.id}>
        <a
          href={`${base}${s.ruta}`}
          aria-current={on ? 'page' : undefined}
          className={`flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-[15px] font-semibold transition-colors ${on ? 'bg-ink text-cream' : 'text-ink hover:bg-crumb'}`}
        >
          <Icono nombre={s.icono} tam={20} />
          <span className="min-w-0 flex-1 truncate">{s.texto}</span>
          {n ? (
            <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#5B2EFF] px-1.5 text-[12px] font-bold text-white">
              {n}
            </span>
          ) : null}
        </a>
      </li>
    );
  };

  return (
    <div className={`min-h-screen lg:flex ${FONDO_PUNTEADO}`}>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-ink px-4 py-3 text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-screen w-[264px] flex-none flex-col gap-5 overflow-y-auto border-r-[1.5px] border-[#CDE8DC] bg-white px-3.5 py-5 lg:flex">
        <div className="flex items-center gap-3 px-1.5">
          <Inicial
            nombre={negocio.nombre}
            fondo={fondo}
            acento={acento}
            sello={negocio.marca.iconoUrl}
          />
          <div className="flex min-w-0 flex-col">
            <b className="truncate font-display text-[17px]">{negocio.nombre}</b>
            <span className="text-[13px] text-[#3C5A51]">Panel de tu club</span>
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="flex flex-1 flex-col gap-4">
          {grupos.map((g) => {
            const del = secciones.filter((s) => s.grupo === g);
            if (del.length === 0) return null;
            return (
              <div key={g} className="flex flex-col gap-1">
                {g !== 'principal' && (
                  <span className="px-3 text-[12px] font-bold tracking-[.04em] text-[#3C5A51] uppercase">
                    {TITULOS_GRUPO[g]}
                  </span>
                )}
                <ul className="flex flex-col gap-0.5">{del.map(enlaceMenu)}</ul>
              </div>
            );
          })}
          <ul className="mt-auto flex flex-col gap-0.5 border-t-[1.5px] border-[#CDE8DC] pt-3">
            {secciones.filter((s) => s.grupo === 'cuenta').map(enlaceMenu)}
            <li>
              {/* Cerrar sesión cambia el estado del servidor: va en un
                  formulario y no en un enlace que una precarga dispare. */}
              <form action={salir}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-[12px] px-3 text-[15px] font-semibold text-ink hover:bg-crumb"
                >
                  <Icono nombre="salir" tam={20} />
                  Salir
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-4 pb-1 lg:px-10 lg:pt-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
            <Inicial
              nombre={negocio.nombre}
              fondo={fondo}
              acento={acento}
              sello={negocio.marca.iconoUrl}
            />
            <b className="truncate font-display text-[18px]">{negocio.nombre}</b>
          </div>
          <div className="hidden flex-1 lg:block" />
          {paleta}
        </header>

        {!sinAviso && (
          <div className="mx-auto max-w-6xl px-5 lg:px-10">
            <AvisoClub sesion={sesion} />
          </div>
        )}

        <main id="contenido" className="mx-auto max-w-6xl px-5 pt-4 pb-32 lg:px-10 lg:pb-14">
          {miga && (
            <a
              href={`${base}${miga.ruta}`}
              className="mb-1 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-ink"
            >
              <Icono nombre="atras" tam={18} />
              {miga.texto}
            </a>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className={tituloOculto ? 'sr-only lg:not-sr-only' : 'min-w-0'}>
              <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] text-ink">{titulo}</h1>
              {descripcion && (
                <p className="mt-1.5 max-w-prose text-[15px] text-[#3C5A51]">{descripcion}</p>
              )}
            </div>
            {acciones}
          </div>
          <div className={tituloOculto ? 'lg:mt-6' : 'mt-6'}>{children}</div>
        </main>
      </div>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t-[1.5px] border-[#CDE8DC] bg-white px-2.5 pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
      >
        {pestanas.map((t) => {
          // Lo que vive en «Más» marca «Más»: así se sabe dónde se está.
          const enMas = activa !== null && !pestanas.some((x) => x.id === activa && x.id !== 'mas');
          const on = t.id === activa || (t.id === 'mas' && enMas);
          const n = t.id === 'mas' ? (pendientes > 0 ? pendientes : null) : null;
          return (
            <a
              key={t.id}
              href={`${base}${t.ruta}`}
              aria-current={on ? 'page' : undefined}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] ${on ? 'font-bold text-ink' : 'text-[#3C5A51]'}`}
            >
              <span
                className={`grid h-[30px] w-[52px] place-items-center rounded-full transition-colors ${on ? 'bg-[#00C389] text-ink' : ''}`}
              >
                <Icono nombre={t.icono} tam={21} />
              </span>
              {t.texto}
              {n ? (
                <span className="absolute top-1 right-[calc(50%-24px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#5B2EFF] px-1 text-[11px] font-bold text-white">
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
