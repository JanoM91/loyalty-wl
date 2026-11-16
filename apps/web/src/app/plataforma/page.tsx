import type { Metadata } from 'next';
import { listarNegocios } from '@wl/database';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from './Marco';

export const metadata: Metadata = { title: 'Negocios' };
export const dynamic = 'force-dynamic';

export default async function NegociosPage() {
  const sesion = await exigirPlataforma();
  const negocios = await listarNegocios();
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
