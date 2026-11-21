import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { detalleTarjeta, programaVigente } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { SubnavLealtad } from '@/components/admin/SubnavLealtad';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';
import { MarcaDelNegocio } from '@/components/admin/MarcaDelNegocio';
import { estiloDeMarca } from '@/lib/marca';
import { exigirNegocio } from '@/lib/negocio';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil, fechaLarga } from '@/lib/lealtad/formato';
import { regenerarEnlace } from './acciones';

export const metadata: Metadata = { title: 'Tarjeta de lealtad' };
export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  ACREDITADA: { texto: 'Acreditada', clase: 'bg-disponible/10 text-disponible' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-agotado/10 text-agotado' },
  RECHAZADA: { texto: 'Rechazada', clase: 'bg-danger/10 text-danger' },
};

export default async function DetalleTarjetaPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const negocio = await exigirNegocio();
  const { codigo } = await params;
  const t = await detalleTarjeta(decodeURIComponent(codigo));
  if (!t) notFound();
  const programa = await programaVigente();

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo={t.nombre ?? 'Cliente sin nombre'}
      descripcion={t.codigo}
    >
      <SubnavLealtad actual="/admin/lealtad/tarjetas" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <MarcaDelNegocio estilo={estiloDeMarca(negocio)} plantilla={negocio.marca.plantilla}>
          <TarjetaSellos
            programa={programa}
            datos={{
              estampas: t.estampas,
              ciclo: t.ciclo,
              nombre: t.nombre,
              premios: t.premios.map((p) => ({
                tipo: p.tipo,
                nombre: p.nombre,
                posicion: p.posicion,
                ciclo: p.ciclo,
                disponible: p.disponible,
              })),
            }}
          />
        </MarcaDelNegocio>
        <dl className="grid content-start gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted">Contacto</dt>
          <dd className="font-mono">{t.contacto}</dd>
          <dt className="text-muted">Estado</dt>
          <dd>
            {t.verificada ? 'Contacto verificado' : 'Sin verificar: puede acumular, no canjear'}
          </dd>
          <dt className="text-muted">Promociones</dt>
          <dd>
            {t.promociones
              ? `Sí, desde el ${t.promocionesDesde ? fechaLarga(t.promocionesDesde) : '—'}`
              : 'No'}
          </dd>
          <dt className="text-muted">Alta</dt>
          <dd>
            {fechaLarga(t.alta)}
            {t.sucursalAlta ? ` · ${t.sucursalAlta}` : ''}
          </dd>
          <dt className="text-muted">Términos aceptados</dt>
          <dd className="font-mono">{t.terminos}</dd>
          <dt className="text-muted">Acceso</dt>
          <dd>
            <a
              href={`/admin/lealtad/caja/acceso?tarjeta=${encodeURIComponent(t.codigo)}`}
              className="font-semibold text-crust-dark underline underline-offset-4"
            >
              Generar enlace para abrir la tarjeta en su celular
            </a>
          </dd>
          <dt className="text-muted">Enlace personal</dt>
          <dd>
            <form action={regenerarEnlace} className="inline">
              <input type="hidden" name="codigo" value={t.codigo} />
              <button
                type="submit"
                className="text-left text-crust-dark underline underline-offset-4"
              >
                Cambiarlo (si lo compartió por error; el anterior deja de servir)
              </button>
            </form>
          </dd>
        </dl>
      </div>

      <section className="mt-8">
        <h2 className="text-lg text-ink">Visitas</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-rule bg-cream">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] text-muted">
                <th className="px-3 py-2 font-semibold">Compra</th>
                <th className="px-3 py-2 font-semibold">Sucursal</th>
                <th className="px-3 py-2 font-semibold">Ticket</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 text-right font-semibold">Sellos</th>
              </tr>
            </thead>
            <tbody>
              {t.visitas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-muted">
                    Sin visitas todavía.
                  </td>
                </tr>
              )}
              {t.visitas.map((v, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2.5">{fechaCivil(v.fecha)}</td>
                  <td className="px-3 py-2.5">{v.sucursal}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{v.folio}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO[v.estado]?.clase ?? ''}`}
                    >
                      {ESTADO[v.estado]?.texto ?? v.estado}
                    </span>
                    {v.nota ? <span className="block text-xs text-muted">{v.nota}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">+{v.estampas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg text-ink">Premios</h2>
        {t.premios.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no ha ganado premios.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream text-sm">
            {t.premios.map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
              >
                <span>
                  <b className="font-semibold text-ink">{p.nombre}</b>{' '}
                  <span className="text-muted">
                    · estampa {p.posicion}, tarjeta {p.ciclo} · {fechaLarga(p.generado)}
                  </span>
                </span>
                <span className="text-xs">
                  {p.disponible
                    ? 'Disponible'
                    : `Entregado ${p.entregado ? fechaLarga(p.entregado) : ''}${p.sucursal ? ` · ${p.sucursal}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-muted">
        Ajustes de saldo, revocar y reemitir la tarjeta llegan en la fase 2. Cada ajuste quedará con
        motivo y en la bitácora; nunca se borra una acreditación.
      </p>
    </MarcoPanel>
  );
}
