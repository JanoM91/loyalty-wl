import type { Metadata } from 'next';
import { analiticaLealtad, type AnaliticaLealtad } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { SubnavLealtad } from '@/components/admin/SubnavLealtad';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Analítica de lealtad' };
export const dynamic = 'force-dynamic';

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)} %`);
const num = (n: number) => n.toLocaleString('es-MX');
const fecha = (iso: string) => fechaCivil(new Date(`${iso}T00:00:00Z`));
const diaMes = (iso: string) => fecha(iso).split(' ').slice(0, 2).join(' ');

/**
 * Analítica del programa para Administración, Dueño y Gerencia.
 *
 * Es el tablero de lealtad dentro del panel, con las mismas
 * consultas (`analiticaLealtad` en @wl/database). Primero lo que decide
 * la semana, después el embudo de verificación, el camino al premio, el
 * control de acumulación y el detalle por sucursal. Todo cuenta solo compras
 * identificadas con tarjeta: no son las ventas del negocio.
 */
export default async function AnaliticaPage() {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const a = await analiticaLealtad();
  const r = a.resumen;
  const sinVerificar = r.tarjetas - r.verificadas;
  const deltaVisitas = r.visitas7d - r.visitas7dPrev;

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Analítica de lealtad"
      descripcion={`Datos al ${fecha(r.hoy)} (hora del negocio). Solo compras identificadas con tarjeta; no son las ventas totales.`}
    >
      <SubnavLealtad actual="/admin/lealtad/analitica" pendientes={r.pendientesRevision} />

      <p className="mb-5 max-w-3xl text-sm text-ink-soft">
        <b className="font-semibold text-ink">
          {num(r.visitas7d)} visitas de {num(r.clientes7d)} clientes en los últimos 7 días.
        </b>{' '}
        {num(r.tarjetas)} tarjetas activas, de las que {num(sinVerificar)} todavía no pueden canjear
        por falta de verificación.
      </p>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador
          etiqueta="Visitas · últimos 7 días"
          valor={num(r.visitas7d)}
          nota={
            <Delta valor={deltaVisitas}>
              {deltaVisitas > 0 ? '+' : ''}
              {num(deltaVisitas)} vs. 7 días previos
            </Delta>
          }
        />
        <Indicador
          etiqueta="Clientes distintos · 7 días"
          valor={num(r.clientes7d)}
          nota="Personas con al menos una visita acreditada"
        />
        <Indicador
          etiqueta="Tarjetas activas"
          valor={num(r.tarjetas)}
          nota={`+${num(r.tarjetas7d)} nuevas en 7 días`}
        />
        <Indicador
          etiqueta="Clientes que regresan"
          valor={pct(r.recurrentes, r.conVisitas)}
          nota={`${num(r.recurrentes)} de ${num(r.conVisitas)} con 2 visitas o más`}
        />
        <Indicador
          etiqueta="Contacto verificado"
          valor={pct(r.verificadas, r.tarjetas)}
          nota={`${num(r.verificadas)} tarjetas pueden canjear premios`}
        />
        <Indicador
          etiqueta="Premios entregados"
          valor={num(r.premiosEntregados)}
          nota={`${num(r.premiosDisponibles)} ganados sin canjear`}
        />
      </dl>

      <Seccion
        titulo="Actividad diaria · últimos 28 días"
        nota="Visitas acreditadas (barras) y tarjetas nuevas (línea), por día de compra. Una visita por cliente, día y sucursal."
      >
        <GraficaDias dias={a.porDia} />
      </Seccion>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Seccion
          titulo="Verificación"
          nota="Verificar el contacto es lo que permite canjear premios. Hoy solo se puede verificar el correo."
        >
          <Barras
            filas={a.verificacion
              .filter((p) => p.orden <= 3)
              .map((p) => ({ k: p.paso, v: p.n, acento: p.orden === 3 }))}
            total={a.verificacion.find((p) => p.orden === 1)?.n ?? 0}
          />
          <p className="mt-3 text-xs text-muted">
            Por verificar: {num(a.verificacion.find((p) => p.orden === 5)?.n ?? 0)} con correo
            (candidatas a un recordatorio) y{' '}
            {num(a.verificacion.find((p) => p.orden === 4)?.n ?? 0)} solo con celular, que necesitan
            agregar su correo en el perfil.
          </p>
        </Seccion>

        <Seccion
          titulo="Camino al premio"
          nota="Tarjetas por número de estampas en el ciclo actual. Los premios se dan en las posiciones 5 y 10."
        >
          <GraficaEstampas filas={a.estampas} />
          <p className="mt-3 text-xs text-muted">
            {num(r.tarjetasCercaPremio)} tarjetas a una visita del siguiente premio ·{' '}
            {num(r.estampasEnCirculacion)} estampas en circulación.
          </p>
        </Seccion>

        <Seccion
          titulo="Control de acumulación"
          nota="Con qué comprobante se registró cada visita. Sin folio ni foto no hay forma de revisar una acreditación después."
        >
          <Barras
            filas={a.captura
              .filter((c) => c.grupo === 'comprobante')
              .map((c) => ({ k: c.categoria, v: c.n, acento: c.orden <= 3, malo: c.orden === 4 }))}
            total={r.visitas}
          />
          <p className="mt-3 text-xs text-muted">
            {pct(r.visitasConComprobante, r.visitas)} de las visitas tienen comprobante ·{' '}
            {num(r.pendientesRevision)} visitas pendientes de revisión.
          </p>
          <h3 className="mt-5 text-sm font-semibold text-ink">Cómo se identificó al cliente</h3>
          <div className="mt-2">
            <Barras
              filas={a.captura
                .filter((c) => c.grupo === 'origen')
                .map((c) => ({ k: c.categoria, v: c.n, acento: true }))}
              total={r.visitas}
            />
          </div>
        </Seccion>

        <Seccion
          titulo="Alcance de la tarjeta"
          nota="Dónde vive la tarjeta y a quién se le puede escribir."
        >
          <Barras
            filas={[
              { k: 'Acepta promociones', v: r.optIn, acento: true },
              { k: 'Contacto verificado', v: r.verificadas, acento: true },
              { k: 'En Apple Wallet', v: r.appleWallet },
              { k: 'En Google Wallet', v: r.googleWallet },
            ]}
            total={r.tarjetas}
          />
          <p className="mt-3 text-xs text-muted">
            Apple Wallet cuenta dispositivos registrados; Google Wallet, pases pedidos.
          </p>
        </Seccion>
      </div>

      <section className="mt-6 overflow-x-auto rounded-lg border border-rule bg-cream">
        <h2 className="px-4 pt-4 font-sans text-base font-semibold text-ink">Por sucursal</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] text-muted">
              <th className="px-3 py-2 font-semibold">Sucursal</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 text-right font-semibold">Visitas 7 d</th>
              <th className="px-3 py-2 text-right font-semibold">Visitas</th>
              <th className="px-3 py-2 text-right font-semibold">Clientes</th>
              <th className="px-3 py-2 text-right font-semibold">Altas en caja</th>
              <th className="px-3 py-2 text-right font-semibold">Con comprobante</th>
              <th className="px-3 py-2 text-right font-semibold">Premios</th>
              <th className="px-3 py-2 text-right font-semibold">Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {a.porSucursal.map((s) => (
              <tr key={s.sucursal} className="border-b border-rule last:border-0">
                <td className="px-3 py-2.5 font-semibold text-ink">{s.sucursal}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.estado === 'Participa' ? 'bg-disponible/10 text-disponible' : 'bg-muted/10 text-muted'}`}
                  >
                    {s.estado}
                  </span>
                </td>
                <Celda n={s.visitas7d} />
                <Celda n={s.visitas} />
                <Celda n={s.clientes} />
                <Celda n={s.altas} />
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {num(s.conComprobante)}{' '}
                  <span className="text-muted">({pct(s.conComprobante, s.visitas)})</span>
                </td>
                <Celda n={s.premiosEntregados} />
                <Celda n={s.pendientes} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-rule px-3 py-2 text-xs text-muted">
          Un cliente puede visitar varias sucursales: los clientes por sucursal no se suman entre
          sí. Las altas en caja son tarjetas creadas desde ese mostrador; el resto se registró en el
          sitio.
        </p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border border-rule bg-cream">
        <h2 className="px-4 pt-4 font-sans text-base font-semibold text-ink">Premios</h2>
        {a.premios.length === 0 ? (
          <p className="px-4 pt-2 pb-4 text-sm text-muted">
            Todavía nadie ha llegado a su primer premio (5 estampas).
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] text-muted">
                <th className="px-3 py-2 font-semibold">Premio</th>
                <th className="px-3 py-2 text-right font-semibold">Estampas</th>
                <th className="px-3 py-2 text-right font-semibold">Ganados</th>
                <th className="px-3 py-2 text-right font-semibold">Entregados</th>
                <th className="px-3 py-2 text-right font-semibold">Sin canjear</th>
              </tr>
            </thead>
            <tbody>
              {a.premios.map((p) => (
                <tr
                  key={`${p.premio}-${p.estampas}`}
                  className="border-b border-rule last:border-0"
                >
                  <td className="px-3 py-2.5 font-semibold text-ink">{p.premio}</td>
                  <Celda n={p.estampas} />
                  <Celda n={p.generados} />
                  <Celda n={p.entregados} />
                  <Celda n={p.disponibles} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-rule bg-cream p-4">
        <h2 className="font-sans text-base font-semibold text-ink">Cómo se calcula</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <Definicion termino="Visita">
            Acreditación ACREDITADA; no cuenta la migración de tarjetas físicas. Se agrupa por la
            fecha del ticket.
          </Definicion>
          <Definicion termino="Cliente que regresa">
            Tarjeta con dos o más visitas acreditadas, entre las que tienen al menos una. Con pocas
            semanas de programa será bajo por definición.
          </Definicion>
          <Definicion termino="Contacto verificado">
            Tarjeta con correo o celular verificado. Sin verificar, el cliente acumula pero no
            canjea.
          </Definicion>
          <Definicion termino="Con comprobante">
            Visita con foto del ticket o con folio real (los folios «SF-…» los pone el sistema
            cuando no se capturó).
          </Definicion>
          <Definicion termino="Ventana">
            «7 días» = hoy y los 6 anteriores, hora del negocio; se compara con los 7 días previos.
          </Definicion>
        </dl>
      </section>
    </MarcoPanel>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Indicador({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1 rounded-lg border border-rule bg-cream px-4 py-3">
      <dt className="text-xs font-medium text-muted">{etiqueta}</dt>
      <dd className="font-display text-3xl text-ink tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted">{nota}</dd>
    </div>
  );
}

function Delta({ valor, children }: { valor: number; children: React.ReactNode }) {
  const color = valor > 0 ? 'text-disponible' : valor < 0 ? 'text-danger' : 'text-muted';
  return <span className={`font-semibold ${color}`}>{children}</span>;
}

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-lg border border-rule bg-cream p-4 lg:mt-0">
      <h2 className="font-sans text-base font-semibold text-ink">{titulo}</h2>
      <p className="mt-1 mb-4 text-xs text-muted">{nota}</p>
      {children}
    </section>
  );
}

function Celda({ n }: { n: number }) {
  return <td className="px-3 py-2.5 text-right font-mono tabular-nums">{num(n)}</td>;
}

function Definicion({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-ink">{termino}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </>
  );
}

/** Barras horizontales sobre un mismo total, con cantidad y porcentaje. */
function Barras({
  filas,
  total,
}: {
  filas: readonly { k: string; v: number; acento?: boolean; malo?: boolean }[];
  total: number;
}) {
  const max = Math.max(total, 1);
  return (
    <ul className="grid gap-2">
      {filas.map((f) => (
        <li
          key={f.k}
          className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-xs"
        >
          <span className="text-ink">{f.k}</span>
          <span className="h-3.5 overflow-hidden rounded-sm bg-rule">
            <span
              className={`block h-full rounded-sm ${f.malo ? 'bg-danger' : f.acento ? 'bg-ink' : 'bg-crust'}`}
              style={{ width: `${Math.min(100, (f.v / max) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-ink tabular-nums">
            {num(f.v)} <span className="text-muted">· {pct(f.v, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Visitas por día (barras) y tarjetas nuevas (línea), en SVG escalable. */
function GraficaDias({ dias }: { dias: AnaliticaLealtad['porDia'] }) {
  const W = 720;
  const H = 220;
  const m = { t: 12, r: 12, b: 26, l: 30 };
  const n = Math.max(dias.length, 1);
  const paso = (W - m.l - m.r) / n;
  const ancho = paso * 0.7;
  const yMax = Math.max(4, ...dias.map((d) => Math.max(d.visitas, d.altas)));
  const y = (v: number) => H - m.b - ((H - m.t - m.b) * v) / yMax;
  const x = (i: number) => m.l + i * paso + (paso - ancho) / 2;
  const ticks = [0, Math.round(yMax / 2), yMax];
  const cada = 4;
  const linea = dias.map((d, i) => `${x(i) + ancho / 2},${y(d.altas)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Visitas y altas por día">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="stroke-rule" />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
            {t}
          </text>
        </g>
      ))}
      {dias.map((d, i) => (
        <g key={d.dia}>
          <rect
            x={x(i)}
            y={y(d.visitas)}
            width={ancho}
            height={Math.max(0, y(0) - y(d.visitas))}
            rx={3}
            className="fill-ink"
          >
            <title>{`${fecha(d.dia)}: ${d.visitas} visitas, ${d.clientes} clientes, ${d.altas} tarjetas nuevas`}</title>
          </rect>
          {(i % cada === 0 || i === dias.length - 1) && (
            <text
              x={x(i) + ancho / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {diaMes(d.dia)}
            </text>
          )}
        </g>
      ))}
      <polyline
        points={linea}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-agotado"
      />
    </svg>
  );
}

/** Tarjetas por estampas; a una del premio en otro color. */
function GraficaEstampas({ filas }: { filas: AnaliticaLealtad['estampas'] }) {
  const max = Math.max(1, ...filas.map((f) => f.tarjetas));
  return (
    <ol
      className="grid h-36 items-end gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(filas.length, 1)}, minmax(0, 1fr))` }}
    >
      {filas.map((f) => {
        const cerca = f.estampas === 4 || f.estampas === 9;
        return (
          <li
            key={f.estampas}
            className="grid h-full grid-rows-[1fr_auto_auto] items-end justify-items-center gap-1 text-xs"
          >
            <span
              className={`w-full max-w-8 rounded-t-sm ${cerca ? 'bg-agotado' : 'bg-ink'}`}
              style={{ height: `${(f.tarjetas / max) * 100}%`, minHeight: f.tarjetas ? 3 : 0 }}
              title={`${f.tarjetas} tarjetas con ${f.estampas} estampas`}
            />
            <span className="font-mono text-ink tabular-nums">{f.tarjetas}</span>
            <span className="text-muted">{f.estampas}</span>
          </li>
        );
      })}
    </ol>
  );
}
