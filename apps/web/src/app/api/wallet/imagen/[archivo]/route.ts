import { programaVigente } from '@wl/database';

import { negocioDeLaPeticion } from '@/lib/negocio';
import { icono, LOGO_GOOGLE, tira, TIRA_GOOGLE } from '@/lib/wallet/imagenes';
import { marcaDeImagen, programaDeImagen } from '@/lib/wallet/negocio';

/**
 * Imágenes públicas de los pases de un negocio, para Google Wallet.
 *
 * Google no recibe archivos: descarga las imágenes de una dirección y las
 * guarda en caché. Aquí se sirven el logotipo (`logo.png`) y la tira de
 * estampas (`tira-<n>.png`) con la marca del negocio de la dirección. No
 * llevan datos de ninguna persona: solo la marca y un número de estampas.
 *
 * La dirección trae `?v=<huella del diseño>`: si la marca cambia, cambia la
 * dirección, así que cada respuesta se puede guardar sin caducidad.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ archivo: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { archivo } = await params;
  const negocio = await negocioDeLaPeticion();
  if (!negocio) return new Response(null, { status: 404 });

  const marca = marcaDeImagen(negocio);
  let imagen: Buffer;
  if (archivo === 'logo.png') {
    imagen = await icono(marca, LOGO_GOOGLE);
  } else {
    const m = /^tira-(\d{1,3})\.png$/.exec(archivo);
    if (!m) return new Response(null, { status: 404 });
    const programa = programaDeImagen(await programaVigente());
    imagen = await tira(marca, programa, Number(m[1]), TIRA_GOOGLE.ancho, TIRA_GOOGLE.alto);
  }

  return new Response(new Uint8Array(imagen), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
