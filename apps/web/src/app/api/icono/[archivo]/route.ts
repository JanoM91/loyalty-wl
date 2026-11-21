import { huellaDeMarca } from '@/lib/iconos-app';
import { negocioDeLaPeticion } from '@/lib/negocio';
import { iconoDeApp } from '@/lib/wallet/imagenes';
import { marcaDeImagen } from '@/lib/wallet/negocio';

/**
 * Íconos de pantalla de inicio de un negocio: `icono-180.png` (iPhone),
 * `icono-192.png` e `icono-512.png` (Android). Los usan la tarjeta del
 * cliente y el panel del dueño, siempre con la marca del negocio.
 *
 * Públicos: no llevan datos de ninguna persona. La dirección trae
 * `?v=<huella de la marca>`; si la marca cambia, cambia la dirección.
 */

export const dynamic = 'force-dynamic';

const LADOS = new Set([180, 192, 512]);

type Params = { params: Promise<{ archivo: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { archivo } = await params;
  const m = /^icono-(\d{3})\.png$/.exec(archivo);
  const lado = m ? Number(m[1]) : 0;
  if (!LADOS.has(lado)) return new Response(null, { status: 404 });
  const negocio = await negocioDeLaPeticion();
  if (!negocio) return new Response(null, { status: 404 });

  const marca = marcaDeImagen(negocio);
  const imagen = await iconoDeApp(marca, lado);
  const vigente = new URL(req.url).searchParams.get('v') === huellaDeMarca(negocio);
  return new Response(new Uint8Array(imagen), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': vigente ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  });
}
