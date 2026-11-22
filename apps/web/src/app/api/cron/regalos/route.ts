import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  candidatosCumple,
  candidatosRegreso,
  conNegocio,
  darRegalo,
  enlacePersonalDeTarjeta,
  estadoComercialDe,
  listarNegocios,
  marcarRegalosAvisados,
  quitarRegalos,
  usoMensajesDelMes,
  type CandidatoRegalo,
  type Negocio,
  type RegaloDado,
} from '@wl/database';
import { TOPE_DIARIO_AUTOMATICOS, type TipoRegalo } from '@wl/domain';

import { CORREO_CONFIGURADO, enviarLote, type CorreoDeLote } from '@/lib/correo';
import { urlBaja } from '@/lib/mensajes';
import { correoRegalo, origenDelClub } from '@/lib/regalos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Cuántas tarjetas de cumpleaños se revisan por club en un día. */
const CUMPLES_POR_DIA = 500;

interface Resultado {
  readonly cumple: number;
  readonly regreso: number;
  readonly correos: number;
}

/**
 * Correos que el club puede mandar hoy: necesita «Mensajes a clientes»
 * encendido, el correo configurado y los enlaces de baja; y cabe en lo que le
 * queda del tope del mes, hasta 100 al día.
 */
async function cupoDeCorreos(club: Negocio, origen: string, ahora: Date): Promise<number> {
  const m = club.ajustes.mensajes;
  if (!m?.activo || !CORREO_CONFIGURADO || !urlBaja(origen, club.id, club.id)) return 0;
  const uso = await usoMensajesDelMes(ahora);
  return Math.min(TOPE_DIARIO_AUTOMATICOS, Math.max(0, m.topeMensual - uso));
}

/** Da los regalos del día en el club en curso y manda sus correos. */
async function regalarEnElClub(club: Negocio, ahora: Date): Promise<Resultado> {
  const { regreso, cumple } = club.ajustes.regalos;
  const origen = origenDelClub(club.slug);
  const cupo = await cupoDeCorreos(club, origen, ahora);
  const datosClub = { nombre: club.nombre, domicilio: club.marca.legal.domicilio };
  const porAvisar: { id: string; tipo: TipoRegalo; correo: CorreoDeLote }[] = [];

  const armar = async (
    tipo: TipoRegalo,
    c: CandidatoRegalo,
    regalo: string,
    dado: RegaloDado,
  ): Promise<CorreoDeLote> => {
    const token = await enlacePersonalDeTarjeta(c.cardId);
    return correoRegalo({
      tipo,
      para: c.correo!,
      nombre: c.nombre,
      club: datosClub,
      regalo,
      ultimoDia: dado.ultimoDia,
      tarjeta: token ? `${origen}/lealtad/mi/${token}` : `${origen}/lealtad`,
      baja: urlBaja(origen, club.id, c.cardId),
    });
  };

  let cumpleDados = 0;
  if (cumple.activo) {
    for (const c of await candidatosCumple(CUMPLES_POR_DIA, ahora)) {
      const dado = await darRegalo(
        { cardId: c.cardId, tipo: 'CUMPLE', titulo: cumple.regalo, vigencia: cumple.vigencia },
        ahora,
      );
      if (!dado) continue;
      cumpleDados += 1;
      // El regalo de cumpleaños aparece en la tarjeta aunque no se le pueda escribir.
      if (c.avisable && c.correo && porAvisar.length < cupo) {
        porAvisar.push({
          id: dado.id,
          tipo: 'CUMPLE',
          correo: await armar('CUMPLE', c, cumple.regalo, dado),
        });
      }
    }
  }

  let regresoDados = 0;
  if (regreso.activo) {
    // Sin correo no hay «Te extrañamos»: solo se buscan los que caben.
    const lugar = cupo - porAvisar.length;
    for (const c of await candidatosRegreso(regreso.dias, lugar, ahora)) {
      const dado = await darRegalo(
        { cardId: c.cardId, tipo: 'REGRESO', titulo: regreso.regalo, vigencia: regreso.vigencia },
        ahora,
      );
      if (!dado) continue;
      regresoDados += 1;
      porAvisar.push({
        id: dado.id,
        tipo: 'REGRESO',
        correo: await armar('REGRESO', c, regreso.regalo, dado),
      });
    }
  }

  let correos = 0;
  if (porAvisar.length > 0) {
    const envio = await enviarLote(porAvisar.map((p) => p.correo));
    if (envio.enviados > 0) {
      await marcarRegalosAvisados(
        porAvisar.map((p) => p.id),
        new Date(),
      );
      correos = envio.enviados;
    } else {
      console.error(`[regalos] no salieron los correos de ${club.slug}: ${envio.error}`);
      // Sin aviso, «Te extrañamos» se vuelve a intentar mañana.
      const sinAviso = porAvisar.filter((p) => p.tipo === 'REGRESO').map((p) => p.id);
      await quitarRegalos(sinAviso);
      regresoDados -= sinAviso.length;
    }
  }
  return { cumple: cumpleDados, regreso: regresoDados, correos };
}

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

/**
 * Tarea diaria (10:10 de la mañana en México): regalos de cumpleaños y «Te
 * extrañamos» de los clubes que los encendieron. No corre en clubes
 * suspendidos ni en pausa.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const ahora = new Date();
  const clubes = (await listarNegocios()).map((f) => f.negocio).filter((n) => n.activo);
  const resultado: Record<string, Resultado> = {};
  const errores: string[] = [];
  for (const club of clubes) {
    const { regreso, cumple } = club.ajustes.regalos;
    if (!regreso.activo && !cumple.activo) continue;
    if (estadoComercialDe(club, ahora) === 'PAUSADO') continue;
    try {
      resultado[club.slug] = await conNegocio(club, () => regalarEnElClub(club, ahora));
    } catch (e) {
      console.error(`[regalos] falló el club ${club.slug}`, e);
      errores.push(club.slug);
    }
  }
  return NextResponse.json({ ok: errores.length === 0, clubes: resultado, errores });
}
