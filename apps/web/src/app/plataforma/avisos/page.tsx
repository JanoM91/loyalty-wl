import type { Metadata } from 'next';
import { dueniosDeClubes, listarAvisosCompletos, listarPlantillasAviso } from '@wl/database';

import { LARGO_ASUNTO, LARGO_MENSAJE } from '@/lib/avisos-plataforma';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { audiencias, type Audiencia } from '@/lib/plataforma/audiencia';
import { negociosDelPanel } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { AvisoDeAccion, Panel } from '../piezas';
import { BorrarPlantilla, CancelarAviso } from './Controles';
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
/** «2026-11-24T10:15» dentro de 10 minutos, en la hora del centro de México. */
function minimoParaProgramar(ahora: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ahora.getTime() + 10 * 60_000))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [negocios, historial, plantillas, { aviso }] = await Promise.all([
    negociosDelPanel(),
    listarAvisosCompletos(),
    listarPlantillasAviso(),
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
  const programados = historial.filter((a) => a.estado === 'PROGRAMADO');
  const pasados = historial.filter((a) => a.estado !== 'PROGRAMADO');

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="avisos"
      titulo="Avisos a dueños"
      descripcion="Un correo de club-lealtad a los dueños de los clubes que elijas: novedades, cambios y recordatorios del servicio."
    >
      <div className="mb-6 empty:hidden">
        <AvisoDeAccion aviso={aviso} />
      </div>
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
              plantillas={plantillas}
              minimoProgramar={minimoParaProgramar()}
              miCorreo={sesion.email}
              largoAsunto={LARGO_ASUNTO.max}
              largoMensaje={LARGO_MENSAJE.max}
            />
          </div>
        </Panel>

        <div className="grid gap-4">
          {programados.length > 0 && (
            <Panel icono="reloj" titulo="Programados" contador={String(programados.length)}>
              <ul className="grid">
                {programados.map((a) => (
                  <li
                    key={a.id}
                    className="grid gap-2 border-t border-[#EFE3D3] py-3 first:border-t-0"
                  >
                    <b className="text-[16px] font-semibold text-ink">{a.asunto}</b>
                    <span className="text-[13px] text-[#5A4F63]">
                      Sale el {a.programadoPara ? cuando(a.programadoPara) : '—'} · {a.audiencia} ·
                      lo programó {a.enviadoPor}
                    </span>
                    <CancelarAviso id={a.id} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            icono="chat"
            titulo="Enviados"
            contador={pasados.length > 0 ? String(pasados.length) : undefined}
          >
            {pasados.length === 0 ? (
              <p className="text-[15px] text-[#5A4F63]">
                Todavía no has enviado avisos. Aquí queda cada uno con su fecha y a quién le llegó.
              </p>
            ) : (
              <ul className="grid">
                {pasados.map((a) => (
                  <li key={a.id} className="border-t border-[#EFE3D3] first:border-t-0">
                    <a
                      href={`/plataforma/avisos/${a.id}`}
                      className="flex min-h-[56px] flex-col justify-center gap-0.5 py-3"
                    >
                      <b className="text-[16px] font-semibold text-ink underline decoration-[#E8D8C6] underline-offset-4">
                        {a.asunto}
                      </b>
                      <span className="text-[13px] text-[#5A4F63]">
                        {a.estado === 'CANCELADO'
                          ? `Cancelado · iba a ${a.audiencia}`
                          : a.estado === 'ENVIANDO'
                            ? `Saliendo… · ${a.audiencia}`
                            : `${cuando(a.enviadoEl ?? a.creado)} · ${a.audiencia} · ${plural(a.enviados, 'correo', 'correos')}${a.fallidos > 0 ? ` · ${a.fallidos} sin salir` : ''}`}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            icono="reglas"
            titulo="Plantillas"
            contador={plantillas.length > 0 ? String(plantillas.length) : undefined}
          >
            {plantillas.length === 0 ? (
              <p className="text-[15px] text-[#5A4F63]">
                Guarda un aviso como plantilla desde el formulario para reutilizarlo.
              </p>
            ) : (
              <ul className="grid">
                {plantillas.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE3D3] py-2.5 first:border-t-0"
                  >
                    <span className="grid gap-0.5">
                      <b className="text-[15px] font-semibold text-ink">{p.nombre}</b>
                      <span className="text-[13px] text-[#5A4F63]">{p.asunto}</span>
                    </span>
                    <BorrarPlantilla id={p.id} nombre={p.nombre} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </MarcoPlataforma>
  );
}
