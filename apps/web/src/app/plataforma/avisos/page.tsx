import type { Metadata } from 'next';
import { dueniosDeClubes, listarAvisosPlataforma } from '@wl/database';

import { LARGO_ASUNTO, LARGO_MENSAJE, parrafosDe } from '@/lib/avisos-plataforma';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { audiencias, type Audiencia } from '@/lib/plataforma/audiencia';
import { negociosDelPanel } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { Panel } from '../piezas';
import { FormularioAviso, type OpcionAudiencia } from './FormularioAviso';

export const metadata: Metadata = { title: 'Avisos a dueños' };
export const dynamic = 'force-dynamic';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const cuando = (d: Date) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** Avisos por correo a los dueños: escribir, probar, enviar y ver lo enviado. */
export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ enviados?: string; fallidos?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [negocios, historial, { enviados, fallidos }] = await Promise.all([
    negociosDelPanel(),
    listarAvisosPlataforma(),
    searchParams,
  ]);
  const duenios = await dueniosDeClubes(negocios.map((f) => f.negocio.id));
  const correosDe = new Map<string, number>();
  for (const d of duenios) correosDe.set(d.negocioId, (correosDe.get(d.negocioId) ?? 0) + 1);
  const opcion = (a: Audiencia): OpcionAudiencia => {
    const conDuenio = a.clubes.filter((f) => correosDe.has(f.negocio.id));
    return {
      valor: a.valor,
      etiqueta: a.etiqueta,
      clubes: conDuenio.length,
      correos: conDuenio.reduce((n, f) => n + (correosDe.get(f.negocio.id) ?? 0), 0),
    };
  };
  const { grupos, clubes } = audiencias(negocios);
  const salieron = Number(enviados);
  const fallaron = Number(fallidos);

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="avisos"
      titulo="Avisos a dueños"
      descripcion="Un correo de club-lealtad a los dueños de los clubes que elijas: novedades, cambios y recordatorios del servicio."
    >
      {Number.isFinite(salieron) && salieron > 0 && (
        <p role="status" className="mb-6 rounded-[14px] bg-ink px-4 py-3 text-[15px] text-cream">
          Aviso enviado: {plural(salieron, 'correo salió', 'correos salieron')}
          {fallaron > 0 ? `; ${plural(fallaron, 'no salió', 'no salieron')}` : ''}.
        </p>
      )}
      {!CORREO_CONFIGURADO && (
        <p
          role="alert"
          className="mb-6 rounded-[14px] border-l-[4px] border-[#B26A00] bg-[#FFF8E6] px-4 py-3 text-[15px] text-[#5B3B00]"
        >
          El envío de correos no está activo en este sitio: los avisos no saldrán.
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel icono="chat" titulo="Nuevo aviso">
          <div className="mt-2">
            <FormularioAviso
              grupos={grupos.map(opcion)}
              clubes={clubes.map(opcion)}
              miCorreo={sesion.email}
              largoAsunto={LARGO_ASUNTO.max}
              largoMensaje={LARGO_MENSAJE.max}
            />
          </div>
        </Panel>

        <Panel
          icono="reloj"
          titulo="Enviados"
          contador={historial.length > 0 ? String(historial.length) : undefined}
        >
          {historial.length === 0 ? (
            <p className="text-[15px] text-[#5A4F63]">
              Todavía no has enviado avisos. Aquí queda cada uno con su fecha y a quién le llegó.
            </p>
          ) : (
            <ul className="grid">
              {historial.map((a) => (
                <li key={a.id} className="border-t border-[#EFE3D3] first:border-t-0">
                  <details className="group py-3">
                    <summary className="flex min-h-[44px] cursor-pointer list-none flex-col justify-center gap-0.5">
                      <b className="text-[16px] font-semibold text-ink group-open:underline">
                        {a.asunto}
                      </b>
                      <span className="text-[13px] text-[#5A4F63]">
                        {cuando(a.creado)} · {a.audiencia} ·{' '}
                        {plural(a.enviados, 'correo', 'correos')}
                        {a.fallidos > 0 ? ` · ${a.fallidos} sin salir` : ''}
                      </span>
                    </summary>
                    <div className="mt-2 grid gap-2 rounded-[12px] bg-crumb/70 p-3 text-[14px] text-ink">
                      {parrafosDe(a.mensaje).map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                      <p className="text-[12px] text-[#5A4F63]">Lo envió {a.enviadoPor}.</p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </MarcoPlataforma>
  );
}
