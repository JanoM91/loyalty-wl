import type { Metadata } from 'next';
import {
  ROLES_USUARIOS,
  analiticaLealtad,
  funcionesDelPlan,
  opcionesReporte,
  reportePeriodo,
  type AnaliticaLealtad,
  type OpcionesReporte,
  type ReportePeriodo,
} from '@wl/database';
import {
  CUBETAS_FRECUENCIA,
  diasDelPeriodo,
  normalizarFiltrosReporte,
  periodosDelRango,
} from '@wl/domain';

import { DescargarVisitas } from '@/components/admin/Descargas';
import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { GraficaBarras, GraficaLineas, MapaCalor } from '@/components/admin/analitica/Graficas';
import { colorDeSerie } from '@/components/admin/analitica/formato';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil } from '@/lib/lealtad/formato';
import { exigirNegocio, rutaBase } from '@/lib/negocio';

import {
  Cambio,
  Filtros,
  Indicador,
  Pestanas,
  Tarjeta,
  colorSucursal,
  esPestana,
  etiquetaPeriodo,
  fechaCorta,
  type Pestana,
} from './ui';

export const metadata: Metadata = { title: 'Números' };
export const dynamic = 'force-dynamic';

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)} %`);
const num = (n: number) => n.toLocaleString('es-MX');
const fecha = (iso: string) => fechaCivil(new Date(`${iso}T00:00:00Z`));
const diaMes = (iso: string) => fecha(iso).split(' ').slice(0, 2).join(' ');
/** Cociente para comparar periodos: sin base no hay número (y no hay cambio). */
const razon = (a: number, b: number) => (b > 0 ? a / b : NaN);
const decimal = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—';

/** "5", "5 y 10", "3, 6 y 10". */
function enLista(xs: readonly number[]): string {
  if (xs.length <= 1) return xs.map(String).join('');
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/**
 * Colores fijos de la paleta de series. Visitas y clientes van en una
 * gráfica y tarjetas nuevas y canjes en otra: en una sola, las visitas
 * aplastan a las demás contra el cero.
 */
const COLOR = {
  visitas: colorDeSerie(0),
  altas: colorDeSerie(1),
  canjes: colorDeSerie(2),
  clientes: colorDeSerie(3),
};

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Números del programa para Administración, Dueño y Gerencia.
 *
 * - **Resumen**: la foto de hoy (`analiticaLealtad`): la semana, la
 *   verificación, el camino al premio, el control de acumulación y el detalle
 *   por sucursal.
 * - **Tendencias** y **Distribución de visitas**: un periodo con filtros
 *   (`reportePeriodo`), comparado con el periodo anterior del mismo largo.
 *
 * Todo cuenta solo compras identificadas con tarjeta: no son las ventas del
 * negocio.
 */
export default async function AnaliticaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const [q, base, negocio] = await Promise.all([searchParams, rutaBase(), exigirNegocio()]);
  const administra = ROLES_USUARIOS.includes(sesion.rol);
  const pedida = uno(q.tab);
  const tab: Pestana = esPestana(pedida) ? pedida : 'resumen';
  const acciones = administra ? <DescargarVisitas base={base} /> : undefined;
  // Tendencias y Distribución son «reportes completos»: parte de Privada (en
  // Lite los administra el equipo de club-lealtad).
  const completos = funcionesDelPlan(negocio).reportesCompletos;

  if (tab === 'resumen') {
    const a = await analiticaLealtad();
    return (
      <MarcoPanel
        sesion={sesion}
        actual="/admin/lealtad"
        titulo="Números"
        descripcion={`Datos al ${fecha(a.resumen.hoy)} (hora del negocio). Solo compras identificadas con tarjeta; no son las ventas totales.`}
        acciones={acciones}
      >
        <Pestanas f={null} actual={tab} soloPrivada={!completos} />
        <div className="mt-5">
          <Resumen a={a} />
        </div>
      </MarcoPanel>
    );
  }

  if (!completos) {
    // «Mi plan» solo existe para dueños de clubes del asistente; los demás, por WhatsApp.
    const verPlan = (sesion.rol === 'ADMIN' || sesion.rol === 'DUENO') && negocio.ajustes.alta;
    return (
      <MarcoPanel
        sesion={sesion}
        actual="/admin/lealtad"
        titulo="Números"
        descripcion="Solo compras identificadas con tarjeta; no son las ventas totales."
        acciones={acciones}
      >
        <div className="grid gap-4">
          <Pestanas f={null} actual={tab} soloPrivada />
          <Tarjeta titulo="Esta vista es parte de Privada" className="max-w-2xl">
            <p className="text-sm text-ink-soft">
              Con los reportes completos eliges cualquier periodo y lo comparas con el anterior:
              tarjetas nuevas, visitas, clientes que regresan, canjes, cuántas veces vino cada
              cliente y a qué hora llega la gente, por sucursal.
            </p>
            <p className="text-sm text-ink-soft">
              El{' '}
              <a href="?" className="text-ink underline underline-offset-4">
                Resumen
              </a>{' '}
              sigue disponible en tu plan, y puedes descargar tus clientes y visitas cuando quieras.
            </p>
            {verPlan ? (
              <a
                href={`${base}/admin/plan#privada`}
                className="inline-flex min-h-[44px] items-center justify-self-start rounded-sm bg-ink px-4 text-sm font-semibold text-cream"
              >
                Ver Privada en Mi plan
              </a>
            ) : sesion.rol === 'ADMIN' || sesion.rol === 'DUENO' ? (
              <a
                href={enlaceWhatsAppServicio(
                  `Hola, quiero los reportes completos (Privada) para ${negocio.nombre}.`,
                )}
                className="inline-flex min-h-[44px] items-center justify-self-start rounded-sm bg-ink px-4 text-sm font-semibold text-cream"
              >
                Pedir Privada por WhatsApp
              </a>
            ) : (
              <p className="text-sm text-muted">Si te interesa, coméntalo con el dueño del club.</p>
            )}
          </Tarjeta>
        </div>
      </MarcoPanel>
    );
  }

  const opciones = await opcionesReporte();
  const sucs = q.suc === undefined ? [] : Array.isArray(q.suc) ? q.suc : [q.suc];
  const f = normalizarFiltrosReporte(
    { desde: uno(q.desde), hasta: uno(q.hasta), agrupar: uno(q.agrupar), sucursales: sucs },
    opciones.hoy,
    opciones.sucursales.map((s) => s.slug),
  );
  const r = await reportePeriodo(f);
  const nombre = (slug: string) => opciones.sucursales.find((s) => s.slug === slug)?.nombre ?? slug;

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Números"
      descripcion="Solo compras identificadas con tarjeta; no son las ventas totales. Días y horas del negocio."
      acciones={acciones}
    >
      <div className="grid gap-4">
        <Pestanas f={f} actual={tab} soloPrivada={false} />
        <Filtros f={f} opciones={opciones} tab={tab} />
        <p className="text-xs text-ink-soft">
          <b className="font-semibold text-ink">
            {fechaCorta(f.desde)} – {fechaCorta(f.hasta)} ·{' '}
            {f.sucursales.length ? f.sucursales.map(nombre).join(', ') : 'todas las sucursales'}
          </b>{' '}
          — se compara con {fechaCorta(r.anterior.desde)} – {fechaCorta(r.anterior.hasta)}.
        </p>
        {tab === 'tendencias' && <Tendencias r={r} opciones={opciones} />}
        {tab === 'visitas' && <Distribucion r={r} />}
      </div>
    </MarcoPanel>
  );
}

