import type { Metadata } from 'next';
import { ROLES_DIRECCION, prisma } from '@wl/database';

import { Icono } from '@/components/admin/Icono';
import { InstalarPanel } from '@/components/admin/InstalarPanel';
import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { salir } from '@/app/admin/entrar/acciones';
import { TITULOS_GRUPO, seccionesDelPanel, type GrupoSeccion } from '@/lib/admin/panel';
import { exigirSesion } from '@/lib/admin/sesion';
import { iconosDeApp } from '@/lib/iconos-app';
import { exigirNegocio, rutaBase } from '@/lib/negocio';
import { LogotipoClub } from '@/components/ClubLealtad';

export const metadata: Metadata = { title: 'Más' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'overflow-hidden rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';
const FILA =
  'flex min-h-[60px] w-full items-center gap-3 border-t-[1.5px] border-[#E8D8C6] px-4 py-2 text-left text-ink transition-colors hover:bg-crumb';

/**
 * «Más» de la barra inferior del celular: todas las secciones del panel en
 * una lista, agrupadas. En la computadora sobra (el menú lateral ya las
 * muestra), pero se puede abrir igual.
 */
export default async function MasPage() {
  const sesion = await exigirSesion();
  const [base, negocio] = await Promise.all([rutaBase(), exigirNegocio()]);
  const secciones = seccionesDelPanel(sesion.rol).filter(
    (s) =>
      s.id !== 'inicio' && s.id !== 'caja' && (s.id !== 'plan' || Boolean(negocio.ajustes.alta)),
  );
  const pendientes = ROLES_DIRECCION.includes(sesion.rol)
    ? await prisma.loyaltyAccrual.count({ where: { status: 'PENDIENTE' } })
    : 0;
  const grupos: GrupoSeccion[] = ['programa', 'clientes', 'negocio', 'cuenta'];

  return (
    <MarcoPanel sesion={sesion} titulo="Más">
      <div className="flex max-w-2xl flex-col gap-3">
        <InstalarPanel icono={iconosDeApp(negocio, base).apple} />
        {grupos.map((g) => {
          const del = secciones.filter((s) => s.grupo === g);
          if (del.length === 0 && g !== 'cuenta') return null;
          return (
            <section key={g} aria-labelledby={`mas-${g}`} className={TARJETA}>
              <h2
                id={`mas-${g}`}
                className="px-4 pt-3 pb-2 font-sans text-[13px] font-bold tracking-[.04em] text-[#5A4F63] uppercase"
              >
                {TITULOS_GRUPO[g]}
              </h2>
              <ul>
                {del.map((s) => (
                  <li key={s.id}>
                    <a href={`${base}${s.ruta}`} className={FILA}>
                      <span className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-crumb">
                        <Icono nombre={s.icono} tam={20} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="text-[15px]">{s.texto}</b>
                        <span className="text-[13px] text-[#5A4F63]">{s.descripcion}</span>
                      </span>
                      {s.id === 'pendientes' && pendientes > 0 ? (
                        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#6C3BFF] px-1.5 text-[13px] font-bold text-white">
                          {pendientes}
                        </span>
                      ) : null}
                      <Icono nombre="chevron" tam={18} />
                    </a>
                  </li>
                ))}
                {g === 'cuenta' && (
                  <li>
                    <form action={salir}>
                      <button type="submit" className={FILA}>
                        <span className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-crumb">
                          <Icono nombre="salir" tam={20} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <b className="text-[15px]">Salir</b>
                          <span className="text-[13px] text-[#5A4F63]">
                            Cerrar sesión en este dispositivo
                          </span>
                        </span>
                      </button>
                    </form>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
        <p className="flex items-center justify-center gap-2 pt-2 text-[12px] text-[#5A4F63]">
          Funciona con <LogotipoClub tam={13} />
        </p>
      </div>
    </MarcoPanel>
  );
}
