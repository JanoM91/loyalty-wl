'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { formateador, type FormatoNumero } from './formato';

/**
 * Gráficas de los reportes: SVG propio, sin librerías. Adaptadas del tablero
 * de analítica del sistema de referencia.
 *
 * Reglas: un solo eje, color por entidad (cada sucursal conserva el suyo
 * aunque cambie el filtro), marcas delgadas, leyenda con 2 series o más y una
 * capa al pasar el cursor (o tocar) con el valor exacto. Las líneas y la
 * rejilla usan los colores del club (tinta, línea, superficie).
 */

export interface Serie {
  readonly clave: string;
  readonly nombre: string;
  readonly color: string;
  readonly valores: readonly number[];
}

const ALTO = 220;
const M = { arriba: 12, derecha: 12, abajo: 28, izquierda: 44 };
const REJILLA = 'var(--color-rule)';
const SUPERFICIE = 'var(--color-cream)';

function escala(max: number): { tope: number; marcas: number[] } {
  if (max <= 0) return { tope: 1, marcas: [0, 1] };
  const crudo = max / 4;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= crudo) ?? crudo;
  // Conteos: sin marcas fraccionarias (0.5 visitas no existe).
  const pasoEntero = Math.max(1, Math.ceil(paso));
  const tope = Math.ceil(max / pasoEntero) * pasoEntero;
  const marcas: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += pasoEntero) marcas.push(v);
  return { tope, marcas };
}

function escalaPorcentaje(max: number): { tope: number; marcas: number[] } {
  if (max <= 0) return { tope: 1, marcas: [0, 0.25, 0.5, 0.75, 1] };
  const paso = [0.05, 0.1, 0.2, 0.25].find((s) => max / s <= 5) ?? 0.25;
  const tope = Math.min(1, Math.ceil(max / paso - 1e-9) * paso);
  const marcas: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(Math.round(v * 1000) / 1000);
  return { tope, marcas };
}

