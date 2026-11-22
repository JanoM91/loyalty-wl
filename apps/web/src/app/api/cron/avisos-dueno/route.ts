import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  cifrasDelClub,
  clubesParaAvisos,
  conNegocio,
  dueniosDelClub,
  estadoComercialDe,
  marcarAvisos,
  type Negocio,
} from '@wl/database';
import {
  arcadeVigente,
  avisoDeCiclo,
  diasEnPausa,
  fechaDeBorrado,
  fechaLocal,
  inicioDelDia,
  lunesDe,
  sumarDias,
  type AvisoPendiente,
} from '@wl/domain';

import { correoDeCiclo, correoResumenSemanal } from '@/lib/avisos-dueno';
import { CORREO_CONFIGURADO, enviarCorreo, type Correo } from '@/lib/correo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Desde cuándo contar los números «desde que se creó el club». */
const SIEMPRE = new Date('2020-01-01T00:00:00.000Z');

const CAMPO: Record<AvisoPendiente['tipo'], 'porVencer' | 'pausa' | 'borrado'> = {
  'por-vencer': 'porVencer',
  pausa: 'pausa',
  borrado: 'borrado',
};

/** Manda un correo a cada dueño; cuenta como enviado si salió a al menos uno. */
async function mandar(
  duenios: readonly { email: string; nombre: string }[],
  armar: (d: { email: string; nombre: string }) => Correo,
): Promise<boolean> {
  let alguno = false;
  for (const d of duenios) {
    const r = await enviarCorreo(armar(d));
    if (r.ok) alguno = true;
    else console.error(`[avisos] no salió el correo a un dueño: ${r.error}`);
  }
  return alguno;
}

async function avisarCiclo(
  club: Negocio,
  duenios: readonly { email: string; nombre: string }[],
  borradoAutomatico: boolean,
  ahora: Date,
): Promise<string | null> {
  const { pruebaVence, pagadoHasta, avisos } = club.ajustes;
  const aviso = avisoDeCiclo({ pruebaVence, pagadoHasta, avisos, borradoAutomatico }, ahora);
  if (!aviso) return null;
  const cifras = await conNegocio(club, () => cifrasDelClub(SIEMPRE, ahora));
  const ok = await mandar(duenios, (d) =>
    correoDeCiclo({
      para: d.email,
      nombre: d.nombre,
      club,
      aviso,
      cifras,
      borrarDesde: borradoAutomatico ? fechaDeBorrado(pruebaVence, pagadoHasta, ahora) : null,
      diasEnPausa: diasEnPausa(pruebaVence, pagadoHasta, ahora),
    }),
  );
  if (!ok) return null;
  await marcarAvisos(club.id, { [CAMPO[aviso.tipo]]: aviso.referencia });
  return aviso.tipo;
}

async function resumirSemana(
  club: Negocio,
  duenios: readonly { email: string; nombre: string }[],
  ahora: Date,
): Promise<boolean> {
  const zona = club.zonaHoraria;
  const hoy = fechaLocal(ahora, zona);
  const { avisos } = club.ajustes;
  if (lunesDe(hoy) !== hoy || !avisos.resumenSemanal || avisos.semana === hoy) return false;
  if (estadoComercialDe(club, ahora) === 'PAUSADO') return false;
  const lunesPasado = sumarDias(hoy, -7);
  const desde = inicioDelDia(lunesPasado, zona);
  const hasta = inicioDelDia(hoy, zona);
  const cifras = await conNegocio(club, () => cifrasDelClub(desde, hasta));
  const domingo = inicioDelDia(sumarDias(hoy, -1), zona);
  const ok = await mandar(duenios, (d) =>
    correoResumenSemanal({
      para: d.email,
      nombre: d.nombre,
      club,
      cifras,
      desde,
      hasta: domingo,
      conJuegos: arcadeVigente(club.ajustes.arcade, ahora),
    }),
  );
  if (ok) await marcarAvisos(club.id, { semana: hoy });
  return ok;
}

/**
 * Tarea diaria (8:20 de la mañana en México): avisos de fin de prueba o de
 * pago, pausa y borrado; y los lunes, el resumen de la semana. Cada aviso se
 * anota en el club para no repetirlo. Sin correo configurado no hace nada.
 */
/** `Authorization: Bearer <CRON_SECRET>`, comparado en tiempo constante. */
function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const esperado = createHash('sha256').update(`Bearer ${secreto}`).digest();
  const recibido = createHash('sha256')
    .update(req.headers.get('authorization') ?? '')
    .digest();
  return timingSafeEqual(esperado, recibido);
}

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!CORREO_CONFIGURADO) return NextResponse.json({ ok: true, correo: false });

  const ahora = new Date();
  const { clubes, borradoAutomatico } = await clubesParaAvisos();
  const ciclo: string[] = [];
  const resumen: string[] = [];
  const errores: string[] = [];
  for (const club of clubes) {
    try {
      const duenios = await dueniosDelClub(club.id);
      if (duenios.length === 0) continue;
      const tipo = await avisarCiclo(club, duenios, borradoAutomatico, ahora);
      if (tipo) ciclo.push(`${club.slug}:${tipo}`);
      // Un correo por club en el día: si ya salió un aviso, el resumen espera.
      else if (await resumirSemana(club, duenios, ahora)) resumen.push(club.slug);
    } catch (e) {
      console.error(`[avisos] falló el club ${club.slug}`, e);
      errores.push(club.slug);
    }
  }
  return NextResponse.json({ ok: errores.length === 0, ciclo, resumen, errores });
}
