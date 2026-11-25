import type { ReactNode } from 'react';
import { accesosRapidos, type FiltrosReporte } from '@wl/domain';
import type { OpcionesReporte } from '@wl/database';

import { colorDeSerie } from '@/components/admin/analitica/formato';

/**
 * Piezas de servidor de Números: filtros (un formulario GET, sin
 * JavaScript), pestañas, indicadores con cambio contra el periodo anterior y
 * tarjetas. Las gráficas interactivas viven en
 * `components/admin/analitica/Graficas.tsx`.
 */

export type Pestana = 'resumen' | 'tendencias' | 'visitas';

export const PESTANAS: readonly { readonly clave: Pestana; readonly nombre: string }[] = [
  { clave: 'resumen', nombre: 'Resumen' },
  { clave: 'tendencias', nombre: 'Tendencias' },
  { clave: 'visitas', nombre: 'Distribución de visitas' },
];

export function esPestana(v: unknown): v is Pestana {
  return PESTANAS.some((p) => p.clave === v);
}

/** Color fijo por sucursal: su lugar en la lista del club, no en el filtro. */
export function colorSucursal(opciones: OpcionesReporte, slug: string): string {
  return colorDeSerie(opciones.sucursales.findIndex((s) => s.slug === slug));
}

export function query(
  f: FiltrosReporte | null,
  cambios: Record<string, string | null> = {},
): string {
  const q = new URLSearchParams();
  if (f) {
    q.set('desde', f.desde);
    q.set('hasta', f.hasta);
    for (const s of f.sucursales) q.append('suc', s);
    if (f.agrupar !== 'DIA') q.set('agrupar', f.agrupar);
  }
  for (const [k, v] of Object.entries(cambios)) {
    q.delete(k);
    if (v !== null) q.set(k, v);
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '?';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${d} ${MESES[m - 1]} ${a}`;
}

export function etiquetaPeriodo(iso: string, agrupar: FiltrosReporte['agrupar']): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  if (agrupar === 'MES') return `${MESES[m - 1]} ${String(a).slice(2)}`;
  if (agrupar === 'SEMANA') return `sem ${d} ${MESES[m - 1]}`;
  return `${d} ${MESES[m - 1]}`;
}

const claseCampo =
  'min-h-[40px] rounded-sm border border-rule bg-cream px-2.5 text-sm text-ink focus:border-ink';

export function Filtros({
  f,
  opciones,
  tab,
}: {
  f: FiltrosReporte;
  opciones: OpcionesReporte;
  tab: Pestana;
}) {
  const hoy = opciones.hoy;
  const variasSucursales = opciones.sucursales.length > 1;
  return (
    <section aria-label="Filtros" className="grid gap-3 rounded-lg border border-rule bg-cream p-3">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {accesosRapidos(hoy, opciones.primerDia).map((p) => {
          const activo = p.desde === f.desde && p.hasta === f.hasta;
          return (
            <a
              key={p.nombre}
              href={query(f, {
                desde: p.desde,
                hasta: p.hasta,
                agrupar: p.agrupar === 'DIA' ? null : p.agrupar,
                tab,
              })}
              aria-current={activo ? 'true' : undefined}
              className={`inline-flex min-h-[32px] items-center rounded-full px-3 ${activo ? 'bg-ink text-cream' : 'border border-rule bg-cream text-ink-soft hover:text-ink'}`}
            >
              {p.nombre}
            </a>
          );
        })}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <label className="grid gap-1 text-xs text-ink-soft">
          Desde
          <input
            type="date"
            name="desde"
            defaultValue={f.desde}
            min={opciones.primerDia ?? undefined}
            max={hoy}
            className={claseCampo}
          />
        </label>
        <label className="grid gap-1 text-xs text-ink-soft">
          Hasta
          <input type="date" name="hasta" defaultValue={f.hasta} max={hoy} className={claseCampo} />
        </label>
        {tab === 'tendencias' && (
          <label className="grid gap-1 text-xs text-ink-soft">
            Agrupar por
            <select name="agrupar" defaultValue={f.agrupar} className={claseCampo}>
              <option value="DIA">Día</option>
              <option value="SEMANA">Semana (lun–dom)</option>
              <option value="MES">Mes</option>
            </select>
          </label>
        )}
        {tab !== 'tendencias' && f.agrupar !== 'DIA' && (
          <input type="hidden" name="agrupar" value={f.agrupar} />
        )}
        {variasSucursales && (
          <fieldset className="grid gap-1 text-xs text-ink-soft">
            <legend className="mb-1">Sucursales (ninguna marcada = todas)</legend>
            <div className="flex flex-wrap gap-1.5">
              {opciones.sucursales.map((s) => (
                <label
                  key={s.slug}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-sm border border-rule bg-cream px-2.5 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    name="suc"
                    value={s.slug}
                    defaultChecked={f.sucursales.includes(s.slug)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: colorSucursal(opciones, s.slug) }}
                    aria-hidden
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center rounded-sm bg-ink px-4 text-sm font-semibold text-cream hover:bg-ink-soft"
          >
            Aplicar
          </button>
          <a
            href={query(null, { tab })}
            className="inline-flex min-h-[40px] items-center rounded-sm px-2 text-sm text-crust-dark underline underline-offset-4"
          >
            Limpiar
          </a>
        </div>
      </form>
    </section>
  );
}

export function Pestanas({
  f,
  actual,
  soloPrivada,
}: {
  f: FiltrosReporte | null;
  actual: Pestana;
  /** En Lite, las vistas con periodo llevan la etiqueta «Privada». */
  soloPrivada: boolean;
}) {
  return (
    <nav aria-label="Vistas de Números" className="flex gap-1 overflow-x-auto border-b border-rule">
      {PESTANAS.map((p) => (
        <a
          key={p.clave}
          href={query(f, { tab: p.clave === 'resumen' ? null : p.clave })}
          aria-current={actual === p.clave ? 'page' : undefined}
          className={`flex-none border-b-2 px-3 py-2 text-sm whitespace-nowrap ${actual === p.clave ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          {p.nombre}
          {soloPrivada && p.clave !== 'resumen' && (
            <span className="ml-1.5 rounded-full bg-crumb px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
              Privada
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}

/** Cambio contra el periodo anterior: +12.3 % (o puntos, si es proporción). */
export function Cambio({
  actual,
  previo,
  puntos = false,
}: {
  actual: number;
  previo: number;
  puntos?: boolean;
}) {
  if (!Number.isFinite(previo) || (previo === 0 && !puntos)) {
    return <span className="text-muted">sin datos del periodo anterior</span>;
  }
  const d = puntos ? (actual - previo) * 100 : (actual / previo - 1) * 100;
  if (Math.abs(d) < 0.05) return <span className="text-muted">igual que el periodo anterior</span>;
  return (
    <span className={d > 0 ? 'text-disponible' : 'text-agotado'}>
      <span aria-hidden>{d > 0 ? '▲' : '▼'}</span> {d > 0 ? '+' : ''}
      {d.toFixed(1)}
      {puntos ? ' pts' : ' %'} <span className="text-muted">vs. anterior</span>
    </span>
  );
}

export function Indicador({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota?: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1 rounded-lg border border-rule bg-cream px-4 py-3">
      <dt className="text-xs font-medium text-muted">{etiqueta}</dt>
      <dd className="font-display text-3xl text-ink tabular-nums">{valor}</dd>
      {nota && <dd className="text-xs text-muted">{nota}</dd>}
    </div>
  );
}

export function Tarjeta({
  titulo,
  nota,
  children,
  className = '',
}: {
  titulo: string;
  nota?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`grid min-w-0 content-start gap-2 rounded-lg border border-rule bg-cream p-4 ${className}`}
    >
      <h2 className="font-sans text-base font-semibold text-ink">{titulo}</h2>
      {nota && <p className="text-xs text-muted">{nota}</p>}
      {children}
    </section>
  );
}
