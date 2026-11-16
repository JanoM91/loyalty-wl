/**
 * Reduce la foto en el navegador antes de subirla: menos de 1600 px por lado,
 * JPEG al 80 %. Redibujarla en un lienzo también borra los metadatos (ubicación,
 * modelo del teléfono), que no tienen por qué viajar.
 */
export async function reducirFoto(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('sin imagen'))), 'image/jpeg', 0.8),
  );
}
