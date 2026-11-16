import { NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';
import {
  conNegocio,
  fotosEnUso,
  fotosVencidas,
  negociosActivos,
  olvidarFotos,
  type Negocio,
} from '@wl/database';

export const dynamic = 'force-dynamic';

/**
 * Limpieza diaria de fotos de tickets, negocio por negocio.
 *
 * Cada negocio decide cuántos días conserva sus fotos (`diasConservacionFotos`).
 * Dos pasadas por negocio:
 * 1. Vencidas según la fecha de compra: se borran y se olvida su dirección.
 * 2. Huérfanas: fotos subidas que ninguna visita usa (la caja tomó la foto y
 *    no terminó el registro), pasado el mismo plazo desde que se subieron.
 *
 * Las fotos de cada negocio viven bajo `negocios/<id>/lealtad/tickets/`: esta
 * tarea nunca lista ni borra fuera de la carpeta del negocio que está limpiando.
 */
async function limpiar(negocio: Negocio): Promise<{ borradas: number; huerfanas: number }> {
  return conNegocio(negocio, async () => {
    const vencidas = await fotosVencidas();
    if (vencidas.length > 0) await del(vencidas.map((f) => f.url));

    const limite = Date.now() - negocio.ajustes.diasConservacionFotos * 86_400_000;
    const viejas: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = await list({
        prefix: `negocios/${negocio.id}/lealtad/tickets/`,
        cursor,
        limit: 1000,
      });
      for (const b of pagina.blobs) {
        if (new Date(b.uploadedAt).getTime() < limite) viejas.push(b.url);
      }
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);

    const yaBorradas = new Set(vencidas.map((f) => f.url));
    const candidatas = viejas.filter((u) => !yaBorradas.has(u));
    const enUso = await fotosEnUso(candidatas);
    const huerfanas = candidatas.filter((u) => !enUso.has(u));
    if (huerfanas.length > 0) await del(huerfanas);

    const borradas = await olvidarFotos(
      vencidas.map((f) => f.id),
      huerfanas.length,
    );
    return { borradas, huerfanas: huerfanas.length };
  });
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: true, omitido: 'sin almacén de fotos' });
  }

  const resultados: { negocio: string; borradas?: number; huerfanas?: number; error?: true }[] = [];
  for (const negocio of await negociosActivos()) {
    try {
      resultados.push({ negocio: negocio.slug, ...(await limpiar(negocio)) });
    } catch (e) {
      // Un negocio que falla no detiene la limpieza de los demás.
      console.error(`Limpieza de fotos: falló ${negocio.slug}`, e);
      resultados.push({ negocio: negocio.slug, error: true });
    }
  }
  return NextResponse.json({ ok: true, negocios: resultados });
}
