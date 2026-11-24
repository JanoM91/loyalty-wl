import type { Metadata } from 'next';
import { actoresDeBitacoraPlataforma, listarBitacoraPlataforma } from '@wl/database';

import { negociosDelPanel } from '@/lib/plataforma/panel';
import { textoDeAccion } from '@/lib/plataforma/bitacora';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';

export const metadata: Metadata = { title: 'Bitácora' };
export const dynamic = 'force-dynamic';

const TIPOS = [
  { valor: '', texto: 'Todo' },
  { valor: 'club.', texto: 'Clubes' },
  { valor: 'aviso.', texto: 'Avisos' },
  { valor: 'equipo.', texto: 'Equipo' },
  { valor: 'plataforma.', texto: 'Ajustes' },
  { valor: 'sesion.', texto: 'Accesos' },
] as const;

const fechaHora = (d: Date) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const ETIQUETAS: Readonly<Record<string, string>> = {
  email: 'correo',
  duenio: 'dueño',
  que: 'archivo',
  renglones: 'renglones',
  hasta: 'pagado hasta',
  vence: 'vence',
  revertido: 'fecha regresada',
  encendido: 'encendido',
  activo: 'activo',
  cerradas: 'sesiones cerradas',
  enviados: 'enviados',
  fallidos: 'fallidos',
  audiencia: 'a',
  topeMensual: 'tope al mes',
};
const VALORES: Readonly<Record<string, string>> = {
  LITE: 'Lite',
  ARCADE: 'Juega y gana',
  PRIVADA: 'Privada',
  MES: 'un mes',
  ANIO: 'un año',
  PRUEBA: 'en prueba',
  PAUSADO: 'en pausa',
  ACTIVO: 'activo',
};
const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** Detalle legible de una entrada: lo más útil de su JSON, sin identificadores internos. */
function resumen(detalle: Record<string, unknown> | null): string {
  if (!detalle) return '';
  const partes: string[] = [];
  for (const [clave, valor] of Object.entries(detalle)) {
    if (valor === null || valor === undefined || typeof valor === 'object') continue;
    if (/id$/i.test(clave) || clave === 'pagadoHastaAntes') continue;
    if (clave === 'centavos' && typeof valor === 'number') {
      partes.push(`$${(valor / 100).toLocaleString('es-MX')}`);
      continue;
    }
    let texto: string;
    if (typeof valor === 'boolean') texto = valor ? 'sí' : 'no';
    else if (typeof valor === 'string' && ISO.test(valor))
      texto = new Date(valor).toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        dateStyle: 'medium',
      });
    else texto = VALORES[String(valor)] ?? String(valor);
    // Concepto, periodo, plan y estado se leen solos: «Lite · un año».
    if (['concepto', 'periodo', 'plan', 'estado', 'nombre', 'asunto'].includes(clave))
      partes.push(texto);
    else partes.push(`${ETIQUETAS[clave] ?? clave}: ${texto}`);
  }
  return partes.join(' · ');
}

const SELECT =
  'min-h-[48px] rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white px-3 text-[15px] text-ink';

/** Lo que hizo cada persona del equipo de plataforma, lo más reciente primero. */
export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string; actor?: string; tipo?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const filtro = await searchParams;
  const tipo = TIPOS.find((t) => t.valor === filtro.tipo)?.valor ?? '';
  const [entradas, actores, negocios] = await Promise.all([
    listarBitacoraPlataforma({
      clubId: filtro.club || undefined,
      actor: filtro.actor || undefined,
      accion: tipo || undefined,
      limite: 200,
    }),
    actoresDeBitacoraPlataforma(),
    negociosDelPanel(),
  ]);
  const nombreDe = new Map(negocios.map((f) => [f.negocio.id, f.negocio.nombre]));

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="bitacora"
      titulo="Bitácora"
      descripcion="Lo que hizo cada persona del equipo: altas, pagos, borrados, avisos y accesos. Las últimas 200 entradas."
    >
      <form action="/plataforma/bitacora" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[13px] text-[#5A4F63]">
          Quién
          <select name="actor" defaultValue={filtro.actor ?? ''} className={SELECT}>
            <option value="">Todo el equipo</option>
            {actores.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] text-[#5A4F63]">
          Qué
          <select name="tipo" defaultValue={tipo} className={SELECT}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] text-[#5A4F63]">
          Club
          <select name="club" defaultValue={filtro.club ?? ''} className={SELECT}>
            <option value="">Todos</option>
            {[...negocios]
              .sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre, 'es'))
              .map((f) => (
                <option key={f.negocio.id} value={f.negocio.id}>
                  {f.negocio.nombre}
                </option>
              ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-[48px] rounded-[14px] border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-cream"
        >
          Filtrar
        </button>
      </form>

      <div className="rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-3 sm:p-5">
        {entradas.length === 0 ? (
          <p className="px-2 py-6 text-[15px] text-[#5A4F63]">
            Nada todavía con ese filtro. La bitácora empieza con esta versión del panel.
          </p>
        ) : (
          <ol className="grid">
            {entradas.map((e) => {
              const club = e.clubId ? (nombreDe.get(e.clubId) ?? null) : null;
              const detalle = resumen(e.detalle);
              return (
                <li
                  key={e.id}
                  className="grid gap-1 border-t border-[#EFE3D3] px-2 py-3 first:border-t-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[15px] font-semibold text-ink">
                      {textoDeAccion(e.accion)}
                      {e.clubSlug &&
                        (club ? (
                          <>
                            {' · '}
                            <a
                              href={`/plataforma/${e.clubSlug}`}
                              className="underline decoration-[#E8D8C6] underline-offset-4"
                            >
                              {club}
                            </a>
                          </>
                        ) : (
                          ` · /${e.clubSlug} (ya no existe)`
                        ))}
                    </span>
                    <time className="text-[13px] text-[#5A4F63] tabular-nums">
                      {fechaHora(e.fecha)}
                    </time>
                  </div>
                  <p className="text-[13px] break-all text-[#5A4F63]">
                    {e.actor}
                    {e.ip ? ` · IP ${e.ip}` : ''}
                    {detalle ? ` · ${detalle}` : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </MarcoPlataforma>
  );
}
