import type { Metadata } from 'next';
import { usoDeClubes } from '@wl/database';
import { TEXTO_MOTIVO, motivoDeLlamada, ultimaActividad, type MotivoDeLlamada } from '@wl/domain';

import { estadoDelClub, negociosDelPanel } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { Panel, hace } from '../piezas';

export const metadata: Metadata = { title: 'Actividad' };
export const dynamic = 'force-dynamic';

const num = (n: number) => n.toLocaleString('es-MX');

/** Primer mensaje de WhatsApp según por qué se llama; se ajusta en WhatsApp antes de mandarlo. */
const MENSAJE: Record<MotivoDeLlamada, (club: string, yo: string) => string> = {
  'sin-entrar': (club, yo) =>
    `Hola, soy ${yo} de club-lealtad. Vi que todavía no entras al panel de ${club}. ¿Te ayudo a dejarlo listo en 5 minutos?`,
  'sin-tarjetas': (club, yo) =>
    `Hola, soy ${yo} de club-lealtad. ${club} todavía no tiene clientes con tarjeta. ¿Te paso el cartel QR para tu mostrador y te explico cómo invitarlos?`,
  'sin-visitas': (club, yo) =>
    `Hola, soy ${yo} de club-lealtad. En ${club} la caja no ha sumado sellos en las últimas dos semanas. ¿Todo bien? ¿Te ayudo con algo?`,
  bajando: (club, yo) =>
    `Hola, soy ${yo} de club-lealtad. Esta semana bajaron las visitas con tarjeta en ${club}. ¿Quieres que veamos juntos una promoción para que regresen?`,
};

const ORDEN: Record<MotivoDeLlamada, number> = {
  'sin-entrar': 0,
  'sin-tarjetas': 1,
  'sin-visitas': 2,
  bajando: 3,
};

/** Uso de cada club: visitas, tarjetas y último acceso; arriba, a quién llamar y por qué. */
export default async function ActividadPage() {
  const sesion = await exigirPlataforma();
  const negocios = await negociosDelPanel();
  const uso = await usoDeClubes();
  const ahora = new Date();
  const yo = sesion.nombre.trim().split(/\s+/)[0] || 'el equipo';

  const filas = negocios
    .filter((f) => estadoDelClub(f, ahora) !== 'suspendido')
    .map((f) => {
      const u = uso.get(f.negocio.id);
      return {
        fila: f,
        uso: u,
        motivo: u ? motivoDeLlamada(u, ahora) : null,
        ultima: u ? ultimaActividad(u) : null,
        estado: estadoDelClub(f, ahora),
      };
    });
  // Un club en pausa necesita un pago, no una llamada de uso: va en Ingresos e Inicio.
  const llamar = filas
    .filter((x) => x.motivo && x.estado !== 'pausa')
    .sort((a, b) => ORDEN[a.motivo!] - ORDEN[b.motivo!]);
  const porUso = [...filas].sort((a, b) => (b.uso?.visitas30 ?? 0) - (a.uso?.visitas30 ?? 0));
  const totales = filas.reduce(
    (t, x) => ({
      visitas7: t.visitas7 + (x.uso?.visitas7 ?? 0),
      visitas30: t.visitas30 + (x.uso?.visitas30 ?? 0),
      tarjetas30: t.tarjetas30 + (x.uso?.tarjetas30 ?? 0),
      conUso: t.conUso + ((x.uso?.visitas7 ?? 0) > 0 ? 1 : 0),
    }),
    { visitas7: 0, visitas30: 0, tarjetas30: 0, conUso: 0 },
  );

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="actividad"
      titulo="Actividad"
      descripcion="Visitas con tarjeta, clientes nuevos y último acceso del dueño en cada club. Sin clubes suspendidos."
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ['Visitas · 7 días', totales.visitas7, 'En todos los clubes'],
          ['Visitas · 30 días', totales.visitas30, 'Acreditadas en caja'],
          ['Tarjetas nuevas · 30 días', totales.tarjetas30, 'Clientes que se unieron'],
          ['Clubes con uso', totales.conUso, `De ${filas.length}, con visitas esta semana`],
        ].map(([etiqueta, valor, contexto]) => (
          <div
            key={String(etiqueta)}
            className="rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-5"
          >
            <p className="text-[14px] font-semibold text-[#5A4F63]">{etiqueta}</p>
            <p className="mt-1 font-display text-[34px] leading-none font-semibold text-ink tabular-nums">
              {num(Number(valor))}
            </p>
            <p className="mt-2 text-[13px] text-[#5A4F63]">{contexto}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Panel
          icono="chat"
          titulo="A quién llamar"
          aviso={llamar.length > 0}
          contador={llamar.length > 0 ? String(llamar.length) : undefined}
        >
          {llamar.length === 0 ? (
            <p className="text-[15px] text-[#5A4F63]">
              Todos los clubes vivos tienen uso. Nadie que llamar hoy.
            </p>
          ) : (
            <ul className="grid text-[15px]">
              {llamar.map(({ fila, motivo, ultima }) => {
                const { negocio } = fila;
                const whatsapp = negocio.ajustes.alta?.whatsapp;
                return (
                  <li
                    key={negocio.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#EBD9A8] py-3 first:border-t-0"
                  >
                    <span className="grid gap-0.5">
                      <a
                        href={`/plataforma/${negocio.slug}#actividad`}
                        className="font-semibold text-ink underline decoration-[#E0B45C] underline-offset-4"
                      >
                        {negocio.nombre}
                      </a>
                      <span className="text-[13px] text-[#5B3B00]">
                        {TEXTO_MOTIVO[motivo!]} · última actividad:{' '}
                        {hace(ultima, ahora).toLowerCase()}
                      </span>
                    </span>
                    {whatsapp ? (
                      <a
                        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(MENSAJE[motivo!](negocio.nombre, yo))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[40px] items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-cream"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-[13px] text-[#5B3B00]">Sin WhatsApp del alta</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <caption className="sr-only">Uso de cada club</caption>
          <thead className="text-[13px] text-[#5A4F63]">
            <tr className="border-b border-[#EFE3D3]">
              <th scope="col" className="px-4 py-3 font-semibold">
                Club
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Visitas 7 d
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                7 d antes
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Visitas 30 d
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Tarjetas
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Última visita
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Dueño entró
              </th>
            </tr>
          </thead>
          <tbody>
            {porUso.map(({ fila, uso: u, motivo }) => (
              <tr key={fila.negocio.id} className="border-t border-[#EFE3D3] first:border-t-0">
                <th scope="row" className="px-4 py-3 font-semibold">
                  <a
                    href={`/plataforma/${fila.negocio.slug}#actividad`}
                    className="text-ink underline decoration-[#E8D8C6] underline-offset-4"
                  >
                    {fila.negocio.nombre}
                  </a>
                  {motivo && <span className="sr-only"> (para llamar)</span>}
                  {motivo && (
                    <span
                      aria-hidden="true"
                      className="ml-2 inline-block size-2 rounded-full bg-[#FF5B3A] align-middle"
                    />
                  )}
                </th>
                <td className="px-3 py-3 text-right tabular-nums">{num(u?.visitas7 ?? 0)}</td>
                <td className="px-3 py-3 text-right text-[#5A4F63] tabular-nums">
                  {num(u?.visitas7Previas ?? 0)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{num(u?.visitas30 ?? 0)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{num(u?.tarjetas ?? 0)}</td>
                <td className="px-3 py-3">{hace(u?.ultimaVisita ?? null, ahora)}</td>
                <td className="px-3 py-3">{hace(u?.ultimoAcceso ?? null, ahora)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MarcoPlataforma>
  );
}
