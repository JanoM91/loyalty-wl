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

  return (
    <section
      aria-label={`Tarjeta de lealtad: ${estampas} de ${programa.posiciones} estampas`}
      className={`relative isolate grid w-full overflow-hidden rounded-xl bg-ink text-cream shadow-[0_16px_32px_-14px_rgba(20,16,12,0.6)] ${compacta ? 'gap-3 p-4' : 'gap-4 p-5'}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(110% 70% at 100% 0%, color-mix(in srgb, var(--color-crust) 32%, transparent), transparent 58%), radial-gradient(90% 70% at 0% 100%, rgba(255,255,255,.08), transparent 62%)',
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <LogoMarca sobre="oscuro" className="h-7 text-lg" />
          <span className="text-[10.5px] font-semibold tracking-[0.16em] text-crust-light uppercase">
            Tarjeta de lealtad
          </span>
        </div>
        <div className="text-right text-xs text-cream/70">
          <b className="block text-sm font-semibold text-cream">{datos.nombre || 'Tu tarjeta'}</b>
          Ciclo {ciclo}
        </div>
      </div>

      <p className="flex items-baseline gap-2">
        <span
          className={`font-display leading-none tabular-nums ${compacta ? 'text-4xl' : 'text-5xl'}`}
        >
          {estampas}
        </span>
        <span className="text-sm text-cream/80">de {programa.posiciones} estampas</span>
      </p>

      <ol className={`grid grid-cols-5 ${compacta ? 'gap-2' : 'gap-2.5'}`}>
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
                'relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-full font-mono text-xs',
                sellada
                  ? hito
                    ? 'bg-crust-light text-ink'
                    : 'bg-crust text-cream'
                  : hito
                    ? 'border-[1.5px] border-crust-light text-crust-light'
                    : 'border-[1.5px] border-dashed border-cream/30 text-cream/50',
                nueva ? 'lp-sello-nuevo' : '',
              ].join(' ')}
              style={
                {
                  '--giro': `${GIROS[i % GIROS.length]}deg`,
                  animationDelay: nueva ? `${nuevas.indexOf(i) * 120}ms` : undefined,
                } as React.CSSProperties
              }
            >
              {sellada ? (
                marca.iconoUrl ? (
                  // Posición absoluta: dentro de la cuadrícula, un alto en
                  // porcentaje no se resuelve contra el círculo.
                  <img
                    src={marca.iconoUrl}
                    alt=""
                    className="pointer-events-none absolute inset-0 m-auto h-[70%] w-[70%] object-contain"
                    style={{ transform: `rotate(${GIROS[i % GIROS.length]}deg)` }}
                  />
                ) : (
                  <Icono
                    nombre="palomita"
                    className="h-[52%] w-[52%]"
                    style={{ transform: `rotate(${(GIROS[i % GIROS.length] ?? 0) + 30}deg)` }}
                  />
                )
              ) : hito ? (
                <Icono nombre={iconoDePremio(posicion, programa)} className="h-[46%] w-[46%]" />
              ) : (
                <span>{posicion}</span>
              )}
            </li>
          );
        })}
      </ol>

      {!compacta && (
        <ul className="grid gap-1.5 border-t border-cream/15 pt-3 text-[13.5px]">
          {programa.hitos.map((h) => {
            const listo = listos.includes(h.posicion);
            const entregado = entregados.includes(h.posicion);
            const falta = h.posicion - estampas;
            return (
              <li key={h.posicion} className="flex items-center gap-3">
                <span className="w-20 flex-none font-mono text-xs font-semibold text-crust-light">
                  {h.posicion} estampas
                </span>
                <span className="min-w-0 flex-1 text-cream/90">{h.nombre}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${listo ? 'bg-crust-light text-ink' : 'bg-cream/10 text-cream/75'}`}
                >
                  {listo
                    ? 'Listo para canjear'
                    : entregado
                      ? 'Entregado'
                      : falta > 0
                        ? `Faltan ${falta}`
                        : 'Ganado'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="rounded-md bg-cream/[0.08] px-3 py-2.5 text-[13.5px] leading-snug">
        {disponibles.length > 0 ? (
          <>
            <b className="font-semibold text-crust-light">
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
