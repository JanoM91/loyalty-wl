import type { Metadata } from 'next';
import { resumenLealtad } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { SubnavLealtad } from '@/components/admin/SubnavLealtad';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Programa de lealtad' };
export const dynamic = 'force-dynamic';

const porcentaje = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)} %`);

/**
 * Resumen del programa para la administración.
 *
 * Primero lo que pide acción (pendientes, sucursales apagadas), después cómo
 * va. Todo cuenta solo compras identificadas con tarjeta, y la pantalla lo
 * dice: no son las ventas del negocio.
 */
export default async function LealtadResumenPage() {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const r = await resumenLealtad(7);
  const maxVisitas = Math.max(1, ...r.porDia.map((d) => d.visitas));
  const apagadas = r.porSucursal.filter((s) => !s.participa);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Programa de lealtad"
      descripcion={`Del ${fechaCivil(new Date(`${r.desde}T00:00:00Z`))} al ${fechaCivil(new Date(`${r.hasta}T00:00:00Z`))}. Solo compras identificadas con tarjeta; no son las ventas totales.`}
    >
      <SubnavLealtad actual="/admin/lealtad" pendientes={r.pendientes} />

      <div className="grid gap-3">
        {r.pendientes > 0 && (
          <a
            href="/admin/lealtad/pendientes"
            className="block rounded-md border-l-[3px] border-agotado bg-agotado/5 px-4 py-3 text-sm text-ink-soft hover:bg-agotado/10"
          >
            <b className="font-semibold text-agotado">
              {r.pendientes} {r.pendientes === 1 ? 'visita espera' : 'visitas esperan'} revisión
              central.
            </b>{' '}
            Contingencias y tickets fuera de plazo. Revisar →
          </a>
        )}
        {apagadas.length > 0 && (
          <a
            href="/admin/lealtad/sucursales"
            className="block rounded-md border-l-[3px] border-ink bg-cream px-4 py-3 text-sm text-ink-soft hover:bg-crumb"
          >
            <b className="font-semibold text-ink">
              {apagadas.map((s) => s.nombre).join(', ')}{' '}
              {apagadas.length === 1 ? 'todavía no participa' : 'todavía no participan'}.
            </b>{' '}
            Enciéndela el día que su personal esté capacitado →
          </a>
        )}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador
          etiqueta="Tarjetas activas"
          valor={r.tarjetas}
          nota={`${r.tarjetasNuevas} nuevas en 7 días`}
        />
        <Indicador
          etiqueta="Clientes que volvieron (7 días)"
          valor={r.clientesActivos}
          nota="Tarjetas distintas con al menos una visita"
        />
        <Indicador
          etiqueta="Visitas acreditadas (7 días)"
          valor={r.visitas}
          nota="Una estampa por visita"
        />
        <Indicador
          etiqueta="Contacto verificado"
          valor={porcentaje(r.verificadas, r.tarjetas)}
          nota={`${porcentaje(r.conPromociones, r.tarjetas)} acepta promociones`}
        />
        <Indicador
          etiqueta="Premios entregados (7 días)"
          valor={r.premiosEntregados}
          nota={`${r.premiosGenerados} generados en 7 días · ${r.premiosDisponibles} sin canjear en total`}
        />
        <Indicador
          etiqueta="Pendientes de revisión"
          valor={r.pendientes}
          nota="Contingencias y fuera de plazo"
        />
      </dl>

      <section className="mt-6 rounded-lg border border-rule bg-cream p-4">
        <h2 className="font-sans text-base font-semibold text-ink">Visitas acreditadas por día</h2>
        <ol className="mt-4 grid h-40 grid-cols-7 items-end gap-2" aria-label="Visitas por día">
          {r.porDia.map((d) => (
            <li
              key={d.fecha}
              className="grid h-full grid-rows-[1fr_auto_auto] items-end justify-items-center gap-1 text-xs"
            >
              <span
                className="w-full max-w-10 rounded-t-sm bg-ink"
                style={{
                  height: `${(d.visitas / maxVisitas) * 100}%`,
                  minHeight: d.visitas ? 3 : 0,
                }}
                title={`${d.visitas} visitas`}
              />
              <span className="font-mono text-ink tabular-nums">{d.visitas}</span>
              <span className="text-muted">
                {fechaCivil(new Date(`${d.fecha}T00:00:00Z`))
                  .split(' ')
                  .slice(0, 2)
                  .join(' ')}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          Por fecha de compra, en la hora del negocio. Las altas del día están en la tabla de abajo.
        </p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border border-rule bg-cream">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] tracking-wider text-muted uppercase">
              <th className="px-3 py-2 font-semibold">Sucursal</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 text-right font-semibold">Visitas</th>
              <th className="px-3 py-2 text-right font-semibold">Clientes únicos</th>
              <th className="px-3 py-2 text-right font-semibold">Premios entregados</th>
              <th className="px-3 py-2 text-right font-semibold">Altas</th>
            </tr>
          </thead>
          <tbody>
            {r.porSucursal.map((s) => (
              <tr key={s.id} className="border-b border-rule last:border-0">
                <td className="px-3 py-2.5 font-semibold text-ink">{s.nombre}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.participa ? 'bg-disponible/10 text-disponible' : 'bg-muted/10 text-muted'}`}
                  >
                    {s.participa ? 'Participa' : 'Apagada'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.visitas}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {s.clientesUnicos}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {s.premiosEntregados}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.altas}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-rule px-3 py-2 text-xs text-muted">
          Un cliente puede visitar varias sucursales: los únicos por sucursal no se suman entre sí.
        </p>
      </section>
    </MarcoPanel>
  );
}

function Indicador({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: number | string;
  nota: string;
}) {
  return (
    <div className="grid content-start gap-1 rounded-lg border border-rule bg-cream px-4 py-3">
      <dt className="text-xs font-medium text-muted">{etiqueta}</dt>
      <dd className="font-display text-3xl text-ink tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted">{nota}</dd>
    </div>
  );
}
