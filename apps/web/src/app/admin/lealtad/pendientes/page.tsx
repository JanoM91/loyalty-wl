import type { Metadata } from 'next';
import { bitacoraLealtad, listarPendientes } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil, fechaLarga, hora, pesos } from '@/lib/lealtad/formato';
import { Revisar } from './Revisar';

export const metadata: Metadata = { title: 'Por revisar' };
export const dynamic = 'force-dynamic';

/**
 * Revisión central: contingencias, tickets fuera de plazo e incidencias.
 *
 * Solo administración resuelve, siempre con registro en la bitácora. La caja
 * de la sucursal ve el estado pero no puede aprobar lo que ella misma registró.
 */
export default async function PendientesPage() {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const [pendientes, bitacora] = await Promise.all([listarPendientes(), bitacoraLealtad(40)]);
  const incidencias = bitacora.filter((b) => b.accion === 'Incidencia reportada');

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Por revisar"
      descripcion="Lo que la caja no pudo resolver sola. Aprobar suma el sello con la fecha real de la compra."
    >
      {pendientes.length === 0 ? (
        <p className="rounded-lg border border-rule bg-cream px-4 py-6 text-center text-sm text-muted">
          No hay visitas pendientes de revisión.
        </p>
      ) : (
        <ul className="grid gap-3">
          {pendientes.map((p) => (
            <li
              key={p.id}
              className="grid gap-4 rounded-lg border border-rule bg-cream p-4 md:grid-cols-[160px_minmax(0,1fr)_220px]"
            >
              {p.fotoUrl ? (
                <a href={p.fotoUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={p.fotoUrl}
                    alt={`Ticket ${p.folio}`}
                    className="aspect-[3/4] w-full rounded-md bg-ink object-cover"
                  />
                </a>
              ) : (
                <div className="grid aspect-[3/4] place-items-center rounded-md bg-crumb px-3 text-center text-xs text-muted">
                  Sin foto del ticket
                </div>
              )}
              <dl className="grid content-start gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="text-muted">Cliente</dt>
                <dd>
                  <a
                    href={`/admin/lealtad/tarjetas/${p.codigo}`}
                    className="font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {p.nombre ?? 'Sin nombre'}
                  </a>{' '}
                  <span className="font-mono text-xs text-muted">{p.codigo}</span>
                </dd>
                <dt className="text-muted">Compra</dt>
                <dd>
                  {fechaCivil(p.fechaCompra)} · {p.sucursal}
                </dd>
                <dt className="text-muted">Ticket</dt>
                <dd className="font-mono">
                  {p.folio} · caja {p.caja} · {pesos(p.totalCentavos)}
                </dd>
                <dt className="text-muted">Motivo</dt>
                <dd>{p.nota ?? '—'}</dd>
                <dt className="text-muted">Registró</dt>
                <dd>
                  {p.registro ?? '—'} · {fechaLarga(p.creada)} {hora(p.creada)}
                </dd>
              </dl>
              <Revisar id={p.id} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="text-lg text-ink">Incidencias reportadas por caja</h2>
        {incidencias.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Ninguna reciente.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream text-sm">
            {incidencias.map((b, i) => (
              <li key={i} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[170px_minmax(0,1fr)]">
                <span className="font-mono text-xs text-muted">
                  {fechaLarga(b.cuando)} {hora(b.cuando)}
                  <br />
                  {b.quien}
                </span>
                <span>{b.detalle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg text-ink">Bitácora reciente</h2>
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream text-sm">
          {bitacora.length === 0 && (
            <li className="px-3.5 py-3 text-muted">Sin movimientos todavía.</li>
          )}
          {bitacora.map((b, i) => (
            <li key={i} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[170px_minmax(0,1fr)]">
              <span className="font-mono text-xs text-muted">
                {fechaLarga(b.cuando)} {hora(b.cuando)}
                <br />
                {b.quien}
              </span>
              <span>
                <b className="font-semibold text-ink">{b.accion}</b>
                {b.detalle ? ` · ${b.detalle}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">La bitácora no se edita ni se borra.</p>
      </section>
    </MarcoPanel>
  );
}
