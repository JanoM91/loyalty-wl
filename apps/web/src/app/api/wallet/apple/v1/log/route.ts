/**
 * Errores que Wallet nos reporta (pase mal formado, respuesta inesperada).
 *
 * Quedan en los registros del servidor. Es el primer lugar donde mirar si un
 * pase no se actualiza.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const cuerpo = (await req.json()) as { logs?: unknown };
    const lineas = Array.isArray(cuerpo.logs) ? cuerpo.logs.slice(0, 20) : [];
    for (const linea of lineas)
      console.warn('[wallet] Apple reporta:', String(linea).slice(0, 500));
  } catch {
    /* cuerpo ilegible: no hay nada que registrar */
  }
  return new Response(null, { status: 200 });
}
