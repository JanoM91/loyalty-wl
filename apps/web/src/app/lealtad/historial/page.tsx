import type { Metadata } from 'next';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import { NavTarjeta } from '@/components/lealtad/NavTarjeta';
import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { fechaCivil } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Historial' };
export const dynamic = 'force-dynamic';

export default async function HistorialPage() {
  const t = await exigirTarjeta();
  const acreditadas = t.visitas.filter((v) => !v.pendiente && !v.rechazada);
  const pendientes = t.visitas.filter((v) => v.pendiente);

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">Historial</h1>
        <p className="text-sm text-ink-soft">
          {acreditadas.length}{' '}
          {acreditadas.length === 1 ? 'visita acreditada' : 'visitas acreditadas'}.
        </p>
      </div>

      {pendientes.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
          {pendientes.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-agotado/10 text-agotado">
                <Icono nombre="reloj" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-semibold text-ink">{v.sucursal}</b>
                <span className="text-xs text-muted">
                  Compra del {fechaCivil(v.fecha)} · se está validando
                </span>
              </span>
              <span className="rounded-full bg-agotado/10 px-2.5 py-0.5 text-xs font-semibold text-agotado">
                Pendiente
              </span>
            </li>
          ))}
        </ul>
      )}

      {acreditadas.length > 0 ? (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
          {acreditadas.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-crumb text-ink-soft">
                <Icono nombre="ticket" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-semibold text-ink">{v.sucursal}</b>
                <span className="text-xs text-muted">
                  {fechaCivil(v.fecha)} · ticket <span className="font-mono">{v.folio}</span>
                </span>
              </span>
              <span className="font-mono text-sm text-ink-soft tabular-nums">+{v.estampas}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Aviso tono="neutro" titulo="Todavía no hay visitas" icono="ticket">
          Pide al personal que escanee tu código en tu próxima compra.
        </Aviso>
      )}

      <p className="text-xs text-muted">
        Una visita es una compra acreditada con su ticket: una por sucursal y día.
      </p>

      <NavTarjeta
        actual="/lealtad/historial"
        premiosListos={t.premios.filter((p) => p.disponible).length}
      />
    </>
  );
}
