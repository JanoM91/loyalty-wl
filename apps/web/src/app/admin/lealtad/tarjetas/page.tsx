import type { Metadata } from 'next';
import { listarTarjetas, programaVigente, type FiltroTarjetas } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil, fechaLarga } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

const FILTROS: Record<FiltroTarjetas, string> = {
  todas: 'Todos',
  'con-premio': 'Con premio',
  'sin-verificar': 'Sin verificar',
  'inactivas-21': 'Sin venir en 21 días',
};

export default async function TarjetasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const { q, filtro: f } = await searchParams;
  const filtro = (f && f in FILTROS ? f : 'todas') as FiltroTarjetas;

  const [tarjetas, programa] = await Promise.all([
    listarTarjetas({ busqueda: q, filtro, limite: 200 }),
    programaVigente(),
  ]);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Clientes"
      descripcion="Toca a un cliente para ver su tarjeta. Los contactos se muestran ocultos en parte."
    >
      <form className="mb-3 flex gap-2" role="search">
        {filtro !== 'todas' && <input type="hidden" name="filtro" value={filtro} />}
        <label className="sr-only" htmlFor="buscar-cliente">
          Buscar cliente
        </label>
        <input
          id="buscar-cliente"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="Nombre, código o celular"
          className="min-h-[44px] min-w-0 flex-1 rounded-sm border-[1.5px] border-rule bg-white px-3"
        />
        <button
          type="submit"
          className="min-h-[44px] shrink-0 rounded-sm bg-ink px-4 text-sm font-semibold text-cream"
        >
          Buscar
        </button>
      </form>
      <nav aria-label="Mostrar" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {Object.entries(FILTROS).map(([k, v]) => {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (k !== 'todas') params.set('filtro', k);
          const destino = params.size ? `?${params}` : '?';
          const activo = filtro === k;
          return (
            <a
              key={k}
              href={destino}
              aria-current={activo ? 'true' : undefined}
              className={`inline-flex min-h-[40px] shrink-0 items-center rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${activo ? 'border-ink bg-ink text-cream' : 'border-rule bg-white text-ink hover:border-ink'}`}
            >
              {v}
            </a>
          );
        })}
      </nav>

      {tarjetas.length === 0 ? (
        <div className="rounded-lg border border-rule bg-white px-4 py-8 text-center">
          <p className="font-semibold text-ink">
            {q || filtro !== 'todas'
              ? 'Nadie coincide con esa búsqueda.'
              : 'Todavía no hay clientes.'}
          </p>
          <p className="mt-1 text-sm text-[#5A4F63]">
            {q || filtro !== 'todas'
              ? 'Prueba con otro nombre o con los últimos 4 dígitos del celular.'
              : 'Aparecen aquí en cuanto alguien escanea tu cartel QR o lo das de alta en la caja.'}
          </p>
          {!q && filtro === 'todas' && (
            <a
              href="/admin/lealtad/caja?accion=nuevo"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-sm bg-ink px-5 text-sm font-semibold text-cream"
            >
              Dar de alta a un cliente
            </a>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 md:hidden">
          {tarjetas.map((t) => (
            <li key={t.codigo}>
              <a
                href={`/admin/lealtad/tarjetas/${t.codigo}`}
                className="flex min-h-[64px] items-center gap-3 rounded-lg border border-rule bg-white px-4 py-3 active:bg-crumb"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {t.nombre ?? 'Sin nombre'}
                  </span>
                  <span className="block truncate text-xs text-[#5A4F63]">
                    {t.ultimaVisita
                      ? `Última visita ${fechaCivil(t.ultimaVisita)}`
                      : 'Sin visitas aún'}
                    {t.verificada ? '' : ' · sin verificar'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-ink">
                    {t.estampas}/{programa.posiciones}
                  </span>
                  {t.premiosDisponibles > 0 ? (
                    <span className="mt-0.5 inline-block rounded-full bg-disponible/10 px-2 py-0.5 text-[11px] font-semibold text-disponible">
                      {t.premiosDisponibles === 1 ? '1 premio' : `${t.premiosDisponibles} premios`}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-[#5A4F63]">sellos</span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div
        className={`hidden overflow-x-auto rounded-lg border border-rule bg-cream ${tarjetas.length ? 'md:block' : ''}`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] text-muted">
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-3 py-2 font-semibold">Contacto</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 text-right font-semibold">Sellos</th>
              <th className="px-3 py-2 text-right font-semibold">Premios</th>
              <th className="px-3 py-2 font-semibold">Última visita</th>
              <th className="px-3 py-2 font-semibold">Alta</th>
            </tr>
          </thead>
          <tbody>
            {tarjetas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  {q || filtro !== 'todas'
                    ? 'Ninguna tarjeta coincide.'
                    : 'Todavía no hay tarjetas.'}
                </td>
              </tr>
            )}
            {tarjetas.map((t) => (
              <tr key={t.codigo} className="border-b border-rule last:border-0 hover:bg-crumb">
                <td className="px-3 py-2.5">
                  <a
                    href={`/admin/lealtad/tarjetas/${t.codigo}`}
                    className="font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {t.nombre ?? 'Sin nombre'}
                  </a>
                  <span className="block font-mono text-xs text-muted">{t.codigo}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{t.contacto}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.verificada ? 'bg-disponible/10 text-disponible' : 'bg-agotado/10 text-agotado'}`}
                  >
                    {t.verificada ? 'Verificada' : 'Sin verificar'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {t.estampas}/{programa.posiciones}
                  {t.ciclo > 1 ? (
                    <span className="block text-xs text-muted">tarjeta {t.ciclo}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {t.premiosDisponibles}
                </td>
                <td className="px-3 py-2.5">{t.ultimaVisita ? fechaCivil(t.ultimaVisita) : '—'}</td>
                <td className="px-3 py-2.5">
                  {fechaLarga(t.alta)}
                  {t.sucursalAlta ? (
                    <span className="block text-xs text-muted">{t.sucursalAlta}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tarjetas.length > 0 && (
        <p className="mt-3 text-xs text-[#5A4F63]">
          Se muestran hasta 200 clientes, los más recientes primero.
        </p>
      )}
    </MarcoPanel>
  );
}
