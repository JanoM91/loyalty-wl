import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { anotarPlataforma, leerAvisoPlataforma, tomarAvisosQueTocan } from '@wl/database';

import { despacharAviso } from '@/lib/avisos-plataforma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
 * Cada 15 minutos: manda los avisos a dueños programados que ya tocan. Cada
 * aviso lo toma una sola corrida (pasa a ENVIANDO en la misma sentencia) y
 * calcula su audiencia en ese momento.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const ids = await tomarAvisosQueTocan();
  const resultado: Record<string, unknown> = {};
  for (const id of ids) {
    try {
      const r = await despacharAviso(id);
      resultado[id] = r;
      const aviso = await leerAvisoPlataforma(id);
      await anotarPlataforma({
        actor: aviso?.enviadoPor ?? 'tarea programada',
        accion: 'aviso.programado_salio',
        detalle: {
          asunto: aviso?.asunto ?? '',
          ...(r.ok ? { enviados: r.enviados, fallidos: r.fallidos } : { error: r.error }),
        },
      });
    } catch (e) {
      console.error('[avisos-plataforma] no salió', id, e);
      resultado[id] = { ok: false };
    }
  }
  return NextResponse.json({ ok: true, avisos: ids.length, resultado });
}
