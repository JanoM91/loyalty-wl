import type { Metadata } from 'next';
import { ROLES_USUARIOS, avisosDelClub, marcarAvisosLeidos } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { Icono } from '@/components/admin/Icono';
import { exigirRol } from '@/lib/admin/sesion';
import { parrafosDe } from '@/lib/avisos-plataforma';
import { enlaceWhatsAppServicio } from '@/lib/contacto';

export const metadata: Metadata = { title: 'Avisos de club-lealtad' };
export const dynamic = 'force-dynamic';

const fecha = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });

/**
 * Buzón del dueño: lo que club-lealtad le escribió (también le llegó por
 * correo). Al abrirlo, los avisos nuevos quedan como leídos.
 */
export default async function AvisosDelClubPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const avisos = await avisosDelClub();
  // Se leen primero y se marcan después: en esta vista los nuevos siguen marcados.
  if (avisos.some((a) => !a.leido)) await marcarAvisosLeidos();

  return (
    <MarcoPanel
      sesion={sesion}
      titulo="Avisos de club-lealtad"
      descripcion="Novedades y recordatorios del servicio. También te llegan por correo."
    >
      {avisos.length === 0 ? (
        <div className="grid justify-items-start gap-3 rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white p-6">
          <Icono nombre="campana" tam={28} className="text-ink" />
          <p className="text-[16px] text-ink">Todavía no hay avisos para tu club.</p>
          <p className="text-[15px] text-[#5A4F63]">
            Aquí verás las novedades del servicio. ¿Tienes una duda?{' '}
            <a
              href={enlaceWhatsAppServicio('Hola, tengo una duda sobre mi club.')}
              className="font-semibold text-ink underline underline-offset-4"
            >
              Escríbenos por WhatsApp
            </a>
            .
          </p>
        </div>
      ) : (
        <ol className="grid gap-4">
          {avisos.map((a) => (
            <li
              key={a.id}
              className={`grid gap-3 rounded-[22px] border-[1.5px] bg-white p-5 sm:p-6 ${a.leido ? 'border-[#E8D8C6]' : 'border-ink'}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {!a.leido && (
                  <span className="rounded-full bg-[#C6FF3D] px-2.5 py-1 text-[12px] font-bold text-[#120A2A]">
                    Nuevo
                  </span>
                )}
                <time className="text-[14px] text-[#5A4F63]">{fecha(a.fecha)}</time>
              </div>
              <h2 className="text-[20px] text-ink">{a.asunto}</h2>
              <div className="grid gap-2 text-[16px] leading-relaxed text-ink">
                {parrafosDe(a.mensaje).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </MarcoPanel>
  );
}
