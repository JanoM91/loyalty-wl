import type { Metadata } from 'next';

import { Icono } from '@/components/admin/Icono';
import { SECCIONES_PLATAFORMA, SECCION_CUENTA } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { salir } from '../acciones';

export const metadata: Metadata = { title: 'Más' };
export const dynamic = 'force-dynamic';

const RENGLON =
  'flex min-h-[64px] w-full items-center gap-4 border-t border-[#EFE3D3] px-2 py-3 text-left first:border-t-0 hover:bg-crumb/60';

/** Todas las secciones, para el celular (la barra inferior solo tiene cuatro). */
export default async function MasPage() {
  const sesion = await exigirPlataforma();
  const enlaces = [...SECCIONES_PLATAFORMA.filter((s) => !s.enBarra), SECCION_CUENTA];
  return (
    <MarcoPlataforma sesion={sesion} actual="mas" titulo="Más">
      <div className="rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-2 sm:p-3">
        <ul>
          {enlaces.map((s) => (
            <li key={s.id}>
              <a href={s.ruta} className={RENGLON}>
                <span className="grid size-[42px] flex-none place-items-center rounded-[13px] bg-crumb text-ink">
                  <Icono nombre={s.icono} tam={22} />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <b className="text-[16px] font-semibold text-ink">{s.texto}</b>
                  <span className="text-[14px] text-[#5A4F63]">{s.descripcion}</span>
                </span>
                <Icono nombre="chevron" tam={18} className="flex-none text-[#5A4F63]" />
              </a>
            </li>
          ))}
          <li>
            <a href="/plataforma/exportar" download className={RENGLON}>
              <span className="grid size-[42px] flex-none place-items-center rounded-[13px] bg-crumb text-ink">
                <Icono nombre="descargar" tam={22} />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <b className="text-[16px] font-semibold text-ink">Descargar clubes y dueños</b>
                <span className="text-[14px] text-[#5A4F63]">
                  Para Excel: estado, uso y contacto
                </span>
              </span>
            </a>
          </li>
          <li>
            <form action={salir}>
              <button type="submit" className={RENGLON}>
                <span className="grid size-[42px] flex-none place-items-center rounded-[13px] bg-crumb text-ink">
                  <Icono nombre="salir" tam={22} />
                </span>
                <b className="text-[16px] font-semibold text-ink">Salir</b>
              </button>
            </form>
          </li>
        </ul>
      </div>
    </MarcoPlataforma>
  );
}
