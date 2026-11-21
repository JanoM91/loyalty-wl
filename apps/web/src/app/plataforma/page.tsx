import type { Metadata } from 'next';
import {
  borradoAutomaticoEncendido,
  clubesEnPausa,
  estadoComercialDe,
  listarNegocios,
} from '@wl/database';
import { arcadeVigente, diasEnPausa } from '@wl/domain';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from './Marco';
import { borradoAutomatico } from './acciones';

export const metadata: Metadata = { title: 'Negocios' };
export const dynamic = 'force-dynamic';

const BOTON =
  'min-h-[44px] rounded-full border border-rule px-5 text-[15px] text-ink hover:border-ink';

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<{ borrado?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [negocios, pausados, automatico, { borrado }] = await Promise.all([
    listarNegocios(),
    clubesEnPausa(),
    borradoAutomaticoEncendido(),
    searchParams,
  ]);
  const listos = pausados.filter((c) => c.listo);
  return (
    <MarcoPlataforma
      sesion={sesion}
      titulo="Negocios"
      descripcion={
        negocios.length === 1
          ? '1 programa de lealtad.'
          : `${negocios.length} programas de lealtad.`
      }
      acciones={
        <a
          href="/plataforma/nuevo"
          className="inline-flex min-h-[48px] items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-cream"
        >
          Nuevo negocio
        </a>
      }
    >
      {borrado && (
        <p className="mb-6 rounded-md bg-ink px-4 py-3 text-[15px] text-cream">
          Se borró /{borrado} con todos sus datos.
        </p>
      )}

      <section className="mb-10 grid gap-3 rounded-xl border border-rule p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl text-ink">Clubes en pausa</h2>
          <form action={borradoAutomatico}>
            <input type="hidden" name="encender" value={automatico ? '0' : '1'} />
            <button type="submit" className={BOTON} aria-pressed={automatico}>
              Borrado automático: <b>{automatico ? 'encendido' : 'apagado'}</b>
            </button>
          </form>
        </div>
        <p className="max-w-prose text-[14px] text-muted">
          {automatico
            ? 'Cada día a las 4:10 a. m. se borran solos los clubes con 30 días en pausa.'
            : 'Apagado: nada se borra solo. Borra a mano desde la ficha de cada club.'}{' '}
          {pausados.length === 0
            ? 'Hoy no hay clubes en pausa.'
            : `${pausados.length} en pausa; ${listos.length} ya ${listos.length === 1 ? 'cumplió' : 'cumplieron'} 30 días.`}
        </p>
        {pausados.length > 0 && (
          <ul className="grid text-[15px]">
            {pausados.map((c) => (
              <li key={c.negocio.id} className="border-t border-rule">
                <a
                  href={`/plataforma/${c.negocio.slug}`}
                  className="flex flex-wrap justify-between gap-3 py-2.5"
                >
                  <span className="text-ink">{c.negocio.nombre}</span>
                  <span className={c.listo ? 'font-semibold text-agotado' : 'text-muted'}>
                    {c.diasEnPausa} {c.diasEnPausa === 1 ? 'día' : 'días'} en pausa · {c.tarjetas}{' '}
                    {c.tarjetas === 1 ? 'tarjeta' : 'tarjetas'}
                    {c.listo ? ' · listo para borrar' : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {negocios.length === 0 ? (
        <p className="text-muted">
          Todavía no hay negocios.{' '}
          <a href="/plataforma/nuevo" className="text-ink underline underline-offset-4">
            Crea el primero.
          </a>
        </p>
      ) : (
        <ul className="grid">
          {negocios.map(({ negocio, sucursales, tarjetas }) => (
            <li key={negocio.id} className="border-t border-rule">
              <a
                href={`/plataforma/${negocio.slug}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
              >
                <span className="grid gap-0.5">
                  <b className="text-[18px] font-semibold text-ink">{negocio.nombre}</b>
                  <span className="text-[14px] text-muted">
                    /{negocio.slug}, {sucursales} {sucursales === 1 ? 'sucursal' : 'sucursales'},{' '}
                    {tarjetas} {tarjetas === 1 ? 'tarjeta' : 'tarjetas'}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="rounded-full border border-rule px-2.5 py-1 text-ink">
                    {negocio.ajustes.plan === 'PRIVADA' ? 'Privada' : 'Lite'}
                  </span>
                  {estadoComercialDe(negocio) === 'PRUEBA' && (
                    <span className="rounded-full border border-rule px-2.5 py-1 text-ink">
                      En prueba
                    </span>
                  )}
                  {estadoComercialDe(negocio) === 'PAUSADO' && (
                    <span className="rounded-full bg-agotado/15 px-2.5 py-1 font-semibold text-agotado">
                      En pausa ·{' '}
                      {diasEnPausa(negocio.ajustes.pruebaVence, negocio.ajustes.pagadoHasta)} d
                    </span>
                  )}
                  {arcadeVigente(negocio.ajustes.arcade) && (
                    <span className="rounded-full border border-rule px-2.5 py-1 text-ink">
                      Arcade
                    </span>
                  )}
                  {!negocio.activo && (
                    <span className="rounded-full bg-agotado/15 px-2.5 py-1 font-semibold text-agotado">
                      Suspendido
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </MarcoPlataforma>
  );
}
