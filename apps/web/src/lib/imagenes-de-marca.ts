import { put } from '@vercel/blob';

/**
 * Imágenes de marca de un negocio en el almacén (Vercel Blob): logotipo,
 * logotipo para la tarjeta y Sello. Llegan ya preparadas desde el navegador
 * (ver `logo-en-navegador.ts`); aquí solo se revisa que sean lo que dicen y
 * se guardan en la carpeta del negocio, que es la única que `guardarLogo`
 * acepta.
 */

const FORMATOS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
/** Ya reducidas en el navegador, pesan menos de 1 MB; el margen es por si acaso. */
export const PESO_MAXIMO_MARCA = 1_500_000;

/** Nombre del archivo en el almacén. `sello-auto` = el Sello hecho del logotipo. */
export type ArchivoDeMarca = 'logoUrl' | 'logoClaroUrl' | 'iconoUrl' | 'sello-auto';

export class ImagenRechazada extends Error {}

export function almacenListo(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Sube una imagen de marca y devuelve su dirección pública. */
export async function subirImagenDeMarca(
  negocioId: string,
  archivo: File,
  nombre: ArchivoDeMarca,
): Promise<string> {
  const extension = FORMATOS[archivo.type];
  if (!extension) throw new ImagenRechazada('La imagen debe ser PNG, JPG o WebP.');
  if (archivo.size === 0) throw new ImagenRechazada('La imagen está vacía.');
  if (archivo.size > PESO_MAXIMO_MARCA)
    throw new ImagenRechazada('La imagen pesa demasiado. Prueba con otra.');
  const subida = await put(`negocios/${negocioId}/marca/${nombre}.${extension}`, archivo, {
    access: 'public',
    addRandomSuffix: true,
    contentType: archivo.type,
  });
  return subida.url;
}

/**
 * El Sello se puede rehacer con un logotipo nuevo: no hay Sello o lo hizo el
 * sistema a partir del logotipo. Uno que subió el dueño no se toca.
 */
export function selloSeRehace(url: string | null): boolean {
  return url === null || url.includes('/marca/sello-auto');
}
