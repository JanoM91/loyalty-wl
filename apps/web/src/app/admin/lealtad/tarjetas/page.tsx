import type { Metadata } from 'next';
import { listarTarjetas, prisma, programaVigente, type FiltroTarjetas } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { SubnavLealtad } from '@/components/admin/SubnavLealtad';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil, fechaLarga } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Tarjetas de lealtad' };
export const dynamic = 'force-dynamic';

const FILTROS: Record<FiltroTarjetas, string> = {
  todas: 'Todas',
  'con-premio': 'Con premio sin canjear',
  'sin-verificar': 'Sin correo verificado',
  'inactivas-21': 'Sin visitas en 21 días',
};

export default async function TarjetasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const { q, filtro: f } = await searchParams;
  const filtro = (f && f in FILTROS ? f : 'todas') as FiltroTarjetas;

  const [tarjetas, pendientes, programa] = await Promise.all([
    listarTarjetas({ busqueda: q, filtro, limite: 200 }),
    prisma.loyaltyAccrual.count({ where: { status: 'PENDIENTE' } }),
    programaVigente(),
  ]);

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Programa de lealtad"
      descripcion="Los contactos se muestran ocultos en parte: para atender a alguien basta reconocerlo."
    >
      <SubnavLealtad actual="/admin/lealtad/tarjetas" pendientes={pendientes} />

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="grid min-w-[220px] flex-1 gap-1 text-sm font-semibold text-ink">
          Buscar
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nombre, código o últimos 4 dígitos del celular"
            className="min-h-[44px] rounded-sm border-[1.5px] border-rule bg-white px-3 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Mostrar
          <select
            name="filtro"
            defaultValue={filtro}
            className="min-h-[44px] rounded-sm border-[1.5px] border-rule bg-white px-3 font-normal"
          >
            {Object.entries(FILTROS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-[44px] rounded-sm bg-ink px-5 text-sm font-semibold text-cream"
        >
          Aplicar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-rule bg-cream">
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
      <p className="mt-2 text-xs text-muted">
        Se muestran hasta 200 tarjetas, las más recientes primero.
      </p>
    </MarcoPanel>
  );
}