function useAncho(): [React.RefObject<HTMLElement | null>, number] {
  const ref = useRef<HTMLElement | null>(null);
  const [ancho, setAncho] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(260, Math.floor(el.clientWidth)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
}

function Leyenda({ series, forma }: { series: readonly Serie[]; forma: 'linea' | 'barra' }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {series.map((s) => (
        <li key={s.clave} className="inline-flex items-center gap-1.5">
          {forma === 'linea' ? (
            <span className="inline-block h-[2px] w-4 rounded" style={{ background: s.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          )}
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({
  x,
  ancho,
  titulo,
  filas,
}: {
  x: number;
  ancho: number;
  titulo: string;
  filas: readonly { color: string; nombre: string; valor: string }[];
}) {
  const izquierda = x > ancho / 2;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-md border border-rule bg-cream px-3 py-2 text-xs shadow-lg"
      style={izquierda ? { right: ancho - x + 10 } : { left: x + 10 }}
    >
      <p className="mb-1 text-muted">{titulo}</p>
      {filas.map((f) => (
        <p key={f.nombre} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: f.color }} />
          <b className="font-semibold text-ink tabular-nums">{f.valor}</b>
          <span className="text-ink-soft">{f.nombre}</span>
        </p>
      ))}
    </div>
  );
}

function Rejilla({
  marcas,
  y,
  ancho,
  formato,
}: {
  marcas: readonly number[];
  y: (v: number) => number;
  ancho: number;
  formato: FormatoNumero;
}) {
  const f = formateador(formato, true);
  return (
    <>
      {marcas.map((m) => (
        <g key={m}>
          <line
            x1={M.izquierda}
            x2={ancho - M.derecha}
            y1={y(m)}
            y2={y(m)}
            style={{ stroke: REJILLA }}
            strokeWidth={m === 0 ? 1 : 0.6}
          />
          <text
            x={M.izquierda - 6}
            y={y(m) + 3}
            textAnchor="end"
            className="fill-muted text-[10px]"
          >
            {f(m)}
          </text>
        </g>
      ))}
    </>
  );
}

/** Líneas en el tiempo. Línea vertical y valores al pasar el cursor. */
export function GraficaLineas({
  etiquetas,
  series,
  formato = 'numero',
  titulo,
}: {
  etiquetas: readonly string[];
  series: readonly Serie[];
  formato?: FormatoNumero;
  titulo: string;
}) {
  const [ref, ancho] = useAncho();
  const [i, setI] = useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((s) => s.valores.filter(Number.isFinite)));
  const { tope, marcas } = formato === 'porcentaje' ? escalaPorcentaje(max) : escala(max);
  const w = ancho - M.izquierda - M.derecha;
  const h = ALTO - M.arriba - M.abajo;
  const n = etiquetas.length;
  const x = (k: number) => M.izquierda + (n <= 1 ? w / 2 : (k / (n - 1)) * w);
  const y = (v: number) => M.arriba + h - (v / tope) * h;
  const f = formateador(formato);
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));

  function mover(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const k = n <= 1 ? 0 : Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setI(Math.min(n - 1, Math.max(0, k)));
  }

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="relative w-full min-w-0">
      <figcaption className="sr-only">{titulo}</figcaption>
      <Leyenda series={series} forma="linea" />
      {n === 0 ? (
        <SinDatos />
      ) : (
        <svg width={ancho} height={ALTO} role="img" aria-label={titulo} className="block">
          <Rejilla marcas={marcas} y={y} ancho={ancho} formato={formato} />
          {etiquetas.map((e, k) =>
            k % cada === 0 ? (
              <text
                key={`${e}-${k}`}
                x={x(k)}
                y={ALTO - 8}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {e}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <path
              key={s.clave}
              d={trazo(s.valores, x, y)}
              fill="none"
              style={{ stroke: s.color }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {n <= 40 &&
            series.map((s) =>
              s.valores.map((v, k) =>
                !Number.isFinite(v) ? null : (
                  <circle
                    key={`${s.clave}-${k}`}
                    cx={x(k)}
                    cy={y(v)}
                    r={i === k ? 4.5 : 3}
                    style={{ fill: s.color, stroke: SUPERFICIE }}
                    strokeWidth={2}
                  />
                ),
              ),
            )}
          {i !== null && (
            <line
              x1={x(i)}
              x2={x(i)}
              y1={M.arriba}
              y2={M.arriba + h}
              className="stroke-muted"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          <rect
            x={M.izquierda}
            y={M.arriba}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setI(null)}
          />
        </svg>
      )}
      {i !== null && (
        <Tooltip
          x={x(i)}
          ancho={ancho}
          titulo={etiquetas[i] ?? ''}
          filas={series.map((s) => {
            const v = s.valores[i] ?? NaN;
            return {
              color: s.color,
              nombre: s.nombre,
              valor: Number.isFinite(v) ? f(v) : 'sin datos',
            };
          })}
        />
      )}
    </figure>
  );
}

/** Ruta de una línea; un NaN (sin datos) la corta en lugar de bajarla a cero. */
function trazo(
  valores: readonly number[],
  x: (k: number) => number,
  y: (v: number) => number,
): string {
  let d = '';
  let nueva = true;
  valores.forEach((v, k) => {
    if (!Number.isFinite(v)) {
      nueva = true;
      return;
    }
    d += `${nueva ? 'M' : 'L'}${x(k)},${y(v)} `;
    nueva = false;
  });
  return d.trim();
}

/** Barras verticales; con varias series se apilan (partes de un total). */
export function GraficaBarras({
  etiquetas,
  series,
  formato = 'numero',
  titulo,
  alto = ALTO,
}: {
  etiquetas: readonly string[];
  series: readonly Serie[];
  formato?: FormatoNumero;
  titulo: string;
  alto?: number;
}) {
  const [ref, ancho] = useAncho();
  const [i, setI] = useState<number | null>(null);
  const n = etiquetas.length;
  const val = (s: Serie, k: number) => {
    const v = s.valores[k] ?? 0;
    return Number.isFinite(v) ? v : 0;
  };
  const totales = etiquetas.map((_, k) => series.reduce((a, s) => a + val(s, k), 0));
  const maximo = Math.max(0, ...totales);
  const { tope, marcas } = formato === 'porcentaje' ? escalaPorcentaje(maximo) : escala(maximo);
  const w = ancho - M.izquierda - M.derecha;
  const h = alto - M.arriba - M.abajo;
  const banda = n > 0 ? w / n : w;
  const barra = Math.max(2, Math.min(40, banda * 0.7));
  const y = (v: number) => M.arriba + h - (v / tope) * h;
  const f = formateador(formato);
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 46))));

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="relative w-full min-w-0">
      <figcaption className="sr-only">{titulo}</figcaption>
      <Leyenda series={series} forma="barra" />
      {n === 0 ? (
        <SinDatos />
      ) : (
        <svg width={ancho} height={alto} role="img" aria-label={titulo} className="block">
          <Rejilla marcas={marcas} y={y} ancho={ancho} formato={formato} />
          {etiquetas.map((e, k) => {
            const cx = M.izquierda + banda * k + banda / 2;
            let base = 0;
            return (
              <g key={`${e}-${k}`} opacity={i === null || i === k ? 1 : 0.55}>
                {series.map((s) => {
                  const v = val(s, k);
                  const y0 = y(base);
                  base += v;
                  const y1 = y(base);
                  const alto1 = Math.max(0, y0 - y1 - (series.length > 1 ? 2 : 0));
                  return v > 0 ? (
                    <rect
                      key={s.clave}
                      x={cx - barra / 2}
                      y={y1}
                      width={barra}
                      height={alto1}
                      rx={series.length > 1 ? 1 : 3}
                      style={{ fill: s.color }}
                    />
                  ) : null;
                })}
                {k % cada === 0 && (
                  <text x={cx} y={alto - 8} textAnchor="middle" className="fill-muted text-[10px]">
                    {e}
                  </text>
                )}
                <rect
                  x={M.izquierda + banda * k}
                  y={M.arriba}
                  width={banda}
                  height={h}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${e}: ${f(totales[k] ?? 0)}`}
                  onPointerEnter={() => setI(k)}
                  onPointerDown={() => setI(k)}
                  onPointerLeave={() => setI(null)}
                  onFocus={() => setI(k)}
                  onBlur={() => setI(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {i !== null && (
        <Tooltip
          x={M.izquierda + banda * i + banda / 2}
          ancho={ancho}
          titulo={`${etiquetas[i]}${series.length > 1 ? ` · total ${f(totales[i] ?? 0)}` : ''}`}
          filas={series.map((s) => ({ color: s.color, nombre: s.nombre, valor: f(val(s, i)) }))}
        />
      )}
    </figure>
  );
}

/**
 * Mapa de calor día × hora: un solo tono (la tinta del club), de claro a
 * oscuro. Al pasar el cursor o tocar, el valor exacto debajo.
 */
export function MapaCalor({
  filas,
  columnas,
  valores,
  titulo,
  unidad,
}: {
  filas: readonly string[];
  columnas: readonly string[];
  /** valores[fila][columna] */
  valores: readonly (readonly number[])[];
  titulo: string;
  /** Qué mide cada celda, para la línea de abajo: "visitas por semana". */
  unidad: string;
}) {
  const [sel, setSel] = useState<{ f: number; c: number } | null>(null);
  const max = Math.max(0, ...valores.flat());
  const fmt = formateador('numero');
  const color = (v: number) => {
    if (v <= 0 || max <= 0) return 'var(--color-crumb)';
    const t = Math.sqrt(v / max);
    return `color-mix(in srgb, #2a78d6 ${Math.round(18 + 82 * t)}%, var(--color-cream))`;
  };
  return (
    <figure className="relative overflow-x-auto">
      <figcaption className="sr-only">{titulo}</figcaption>
      <table className="border-separate border-spacing-[2px] text-[10px]">
        <thead>
          <tr>
            <th />
            {columnas.map((c) => (
              <th key={c} className="px-0.5 font-normal text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, fi) => (
            <tr key={f}>
              <th className="pr-1.5 text-right font-normal whitespace-nowrap text-muted">{f}</th>
              {columnas.map((c, ci) => {
                const v = valores[fi]?.[ci] ?? 0;
                const activa = sel?.f === fi && sel?.c === ci;
                return (
                  <td
                    key={c}
                    tabIndex={0}
                    onPointerEnter={() => setSel({ f: fi, c: ci })}
                    onPointerDown={() => setSel({ f: fi, c: ci })}
                    onPointerLeave={() => setSel(null)}
                    onFocus={() => setSel({ f: fi, c: ci })}
                    onBlur={() => setSel(null)}
                    className={`h-6 min-w-[22px] rounded-[3px] ${activa ? 'outline-2 outline-ink' : ''}`}
                    style={{ background: color(v) }}
                    aria-label={`${f} ${c}: ${fmt(v)} ${unidad}`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 min-h-[18px] text-xs text-ink-soft" role="status">
        {sel ? (
          <>
            <b className="font-semibold text-ink tabular-nums">
              {fmt(valores[sel.f]?.[sel.c] ?? 0)}
            </b>{' '}
            {unidad} · {filas[sel.f]} {columnas[sel.c]}
          </>
        ) : (
          'Pasa el cursor (o toca) una celda para ver el valor. Más oscuro = más.'
        )}
      </p>
    </figure>
  );
}

function SinDatos(): ReactNode {
  return (
    <p className="grid h-[140px] place-items-center rounded-md bg-crumb text-sm text-muted">
      Sin datos con estos filtros.
    </p>
  );
}
