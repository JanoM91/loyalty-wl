import { coloresDesdeTonos, tonosDominantes, type ColoresMarca } from '@wl/domain';

/**
 * Preparación del logotipo en el celular del dueño, antes de subirlo.
 *
 * Una foto del celular pesa de 2 a 5 MB y llega en cualquier tamaño. Aquí se
 * lee (también HEIC en iPhone), se recortan los bordes transparentes, se
 * reduce a 1,024 px y se vuelve PNG (si tiene transparencia) o JPG. De la
 * misma imagen salen el «Sello» cuadrado y los colores sugeridos. Así el
 * servidor nunca recibe más de ~1 MB y el dueño no tiene que saber de pesos.
 */

export interface LogoPreparado {
  readonly logo: Blob;
  /** El logo dentro de un círculo blanco, 512 × 512: sellos e ícono de la app. */
  readonly sello: Blob;
  /** Colores de tarjeta y página a partir del logo; null si no tiene color. */
  readonly colores: ColoresMarca | null;
}

const LADO_LOGO = 1024;
const LADO_SELLO = 512;
const PESO_MAXIMO = 950_000;

export class ImagenIlegible extends Error {}

async function decodificar(
  archivo: Blob,
): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(archivo);
  } catch {
    // Safari antiguo: por medio de una etiqueta <img>.
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new ImagenIlegible(
        'No pudimos leer esa imagen. Prueba con una captura de pantalla, un PNG o un JPG.',
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function lienzo(ancho: number, alto: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(ancho));
  c.height = Math.max(1, Math.round(alto));
  const ctx = c.getContext('2d');
  if (!ctx) throw new ImagenIlegible('Este navegador no puede preparar imágenes.');
  return [c, ctx];
}

function aBlob(c: HTMLCanvasElement, tipo: 'image/png' | 'image/jpeg', calidad?: number) {
  return new Promise<Blob>((listo, falla) =>
    c.toBlob(
      (b) => (b ? listo(b) : falla(new ImagenIlegible('No pudimos preparar la imagen.'))),
      tipo,
      calidad,
    ),
  );
}

/** Caja de lo que no es transparente; null si toda la imagen es opaca. */
function cajaVisible(datos: ImageData): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h, data } = datos;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let transparente = false;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const a = data[(y * w + x) * 4 + 3]!;
      if (a < 250) transparente = true;
      if (a > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (!transparente || x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Si la imagen es una foto o captura de un logo sobre papel o pared clara
 * (borde parejo, claro y sin color), ese fondo se vuelve transparente. Un logo
 * con fondo de color propio (un cuadro negro, un círculo rojo) no se toca.
 * Devuelve true si quitó el fondo.
 */
function quitarFondoClaro(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const borde: number[] = [];
  const toma = (x: number, y: number) => borde.push((y * w + x) * 4);
  for (let x = 0; x < w; x += 2) {
    toma(x, 0);
    toma(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    toma(0, y);
    toma(w - 1, y);
  }
  const media = [0, 1, 2].map((c) => borde.reduce((s, i) => s + d[i + c]!, 0) / borde.length);
  const desviacion =
    [0, 1, 2]
      .map((c) =>
        Math.sqrt(borde.reduce((s, i) => s + (d[i + c]! - media[c]!) ** 2, 0) / borde.length),
      )
      .reduce((a, b) => a + b, 0) / 3;
  const [r, g, b] = media as [number, number, number];
  const claroNeutro = Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
  if (desviacion > 20 || !claroNeutro) return false;

  const copia = new Uint8ClampedArray(d);
  let quedan = 0;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i]! - r) ** 2 + (d[i + 1]! - g) ** 2 + (d[i + 2]! - b) ** 2);
    const a = dist < 34 ? 0 : dist < 64 ? Math.round(((dist - 34) / 30) * 255) : 255;
    d[i + 3] = Math.min(d[i + 3]!, a);
    if (a > 200) quedan += 1;
  }
  // Si casi no queda nada, el «fondo» era el logo: se deja como estaba.
  if (quedan < (w * h) / 50) {
    d.set(copia);
    return false;
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

/** Reduce y recorta un logotipo; también sirve para el logo de la tarjeta. */
export async function prepararImagen(
  archivo: Blob,
): Promise<{ blob: Blob; lienzo: HTMLCanvasElement; transparente: boolean }> {
  const fuente = await decodificar(archivo);
  const escala = Math.min(1, LADO_LOGO / Math.max(fuente.width, fuente.height));
  const [c0, x0] = lienzo(fuente.width * escala, fuente.height * escala);
  x0.drawImage(fuente, 0, 0, c0.width, c0.height);
  if ('close' in fuente && typeof fuente.close === 'function') fuente.close();
  quitarFondoClaro(x0, c0.width, c0.height);

  const caja = cajaVisible(x0.getImageData(0, 0, c0.width, c0.height));
  let final = c0;
  if (caja) {
    const margen = Math.round(Math.max(caja.w, caja.h) * 0.02);
    const [c1, x1] = lienzo(caja.w + margen * 2, caja.h + margen * 2);
    x1.drawImage(c0, caja.x, caja.y, caja.w, caja.h, margen, margen, caja.w, caja.h);
    final = c1;
  }
  const transparente = caja !== null;
  let blob = transparente ? await aBlob(final, 'image/png') : await aBlob(final, 'image/jpeg', 0.9);
  // Un PNG fotográfico puede pasarse de peso: se reduce hasta que quepa.
  for (let lado = 768; blob.size > PESO_MAXIMO && lado >= 384; lado -= 192) {
    const k = lado / Math.max(final.width, final.height);
    const [c2, x2] = lienzo(final.width * k, final.height * k);
    x2.drawImage(final, 0, 0, c2.width, c2.height);
    final = c2;
    blob = transparente ? await aBlob(c2, 'image/png') : await aBlob(c2, 'image/jpeg', 0.82);
  }
  return { blob, lienzo: final, transparente };
}

/** El logo centrado en un círculo blanco, cuadrado: va en los sellos y en el ícono. */
async function selloDe(logo: HTMLCanvasElement): Promise<Blob> {
  const [c, ctx] = lienzo(LADO_SELLO, LADO_SELLO);
  ctx.beginPath();
  ctx.arc(LADO_SELLO / 2, LADO_SELLO / 2, LADO_SELLO / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const caja = LADO_SELLO * 0.62;
  const k = Math.min(caja / logo.width, caja / logo.height);
  const w = logo.width * k;
  const h = logo.height * k;
  ctx.drawImage(logo, (LADO_SELLO - w) / 2, (LADO_SELLO - h) / 2, w, h);
  return aBlob(c, 'image/png');
}

/** Sello propio que sube el dueño: su imagen cuadrada, sin círculo. */
export async function prepararSelloPropio(archivo: Blob): Promise<Blob> {
  const { lienzo: img } = await prepararImagen(archivo);
  const [c, ctx] = lienzo(LADO_SELLO, LADO_SELLO);
  const k = Math.min(LADO_SELLO / img.width, LADO_SELLO / img.height);
  const w = img.width * k;
  const h = img.height * k;
  ctx.drawImage(img, (LADO_SELLO - w) / 2, (LADO_SELLO - h) / 2, w, h);
  return aBlob(c, 'image/png');
}

/** Logotipo, Sello y colores a partir de la imagen que eligió el dueño. */
export async function prepararLogo(archivo: Blob): Promise<LogoPreparado> {
  const { blob, lienzo: img } = await prepararImagen(archivo);
  // Los colores se leen sobre una versión chica: es más rápido y basta.
  const k = Math.min(1, 160 / Math.max(img.width, img.height));
  const [c, ctx] = lienzo(img.width * k, img.height * k);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const colores = coloresDesdeTonos(
    tonosDominantes(ctx.getImageData(0, 0, c.width, c.height).data),
  );
  return { logo: blob, sello: await selloDe(img), colores };
}
