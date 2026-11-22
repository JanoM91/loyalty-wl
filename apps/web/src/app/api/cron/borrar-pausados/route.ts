import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { borrarClubesVencidos } from '@wl/database';

export const dynamic = 'force-dynamic';

/**
 * Tarea diaria: borra los clubes que cumplieron 30 días en pausa (prueba o
 * pago vencido), solo si el borrado automático está encendido en
 * `/plataforma`. Apagado, no hace nada: el borrado es manual desde la ficha
 * de cada club.
 *
 * Si algún día se configura el almacén de archivos, las imágenes del club
 * (logotipos, fotos de ticket) quedan en Blob y las limpia aparte la tarea de
 * fotos o una limpieza manual.
 */
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
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const r = await borrarClubesVencidos();
  if (r.borrados.length > 0) {
    console.warn(`[borrado] clubes borrados tras 30 días en pausa: ${r.borrados.join(', ')}`);
  }
  return NextResponse.json({ ok: true, ...r });
}