// ---------------------------------------------------------------------------
// Tendencias
// ---------------------------------------------------------------------------

function Tendencias({ r, opciones }: { r: ReportePeriodo; opciones: OpcionesReporte }) {
  const f = r.filtros;
  const a = r.actual;
  const p = r.previo;
  const ps = periodosDelRango(f.desde, f.hasta, f.agrupar);
  const etiquetas = ps.map((x) => etiquetaPeriodo(x, f.agrupar));
  const punto = new Map(r.serie.map((x) => [x.periodo, x]));
  const valores = (k: 'altas' | 'visitas' | 'canjes' | 'clientes') =>
    ps.map((x) => punto.get(x)?.[k] ?? 0);
  const visibles = opciones.sucursales.filter(
    (s) => f.sucursales.length === 0 || f.sucursales.includes(s.slug),
  );
  const seriesSucursal = visibles.map((s) => {
    const mapa = new Map(
      r.porSucursal.filter((x) => x.sucursal === s.slug).map((x) => [x.periodo, x.visitas]),
    );
    return {
      clave: s.slug,
      nombre: s.nombre,
      color: colorSucursal(opciones, s.slug),
      valores: ps.map((x) => mapa.get(x) ?? 0),
    };
  });
  const muchos = f.agrupar === 'DIA' && ps.length > 120;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Tarjetas nuevas"
          valor={num(a.altas)}
          nota={<Cambio actual={a.altas} previo={p.altas} />}
        />
        <Indicador
          etiqueta="Visitas"
          valor={num(a.visitas)}
          nota={<Cambio actual={a.visitas} previo={p.visitas} />}
        />
        <Indicador
          etiqueta="Clientes con visita"
          valor={num(a.clientes)}
          nota={<Cambio actual={a.clientes} previo={p.clientes} />}
        />
        <Indicador
          etiqueta="Visitas por cliente"
          valor={decimal(razon(a.visitas, a.clientes))}
          nota={
            <Cambio actual={razon(a.visitas, a.clientes)} previo={razon(p.visitas, p.clientes)} />
          }
        />
        <Indicador
          etiqueta="Vinieron 2 veces o más"
          valor={pct(a.repiten, a.clientes)}
          nota={
            <>
              {num(a.repiten)} de {num(a.clientes)} ·{' '}
              <Cambio
                actual={razon(a.repiten, a.clientes)}
                previo={razon(p.repiten, p.clientes)}
                puntos
              />
            </>
          }
        />
        <Indicador
          etiqueta="Regresaron del periodo anterior"
          valor={pct(a.regresaron, a.baseRegreso)}
          nota={
            a.baseRegreso === 0 ? (
              'Nadie vino en el periodo anterior'
            ) : (
              <>
                {num(a.regresaron)} de {num(a.baseRegreso)} ·{' '}
                <Cambio
                  actual={razon(a.regresaron, a.baseRegreso)}
                  previo={razon(p.regresaron, p.baseRegreso)}
                  puntos
                />
              </>
            )
          }
        />
        <Indicador
          etiqueta="Premios ganados"
          valor={num(a.premiosGanados)}
          nota={<Cambio actual={a.premiosGanados} previo={p.premiosGanados} />}
        />
        <Indicador
          etiqueta="Premios canjeados"
          valor={num(a.premiosCanjeados)}
          nota={<Cambio actual={a.premiosCanjeados} previo={p.premiosCanjeados} />}
        />
      </dl>

      <Tarjeta
        titulo="Visitas y clientes"
        nota={`Por ${f.agrupar === 'MES' ? 'mes' : f.agrupar === 'SEMANA' ? 'semana (lunes a domingo)' : 'día'}, según la fecha del ticket. Clientes: personas distintas en cada ${f.agrupar === 'MES' ? 'mes' : f.agrupar === 'SEMANA' ? 'semana' : 'día'}.${muchos ? ' Son muchos días: agrupa por semana o mes para leerlo mejor.' : ''}`}
      >
        <GraficaLineas
          titulo="Visitas y clientes por periodo"
          etiquetas={etiquetas}
          series={[
            {
              clave: 'visitas',
              nombre: 'Visitas',
              color: COLOR.visitas,
              valores: valores('visitas'),
            },
            {
              clave: 'clientes',
              nombre: 'Clientes',
              color: COLOR.clientes,
              valores: valores('clientes'),
            },
          ]}
        />
      </Tarjeta>

      <Tarjeta
        titulo="Tarjetas nuevas y canjes"
        nota="Tarjetas nuevas por la sucursal de alta; canjes por la sucursal donde se entregó el premio."
      >
        <GraficaLineas
          titulo="Tarjetas nuevas y canjes por periodo"
          etiquetas={etiquetas}
          series={[
            {
              clave: 'altas',
              nombre: 'Tarjetas nuevas',
              color: COLOR.altas,
              valores: valores('altas'),
            },
            { clave: 'canjes', nombre: 'Canjes', color: COLOR.canjes, valores: valores('canjes') },
          ]}
        />
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-crust-dark underline underline-offset-4">
            Ver en tabla
          </summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-md border border-rule">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-crumb text-left text-[11px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Periodo</th>
                  <th className="px-3 py-2 text-right font-semibold">Visitas</th>
                  <th className="px-3 py-2 text-right font-semibold">Clientes</th>
                  <th className="px-3 py-2 text-right font-semibold">Tarjetas nuevas</th>
                  <th className="px-3 py-2 text-right font-semibold">Canjes</th>
                </tr>
              </thead>
              <tbody>
                {ps.map((x, i) => (
                  <tr key={x} className="border-t border-rule">
                    <td className="px-3 py-1.5">{etiquetas[i]}</td>
                    <Celda n={punto.get(x)?.visitas ?? 0} />
                    <Celda n={punto.get(x)?.clientes ?? 0} />
                    <Celda n={punto.get(x)?.altas ?? 0} />
                    <Celda n={punto.get(x)?.canjes ?? 0} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Tarjeta>

      {seriesSucursal.length > 1 && (
        <Tarjeta
          titulo="Visitas por sucursal"
          nota="Cada sucursal conserva su color aunque cambies el filtro."
        >
          <GraficaBarras
            titulo="Visitas por sucursal y periodo"
            etiquetas={etiquetas}
            series={seriesSucursal}
          />
        </Tarjeta>
      )}

      <section className="overflow-x-auto rounded-lg border border-rule bg-cream">
        <h2 className="px-4 pt-4 font-sans text-base font-semibold text-ink">Por sucursal</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] text-muted">
              <th className="px-3 py-2 font-semibold">Sucursal</th>
              <th className="px-3 py-2 text-right font-semibold">Visitas</th>
              <th className="px-3 py-2 text-right font-semibold">Clientes</th>
              <th className="px-3 py-2 text-right font-semibold">Visitas por cliente</th>
              <th className="px-3 py-2 text-right font-semibold">Tarjetas nuevas</th>
              <th className="px-3 py-2 text-right font-semibold">Canjes</th>
            </tr>
          </thead>
          <tbody>
            {r.sucursales.map((s) => (
              <tr key={s.slug} className="border-b border-rule last:border-0">
                <td className="px-3 py-2.5 font-semibold text-ink">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                    style={{ background: colorSucursal(opciones, s.slug) }}
                    aria-hidden
                  />
                  {s.nombre}
                </td>
                <Celda n={s.visitas} />
                <Celda n={s.clientes} />
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {decimal(razon(s.visitas, s.clientes))}
                </td>
                <Celda n={s.altas} />
                <Celda n={s.canjes} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-rule px-3 py-2 text-xs text-muted">
          Un cliente puede visitar varias sucursales: los clientes por sucursal no se suman entre
          sí.
        </p>
      </section>

      <section className="rounded-lg border border-rule bg-cream p-4">
        <h2 className="font-sans text-base font-semibold text-ink">Cómo se calcula</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <Definicion termino="Periodo anterior">
            Los mismos días justo antes del periodo elegido. Con «28 días», los 28 anteriores.
          </Definicion>
          <Definicion termino="Vinieron 2 veces o más">
            Clientes con dos visitas o más dentro del periodo, entre los que vinieron al menos una
            vez. En periodos cortos («Hoy», «7 días») es bajo por definición.
          </Definicion>
          <Definicion termino="Regresaron">
            De los clientes que vinieron en el periodo anterior, cuántos volvieron en este. Es la
            mejor señal de que el programa retiene.
          </Definicion>
          <Definicion termino="Premios ganados">
            Por la fecha en que se ganaron y la sucursal de la visita que los dio.
          </Definicion>
        </dl>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribución de visitas
// ---------------------------------------------------------------------------

function Distribucion({ r }: { r: ReportePeriodo }) {
  const f = r.filtros;
  const a = r.actual;
  const frecuencia = CUBETAS_FRECUENCIA.map(
    (c) => r.frecuencia.find((x) => x.cubeta === c)?.clientes ?? 0,
  );
  const unaVez = frecuencia[0] ?? 0;
  const horas = r.horarios.map((h) => h.hora);
  const desde = horas.length ? Math.min(...horas) : 8;
  const hasta = horas.length ? Math.max(...horas) : 20;
  const columnas: number[] = [];
  for (let h = desde; h <= hasta; h++) columnas.push(h);
  const semanas = Math.max(1, Math.round(diasDelPeriodo(f.desde, f.hasta) / 7));
  const celda = (dia: number, hora: number) =>
    r.horarios.find((x) => x.dia === dia && x.hora === hora)?.visitas ?? 0;
  const mapa = DIAS_SEMANA.map((_, d) =>
    columnas.map((h) => Math.round((celda(d + 1, h) / semanas) * 10) / 10),
  );
  const porHora = columnas.map((h) =>
    r.horarios.filter((x) => x.hora === h).reduce((s, x) => s + x.visitas, 0),
  );
  const porDia = DIAS_SEMANA.map((_, d) =>
    r.horarios.filter((x) => x.dia === d + 1).reduce((s, x) => s + x.visitas, 0),
  );
  const conHora = porHora.reduce((s, x) => s + x, 0);

  return (
    <div className="grid gap-4">
      <Tarjeta
        titulo="¿Cuántas veces vino cada cliente?"
        nota={`${num(a.clientes)} clientes con al menos una visita en el periodo, según cuántas veces vinieron.`}
      >
        <GraficaBarras
          titulo="Clientes por número de visitas en el periodo"
          etiquetas={CUBETAS_FRECUENCIA.map((c) => (c === '1' ? '1 visita' : `${c} visitas`))}
          series={[
            { clave: 'clientes', nombre: 'Clientes', color: COLOR.visitas, valores: frecuencia },
          ]}
        />
        <p className="text-xs text-muted">
          {a.clientes === 0
            ? 'Sin visitas en el periodo.'
            : `${pct(unaVez, a.clientes)} vino una sola vez. Para un programa de sellos, lo que importa es que esa barra baje y crezcan las de la derecha.`}
        </p>
      </Tarjeta>

      <Tarjeta
        titulo="¿A qué hora llega la gente?"
        nota={`Visitas promedio por semana en cada día y hora (${semanas} semana${semanas === 1 ? '' : 's'} en el periodo). Sirve para turnos y para saber cuándo invitar a sacar la tarjeta.`}
      >
        <MapaCalor
          titulo="Visitas por día de la semana y hora"
          filas={DIAS_SEMANA}
          columnas={columnas.map((h) => `${h}h`)}
          valores={mapa}
          unidad="visitas por semana"
        />
        <p className="text-xs text-muted">
          Cuenta la hora en que la caja registró la visita, solo si la registró el mismo día de la
          compra: {num(conHora)} de {num(a.visitas)} visitas. Las capturadas después no dicen a qué
          hora vino el cliente.
        </p>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Visitas por hora (total del periodo)">
          <GraficaBarras
            titulo="Visitas por hora"
            etiquetas={columnas.map((h) => `${h}h`)}
            series={[{ clave: 'h', nombre: 'Visitas', color: COLOR.visitas, valores: porHora }]}
          />
        </Tarjeta>
        <Tarjeta titulo="Visitas por día de la semana (total del periodo)">
          <GraficaBarras
            titulo="Visitas por día de la semana"
            etiquetas={DIAS_SEMANA}
            series={[{ clave: 'd', nombre: 'Visitas', color: COLOR.visitas, valores: porDia }]}
          />
        </Tarjeta>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumen (la foto de hoy)
// ---------------------------------------------------------------------------

function Resumen({ a }: { a: AnaliticaLealtad }) {
  const r = a.resumen;
  const sinVerificar = r.tarjetas - r.verificadas;
  const deltaVisitas = r.visitas7d - r.visitas7dPrev;

  return (
    <>
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
          nota={`Tarjetas por número de sellos en el ciclo actual. ${a.posicionesPremio.length === 1 ? 'El premio se da en el sello' : 'Los premios se dan en los sellos'} ${enLista(a.posicionesPremio)}; en otro color, las que están a una visita.`}
        >
          <GraficaEstampas filas={a.estampas} cerca={a.cercaDelPremio} />
          <p className="mt-3 text-xs text-muted">
            {num(r.tarjetasCercaPremio)} tarjetas a una visita del siguiente premio ·{' '}
            {num(r.estampasEnCirculacion)} sellos en circulación.
            {a.diasAlPrimerPremio !== null &&
              ` La mitad de quienes ya ganaron su primer premio lo lograron en ${decimal(a.diasAlPrimerPremio)} días o menos desde su alta.`}
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
            Todavía nadie ha llegado a su primer premio
            {a.posicionesPremio[0] ? ` (${a.posicionesPremio[0]} sellos)` : ''}.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] text-muted">
                <th className="px-3 py-2 font-semibold">Premio</th>
                <th className="px-3 py-2 text-right font-semibold">Sellos</th>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

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
              className={`block h-full rounded-sm ${f.malo ? 'bg-danger' : f.acento ? 'bg-ink' : 'bg-realce'}`}
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
function GraficaEstampas({
  filas,
  cerca,
}: {
  filas: AnaliticaLealtad['estampas'];
  cerca: readonly number[];
}) {
  const max = Math.max(1, ...filas.map((f) => f.tarjetas));
  return (
    <ol
      className="grid h-36 items-end gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(filas.length, 1)}, minmax(0, 1fr))` }}
    >
      {filas.map((f) => {
        const alLado = cerca.includes(f.estampas);
        return (
          <li
            key={f.estampas}
            className="grid h-full grid-rows-[1fr_auto_auto] items-end justify-items-center gap-1 text-xs"
          >
            <span
              className={`w-full max-w-8 rounded-t-sm ${alLado ? 'bg-agotado' : 'bg-ink'}`}
              style={{ height: `${(f.tarjetas / max) * 100}%`, minHeight: f.tarjetas ? 3 : 0 }}
              title={`${f.tarjetas} tarjetas con ${f.estampas} sellos${alLado ? ' (a una visita del premio)' : ''}`}
            />
            <span className="font-mono text-ink tabular-nums">{f.tarjetas}</span>
            <span className="text-muted">{f.estampas}</span>
          </li>
        );
      })}
    </ol>
  );
}
