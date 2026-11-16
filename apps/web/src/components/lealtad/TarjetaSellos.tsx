'use client';

import { describirPremio, textoProximoPremio, type ProgramaLealtad } from '@wl/domain';

import { LogoMarca, useMarca } from '@/components/Marca';

import { Icono, iconoDePremio } from './Iconos';

/**
 * La tarjeta de estampas.
 *
 * Es el centro del programa y se ve igual en tres lugares: en el celular del
 * cliente, en la caja después de acreditar y en el panel. Cada estampa ganada
 * es el isotipo del negocio (o una palomita, si no subió uno) girado como si
 * se hubiera sellado a mano.
 */

/** Giro de cada sello. Fijo, para que la tarjeta no "baile" entre visitas. */
const GIROS = [-34, -26, -38, -22, -30, -36, -24, -32, -28, -20] as const;

export interface DatosTarjetaSellos {
  readonly estampas: number;
  readonly ciclo: number;
  readonly nombre?: string | null;
  /** Todos los premios de la tarjeta, de cualquier ciclo. */
  readonly premios?: readonly {
    readonly tipo: string;
    /** Nombre prometido al ganarlo. Si falta, se busca en el programa. */
    readonly nombre?: string;
    readonly posicion: number;
    readonly ciclo: number;
    readonly disponible: boolean;
  }[];
}

export function TarjetaSellos({
  datos,
  programa,
  compacta = false,
  nuevas = [],
}: {
  datos: DatosTarjetaSellos;
  /** Programa vigente: posiciones y premios que dibuja la tarjeta. */
  programa: ProgramaLealtad;
  compacta?: boolean;
  /** Posiciones (desde 0) que se acaban de sellar, para animarlas. */
  nuevas?: readonly number[];
}) {
  const marca = useMarca();
  const { estampas, ciclo } = datos;
  const premios = datos.premios ?? [];
  // El estado de cada premio en la tarjeta actual…
  const delCiclo = premios.filter((p) => p.ciclo === ciclo);
  const listos = delCiclo.filter((p) => p.disponible).map((p) => p.posicion);
  const entregados = delCiclo.filter((p) => !p.disponible).map((p) => p.posicion);
  // …y el mensaje de abajo cuenta todos los disponibles, también los de una
  // tarjeta anterior que todavía no se canjean.
  const disponibles = premios.filter((p) => p.disponible);

  const columnas = programa.posiciones <= 10 ? 5 : programa.posiciones <= 18 ? 6 : 8;

  return (
    <section
      aria-label={`Tarjeta de lealtad: ${estampas} de ${programa.posiciones} estampas`}
      className={`grid w-full rounded-xl bg-ink text-cream ${compacta ? 'gap-4 p-5' : 'gap-6 p-6'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <LogoMarca sobre="oscuro" className="h-6 text-[17px]" />
        <span className="text-[13px] text-cream/70">
          {datos.nombre || 'Tu tarjeta'}
          {ciclo > 1 ? `, tarjeta ${ciclo}` : ''}
        </span>
      </div>

      {/* El número es la tarjeta: cuántas llevas, de cuántas. */}
      <p className="flex items-end gap-3">
        <span
          className={`font-display leading-[0.8] tabular-nums ${compacta ? 'text-[72px]' : 'text-[112px]'}`}
        >
          {estampas}
        </span>
        <span className="pb-1 text-[15px] leading-tight text-cream/70">
          de {programa.posiciones}
          <br />
          estampas
        </span>
      </p>

      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: programa.posiciones }, (_, i) => {
          const posicion = i + 1;
          const hito = programa.hitos.find((h) => h.posicion === posicion);
          const sellada = i < estampas;
          const nueva = nuevas.includes(i);
          return (
            <li
              key={posicion}
              aria-label={`Estampa ${posicion}${sellada ? ', sellada' : ''}${hito ? `, premio: ${hito.nombre}` : ''}`}
              className={[
                'relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-full text-[13px] tabular-nums',
                sellada
                  ? 'bg-crust-light text-[var(--wl-fondo)]'
                  : hito
                    ? 'border-2 border-crust-light text-crust-light'
                    : 'bg-cream/[0.09] text-cream/45',
                nueva ? 'lp-sello-nuevo' : '',
              ].join(' ')}
              style={{ animationDelay: nueva ? `${nuevas.indexOf(i) * 120}ms` : undefined }}
            >
              {sellada && marca.iconoUrl && !hito ? (
                <img
                  src={marca.iconoUrl}
                  alt=""
                  className="pointer-events-none absolute inset-0 m-auto h-[64%] w-[64%] object-contain"
                  style={{ transform: `rotate(${GIROS[i % GIROS.length]}deg)` }}
                />
              ) : hito ? (
                <Icono nombre={iconoDePremio(posicion, programa)} className="h-[46%] w-[46%]" />
              ) : sellada ? (
                <Icono nombre="palomita" strokeWidth={2.4} className="h-[44%] w-[44%]" />
              ) : (
                <span>{posicion}</span>
              )}
            </li>
          );
        })}
      </ol>

      {!compacta && (
        <ul className="grid gap-2.5 text-[15px]">
          {programa.hitos.map((h) => {
            const listo = listos.includes(h.posicion);
            const entregado = entregados.includes(h.posicion);
            const falta = h.posicion - estampas;
            return (
              <li key={h.posicion} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  {h.nombre} <span className="text-cream/55">a las {h.posicion}</span>
                </span>
                <span
                  className={`flex-none rounded-full px-2.5 py-0.5 text-[13px] whitespace-nowrap ${listo ? 'bg-crust-light font-semibold text-[var(--wl-fondo)]' : 'text-cream/70'}`}
                >
                  {listo
                    ? 'Listo para canjear'
                    : entregado
                      ? 'Entregado'
                      : falta > 0
                        ? falta === 1
                          ? 'Falta 1'
                          : `Faltan ${falta}`
                        : 'Ganado'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-cream/15 pt-4 text-[15px] leading-snug text-cream/85">
        {disponibles.length > 0 ? (
          <>
            <b className="font-semibold text-cream">
              {disponibles.length === 1
                ? 'Tienes un premio listo:'
                : `Tienes ${disponibles.length} premios listos:`}
            </b>{' '}
            {disponibles
              .map((p) => (p.nombre ?? describirPremio(programa, p.tipo).nombre).toLowerCase())
              .join(' y ')}
            . Pídelo en caja.
          </>
        ) : (
          <span>{textoProximoPremio(estampas, programa)}</span>
        )}
      </p>
    </section>
  );
}
