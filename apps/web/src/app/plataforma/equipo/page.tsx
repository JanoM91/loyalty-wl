import type { Metadata } from 'next';
import { listarCuentasPlataforma } from '@wl/database';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { AvisoDeAccion, Panel, hace } from '../piezas';
import { CambiarEstadoCuenta, FormularioInvitar, GenerarEnlace } from './Formularios';

export const metadata: Metadata = { title: 'Equipo' };
export const dynamic = 'force-dynamic';

const ETIQUETA = 'rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap';

/** Quién entra a la plataforma: invitar, generar enlaces de contraseña y dar de baja. */
export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [cuentas, { aviso }] = await Promise.all([listarCuentasPlataforma(), searchParams]);
  const activas = cuentas.filter((c) => c.activa).length;

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="equipo"
      titulo="Equipo"
      descripcion={`${activas} ${activas === 1 ? 'cuenta activa' : 'cuentas activas'}. Cada persona entra con su correo y su contraseña; todo lo que hace queda en la Bitácora.`}
    >
      <div className="grid gap-5">
        <AvisoDeAccion aviso={aviso} />
        <Panel icono="equipo" titulo="Cuentas" contador={String(cuentas.length)}>
          <ul className="grid">
            {cuentas.map((c) => {
              const yo = c.id === sesion.userId;
              return (
                <li
                  key={c.id}
                  className="grid gap-3 border-t border-[#EFE3D3] py-4 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <b className="text-[17px] font-semibold text-ink">
                        {c.nombre}
                        {yo ? ' (tú)' : ''}
                      </b>
                      <span className="text-[14px] break-all text-[#5A4F63]">{c.email}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {!c.activa && (
                        <span className={`${ETIQUETA} bg-[#FBE0DC] text-[#8C231B]`}>De baja</span>
                      )}
                      {c.activa && !c.conContrasena && (
                        <span className={`${ETIQUETA} bg-[#ECE6FF] text-[#40209E]`}>
                          Invitación sin usar
                        </span>
                      )}
                      {c.bloqueadaHasta && (
                        <span className={`${ETIQUETA} bg-[#F6DC9A] text-[#5B3B00]`}>
                          Bloqueada por intentos
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#5A4F63]">
                    Último acceso: {hace(c.ultimoAcceso)} ·{' '}
                    {c.invitadaPor ? `invitada por ${c.invitadaPor}` : 'creada en la terminal'}
                  </p>
                  {!yo && (
                    <div className="flex flex-wrap items-start gap-3">
                      {c.activa && <GenerarEnlace id={c.id} />}
                      <CambiarEstadoCuenta id={c.id} activa={c.activa} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel icono="nuevo" titulo="Invitar a alguien">
          <p className="mb-4 max-w-prose text-[14px] text-[#5A4F63]">
            Su cuenta nace sin contraseña. Con el enlace (un solo uso, 72 horas) la elige ella
            misma. Tendrá los mismos permisos que tú: dar de alta, cobrar, borrar clubes y escribir
            a los dueños.
          </p>
          <FormularioInvitar />
        </Panel>
      </div>
    </MarcoPlataforma>
  );
}
