import type { ReactNode } from 'react';
import type { NegocioEnLista } from '@wl/database';
import { arcadeVigente, diasEnPausa, diasRestantesDePrueba } from '@wl/domain';

import { Icono, type NombreIcono } from '@/components/admin/Icono';
import { estadoDelClub } from '@/lib/plataforma/panel';

const TARJETA =
  'rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white transition-shadow hover:shadow-[0_18px_36px_-22px_rgba(18,10,42,.5)]';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Acceso rápido del inicio: ícono, título y una línea. La principal va en noche. */
export function TarjetaAcceso({
  href,
  icono,
  titulo,
  linea,
  principal = false,
  externa = false,
}: {
  href: string;
  icono: NombreIcono;
  titulo: string;
  linea: string;
  principal?: boolean;
  externa?: boolean;
}) {
  return (
    <a
      href={href}
      {...(externa ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`group flex min-h-[124px] flex-col justify-between gap-3 p-4 sm:min-h-[132px] sm:gap-4 sm:p-5 ${principal ? 'col-span-2 sm:col-span-1' : ''} ${
        principal
          ? 'rounded-[20px] bg-[#120A2A] text-[#FFF6EA] transition-shadow hover:shadow-[0_18px_36px_-18px_rgba(18,10,42,.75)]'
          : `${TARJETA} text-ink`
      }`}
    >
      <span className="flex items-start justify-between">
        <span
          className={`grid size-[42px] place-items-center rounded-[13px] ${principal ? 'bg-[#C6FF3D] text-[#120A2A]' : 'bg-crumb text-ink'}`}
        >
          <Icono nombre={icono} tam={22} />
        </span>
        <Icono
          nombre={externa ? 'externo' : 'chevron'}
          tam={18}
          className={`mt-1 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none ${principal ? 'text-[#FFF6EA]/70' : 'text-[#5A4F63]'}`}
        />
      </span>
      <span className="grid gap-0.5">
        <b className="font-display text-[19px] font-semibold">{titulo}</b>
        <span className={`text-[14px] ${principal ? 'text-[#FFF6EA]/75' : 'text-[#5A4F63]'}`}>
          {linea}
        </span>
      </span>
    </a>
  );
}

/** Una cifra del inicio con su línea de contexto. */
export function Cifra({
  valor,
  etiqueta,
  contexto,
}: {
  valor: number;
  etiqueta: string;
  contexto: string;
}) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-5">
      <p className="text-[14px] font-semibold text-[#5A4F63]">{etiqueta}</p>
      <p className="mt-1 font-display text-[34px] leading-none font-semibold text-ink tabular-nums">
        {valor.toLocaleString('es-MX')}
      </p>
      <p className="mt-2 text-[13px] text-[#5A4F63]">{contexto}</p>
    </div>
  );
}

/** Tarjeta de sección con título, contador opcional y contenido. */
export function Panel({
  icono,
  titulo,
  contador,
  aviso = false,
  accion,
  children,
}: {
  icono: NombreIcono;
  titulo: string;
  contador?: string;
  /** Fondo cálido: algo que pide atención. */
  aviso?: boolean;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-[20px] border-[1.5px] p-5 sm:p-6 ${aviso ? 'border-[#E0B45C] bg-[#FFF8E6]' : 'border-[#E8D8C6] bg-white'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Icono nombre={icono} tam={22} className="flex-none text-ink" />
        <h2 className="min-w-0 flex-1 text-[20px] text-ink">{titulo}</h2>
        {contador && (
          <span
            className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${aviso ? 'bg-[#F6DC9A] text-[#5B3B00]' : 'bg-crumb text-ink'}`}
          >
            {contador}
          </span>
        )}
        {accion}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** El sello del club (su ícono o su inicial en sus colores). */
function Sello({ fila }: { fila: NegocioEnLista }) {
  const { marca, nombre } = fila.negocio;
  const { fondo, acento } = marca.colores;
  if (marca.iconoUrl)
    return (
      <span
        aria-hidden="true"
        className="grid size-[44px] flex-none place-items-center overflow-hidden rounded-[13px]"
        style={{ background: fondo }}
      >
        <img src={marca.iconoUrl} alt="" className="size-[34px] object-contain" />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className="grid size-[44px] flex-none place-items-center rounded-[13px] font-display text-[20px] font-bold"
      style={{ background: fondo, color: acento }}
    >
      {nombre.trim().charAt(0).toUpperCase() || 'C'}
    </span>
  );
}

const ETIQUETA = 'rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap';

/** Las etiquetas de un club: modalidad, estado y Arcade. */
function Etiquetas({ fila }: { fila: NegocioEnLista }) {
  const { ajustes } = fila.negocio;
  const estado = estadoDelClub(fila);
  return (
    <span className="flex w-full flex-wrap items-center gap-1.5 pl-[60px] sm:w-auto sm:pl-0">
      {estado === 'activo' && (
        <span className={`${ETIQUETA} bg-[#E3F3E6] text-[#1F5630]`}>Activo</span>
      )}
      {estado === 'prueba' && (
        <span className={`${ETIQUETA} bg-[#ECE6FF] text-[#40209E]`}>
          Prueba · {plural(diasRestantesDePrueba(ajustes.pruebaVence), 'día', 'días')}
        </span>
      )}
      {estado === 'pausa' && (
        <span className={`${ETIQUETA} bg-[#F6DC9A] text-[#5B3B00]`}>
          En pausa · {diasEnPausa(ajustes.pruebaVence, ajustes.pagadoHasta)} d
        </span>
      )}
      {estado === 'suspendido' && (
        <span className={`${ETIQUETA} bg-[#FBE0DC] text-[#8C231B]`}>Suspendido</span>
      )}
      <span className={`${ETIQUETA} border border-[#E8D8C6] text-ink`}>
        {ajustes.plan === 'PRIVADA' ? 'Privada' : 'Lite'}
      </span>
      {arcadeVigente(ajustes.arcade) && (
        <span className={`${ETIQUETA} border border-[#E8D8C6] text-ink`}>Arcade</span>
      )}
    </span>
  );
}

/** Renglón de un club: sello, nombre, tamaños y etiquetas. Lleva a su ficha. */
export function RenglonClub({ fila }: { fila: NegocioEnLista }) {
  const { negocio, sucursales, tarjetas } = fila;
  return (
    <li className="border-t border-[#EFE3D3] first:border-t-0">
      <a
        href={`/plataforma/${negocio.slug}`}
        className="group flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] px-2 py-3 hover:bg-crumb/60"
      >
        <Sello fila={fila} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="truncate text-[17px] font-semibold text-ink">{negocio.nombre}</b>
          <span className="truncate text-[13px] text-[#5A4F63]">
            /{negocio.slug} · {plural(sucursales, 'sucursal', 'sucursales')} ·{' '}
            {plural(tarjetas, 'tarjeta', 'tarjetas')}
          </span>
        </span>
        <Etiquetas fila={fila} />
        <Icono
          nombre="chevron"
          tam={18}
          className="hidden flex-none text-[#5A4F63] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none sm:block"
        />
      </a>
    </li>
  );
}
