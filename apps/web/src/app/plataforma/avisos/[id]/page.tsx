import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { destinatariosDeAviso, leerAvisoPlataforma } from '@wl/database';

import { parrafosDe } from '@/lib/avisos-plataforma';
import { negociosDelPanel } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../../Marco';
import { AvisoDeAccion, Panel } from '../../piezas';
import { ActualizarEstados } from '../Controles';

export const metadata: Metadata = { title: 'Aviso' };
export const dynamic = 'force-dynamic';

const cuando = (d: Date) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** Cómo se ve cada estado de entrega: texto y colores (nunca solo el color). */
const ESTADO: Readonly<Record<string, { texto: string; clase: string }>> = {
  ENVIADO: { texto: 'Enviado', clase: 'bg-crumb text-ink' },
  ENTREGADO: { texto: 'Entregado', clase: 'bg-[#E3F3E6] text-[#1F5630]' },
  ABIERTO: { texto: 'Abierto', clase: 'bg-[#E3F3E6] text-[#1F5630]' },
  CLIC: { texto: 'Abrió el panel', clase: 'bg-[#E3F3E6] text-[#1F5630]' },
  RETRASADO: { texto: 'Retrasado', clase: 'bg-[#F6DC9A] text-[#5B3B00]' },
  REBOTADO: { texto: 'Rebotó', clase: 'bg-[#FBE0DC] text-[#8C231B]' },
  QUEJA: { texto: 'Marcado como spam', clase: 'bg-[#FBE0DC] text-[#8C231B]' },
  SUPRIMIDO: { texto: 'Bloqueado por Resend', clase: 'bg-[#FBE0DC] text-[#8C231B]' },
  FALLIDO: { texto: 'No salió', clase: 'bg-[#FBE0DC] text-[#8C231B]' },
};

/** Un aviso enviado: el mensaje, a quién le llegó, qué pasó con cada correo y WhatsApp. */
export default async function AvisoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [{ id }, { aviso: avisoAccion }] = await Promise.all([params, searchParams]);
  const aviso = await leerAvisoPlataforma(id);
  if (!aviso) notFound();
  const [destinatarios, negocios] = await Promise.all([
    destinatariosDeAviso(id),
    negociosDelPanel(),
  ]);
  const porId = new Map(negocios.map((f) => [f.negocio.id, f.negocio]));
  const conteo = new Map<string, number>();
  for (const d of destinatarios) conteo.set(d.estado, (conteo.get(d.estado) ?? 0) + 1);
  // WhatsApp lleva el asunto en negritas y el mensaje; lo largo se corta.
  const textoWhatsApp = (nombre: string) => {
    const cuerpo = `Hola${nombre ? `, ${nombre.split(' ')[0]}` : ''}: *${aviso.asunto}*\n\n${aviso.mensaje}`;
    return cuerpo.length > 1500 ? `${cuerpo.slice(0, 1490)}…` : cuerpo;
  };

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="avisos"
      miga={{ texto: 'Avisos a dueños', ruta: '/plataforma/avisos' }}
      titulo={aviso.asunto}
      descripcion={`${aviso.audiencia} · ${aviso.enviadoEl ? `salió el ${cuando(aviso.enviadoEl)}` : aviso.estado === 'PROGRAMADO' && aviso.programadoPara ? `programado para el ${cuando(aviso.programadoPara)}` : aviso.estado.toLowerCase()} · ${aviso.enviadoPor}`}
    >
      <div className="grid gap-4">
        <AvisoDeAccion aviso={avisoAccion} />
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Panel icono="chat" titulo="Mensaje">
            <div className="grid gap-2 text-[15px] text-ink">
              {parrafosDe(aviso.mensaje).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-[#5A4F63]">
              También quedó en «Avisos» dentro del panel de {aviso.clubes}{' '}
              {aviso.clubes === 1 ? 'club' : 'clubes'}.
            </p>
          </Panel>

          <Panel
            icono="equipo"
            titulo="Destinatarios"
            contador={destinatarios.length > 0 ? String(destinatarios.length) : undefined}
            accion={
              destinatarios.some((d) => d.resendId) ? <ActualizarEstados id={id} /> : undefined
            }
          >
            {destinatarios.length === 0 ? (
              <p className="text-[15px] text-[#5A4F63]">
                {aviso.estado === 'ENVIADO'
                  ? 'Este aviso es anterior al registro por destinatario: solo se sabe cuántos correos salieron.'
                  : 'Todavía no sale.'}
              </p>
            ) : (
              <>
                <p className="mb-3 flex flex-wrap gap-1.5 text-[13px]">
                  {[...conteo].map(([estado, n]) => (
                    <span
                      key={estado}
                      className={`rounded-full px-2.5 py-1 font-semibold ${ESTADO[estado]?.clase ?? 'bg-crumb text-ink'}`}
                    >
                      {ESTADO[estado]?.texto ?? estado}: {n}
                    </span>
                  ))}
                </p>
                <ul className="grid text-[15px]">
                  {destinatarios.map((d) => {
                    const club = d.clubId ? porId.get(d.clubId) : undefined;
                    const whatsapp = club?.ajustes.alta?.whatsapp;
                    const e = ESTADO[d.estado] ?? { texto: d.estado, clase: 'bg-crumb text-ink' };
                    return (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#EFE3D3] py-3 first:border-t-0"
                      >
                        <span className="grid min-w-0 gap-0.5">
                          <b className="font-semibold text-ink">{d.club}</b>
                          <span className="text-[13px] break-all text-[#5A4F63]">
                            {d.nombre ? `${d.nombre} · ` : ''}
                            {d.email}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${e.clase}`}
                          >
                            {e.texto}
                          </span>
                          {whatsapp && (
                            <a
                              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(textoWhatsApp(d.nombre))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-[40px] items-center rounded-full border border-rule px-4 text-[14px] text-ink hover:border-ink"
                            >
                              WhatsApp
                            </a>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 max-w-prose text-[13px] text-[#5A4F63]">
                  «Enviado» quiere decir que Resend lo aceptó. «Actualizar estados» pregunta a
                  Resend si se entregó, rebotó o se abrió (los abiertos solo se ven si el
                  seguimiento de aperturas está encendido en Resend). WhatsApp abre el chat con el
                  aviso escrito; lo mandas tú desde tu teléfono.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </MarcoPlataforma>
  );
}
