import { createHash } from 'node:crypto';
import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';

/**
 * Imágenes de los pases, dibujadas al vuelo con la marca de cada negocio.
 *
 * Cada negocio tiene sus colores, su logotipo y su número de estampas, así que
 * no hay imágenes fijas: se dibujan con `next/og` (el mismo motor de las
 * imágenes para compartir) y se guardan en memoria. Una tira depende de la
 * marca, del programa y de cuántas estampas lleva la tarjeta; el ícono y el
 * logotipo, solo de la marca.
 *
 * Apple recibe los PNG dentro del pase. Google los pide por dirección
 * (`/api/wallet/imagen/…`) y los guarda en caché: por eso la dirección lleva
 * una huella de la marca y cambia cuando cambia el diseño.
 */

export interface MarcaImagen {
  readonly nombre: string;
  readonly fondo: string;
  readonly sobreFondo: string;
  readonly acento: string;
  /** Logotipo para fondos oscuros, si el negocio subió uno. */
  readonly logoUrl: string | null;
  /** Isotipo cuadrado, si el negocio subió uno. */
  readonly iconoUrl: string | null;
}

export interface ProgramaImagen {
  readonly posiciones: number;
  /** Posiciones (desde 1) en las que se gana un premio. */
  readonly hitos: readonly number[];
}

/** Huella corta de lo que define el diseño. Va en las direcciones de Google. */
export function huellaDeDiseno(marca: MarcaImagen, programa: ProgramaImagen): string {
  return createHash('sha256')
    .update(
      JSON.stringify([VERSION_DIBUJO, marca, programa.posiciones, [...programa.hitos].sort()]),
    )
    .digest('hex')
    .slice(0, 12);
}

/** Súbela si cambia el dibujo: obliga a Google a descargar las imágenes nuevas. */
const VERSION_DIBUJO = 1;

const memoria = new Map<string, Promise<Buffer>>();
const MAX_EN_MEMORIA = 400;

function recordar(clave: string, dibujar: () => Promise<Buffer>): Promise<Buffer> {
  let p = memoria.get(clave);
  if (!p) {
    if (memoria.size >= MAX_EN_MEMORIA) memoria.clear();
    p = dibujar();
    memoria.set(clave, p);
    // Un dibujo fallido no debe quedarse guardado.
    p.catch(() => memoria.delete(clave));
  }
  return p;
}

async function png(elemento: ReactElement, ancho: number, alto: number): Promise<Buffer> {
  const r = new ImageResponse(elemento, { width: ancho, height: alto });
  return Buffer.from(await r.arrayBuffer());
}

/** Cuántas columnas y filas ocupa la tira: una fila hasta 6, dos después. */
export function rejillaDeTira(posiciones: number): { columnas: number; filas: number } {
  const n = Math.max(1, Math.trunc(posiciones));
  if (n <= 6) return { columnas: n, filas: 1 };
  return { columnas: Math.ceil(n / 2), filas: 2 };
}

function Estampa(p: {
  readonly lado: number;
  readonly llena: boolean;
  readonly premio: boolean;
  readonly marca: MarcaImagen;
}): ReactElement {
  const { lado, llena, premio, marca } = p;
  const trazo = Math.max(2, Math.round(lado * 0.06));
  const dentro = Math.round(lado * 0.5);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: lado,
        height: lado,
        borderRadius: lado,
        backgroundColor: llena ? marca.acento : 'transparent',
        border: llena ? 'none' : `${trazo}px solid ${premio ? marca.acento : marca.sobreFondo}`,
        opacity: llena || premio ? 1 : 0.38,
      }}
    >
      {premio ? (
        <svg width={dentro} height={dentro} viewBox="0 0 24 24">
          <path
            d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
            fill={llena ? marca.fondo : marca.acento}
          />
        </svg>
      ) : llena ? (
        <svg width={dentro} height={dentro} viewBox="0 0 24 24">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke={marca.fondo}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}

function Tira(p: {
  readonly ancho: number;
  readonly alto: number;
  readonly estampas: number;
  readonly marca: MarcaImagen;
  readonly programa: ProgramaImagen;
}): ReactElement {
  const { ancho, alto, estampas, marca, programa } = p;
  const { columnas, filas } = rejillaDeTira(programa.posiciones);
  // iOS recorta los bordes de la tira: todo va en la zona central.
  const util = { ancho: ancho * 0.84, alto: alto * 0.8 };
  const lado = Math.floor(Math.min(util.ancho / (columnas * 1.28), util.alto / (filas * 1.22)));
  const hueco = Math.round(lado * 0.28);
  const posiciones = Array.from({ length: programa.posiciones }, (_, i) => i + 1);
  const renglones = Array.from({ length: filas }, (_, f) =>
    posiciones.slice(f * columnas, (f + 1) * columnas),
  );
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: ancho,
        height: alto,
        backgroundColor: marca.fondo,
        gap: Math.round(lado * 0.22),
      }}
    >
      {renglones.map((renglon, f) => (
        <div key={f} style={{ display: 'flex', gap: hueco }}>
          {renglon.map((n) => (
            <Estampa
              key={n}
              lado={lado}
              llena={n <= estampas}
              premio={programa.hitos.includes(n)}
              marca={marca}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Monograma(p: { readonly lado: number; readonly marca: MarcaImagen }): ReactElement {
  const inicial = (p.marca.nombre.trim()[0] ?? '•').toUpperCase();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: p.lado,
        height: p.lado,
        backgroundColor: p.marca.fondo,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: Math.round(p.lado * 0.78),
          height: Math.round(p.lado * 0.78),
          borderRadius: p.lado,
          backgroundColor: p.marca.acento,
          color: p.marca.fondo,
          fontSize: Math.round(p.lado * 0.46),
          fontWeight: 700,
        }}
      >
        {inicial}
      </div>
    </div>
  );
}

function ImagenCentrada(p: {
  readonly url: string;
  readonly ancho: number;
  readonly alto: number;
  readonly fondo: string | null;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: p.ancho,
        height: p.alto,
        backgroundColor: p.fondo ?? 'transparent',
      }}
    >
      <img src={p.url} alt="" width={p.ancho} height={p.alto} style={{ objectFit: 'contain' }} />
    </div>
  );
}

/** Tira de estampas en el tamaño pedido. */
export function tira(
  marca: MarcaImagen,
  programa: ProgramaImagen,
  estampas: number,
  ancho: number,
  alto: number,
): Promise<Buffer> {
  const n = Math.min(Math.max(Math.trunc(estampas), 0), programa.posiciones);
  const clave = `tira:${huellaDeDiseno(marca, programa)}:${n}:${ancho}x${alto}`;
  return recordar(clave, () =>
    png(
      <Tira ancho={ancho} alto={alto} estampas={n} marca={marca} programa={programa} />,
      ancho,
      alto,
    ),
  );
}

/** Ícono cuadrado: el isotipo del negocio o, si no subió, su inicial. */
export function icono(marca: MarcaImagen, lado: number): Promise<Buffer> {
  const clave = `icono:${huellaDeDiseno(marca, { posiciones: 0, hitos: [] })}:${lado}`;
  return recordar(clave, async () => {
    if (marca.iconoUrl) {
      try {
        return await png(
          <ImagenCentrada url={marca.iconoUrl} ancho={lado} alto={lado} fondo={marca.fondo} />,
          lado,
          lado,
        );
      } catch (e) {
        console.warn('[wallet] no se pudo dibujar el isotipo; va la inicial', e);
      }
    }
    return png(<Monograma lado={lado} marca={marca} />, lado, lado);
  });
}

/**
 * Logotipo de la cabecera del pase de Apple (hasta 160×50 pt). Con logotipo
 * subido va ese, a lo ancho; si no, la inicial en un cuadro y el nombre lo
 * escribe Wallet al lado (`logoText`).
 */
export function logoApple(marca: MarcaImagen, escala: 1 | 2 | 3): Promise<Buffer> {
  const clave = `logo:${huellaDeDiseno(marca, { posiciones: 0, hitos: [] })}:${escala}`;
  return recordar(clave, async () => {
    if (marca.logoUrl) {
      try {
        return await png(
          <ImagenCentrada
            url={marca.logoUrl}
            ancho={160 * escala}
            alto={50 * escala}
            fondo={null}
          />,
          160 * escala,
          50 * escala,
        );
      } catch (e) {
        console.warn('[wallet] no se pudo dibujar el logotipo; va la inicial', e);
      }
    }
    return png(<Monograma lado={50 * escala} marca={marca} />, 50 * escala, 50 * escala);
  });
}

/** Medidas de la tira de una `storeCard` de Apple, en puntos. */
export const TIRA_APPLE = { ancho: 375, alto: 144 } as const;
/** Medidas de la imagen principal de Google Wallet, en píxeles. */
export const TIRA_GOOGLE = { ancho: 1032, alto: 336 } as const;
export const LOGO_GOOGLE = 660;

/** Los PNG del pase de Apple, con el nombre que Apple espera dentro del paquete. */
export async function imagenesDelPase(
  marca: MarcaImagen,
  programa: ProgramaImagen,
  estampas: number,
): Promise<Record<string, Buffer>> {
  const [i1, i2, i3, l1, l2, l3, t1, t2, t3] = await Promise.all([
    icono(marca, 29),
    icono(marca, 58),
    icono(marca, 87),
    logoApple(marca, 1),
    logoApple(marca, 2),
    logoApple(marca, 3),
    tira(marca, programa, estampas, TIRA_APPLE.ancho, TIRA_APPLE.alto),
    tira(marca, programa, estampas, TIRA_APPLE.ancho * 2, TIRA_APPLE.alto * 2),
    tira(marca, programa, estampas, TIRA_APPLE.ancho * 3, TIRA_APPLE.alto * 3),
  ]);
  return {
    'icon.png': i1,
    'icon@2x.png': i2,
    'icon@3x.png': i3,
    'logo.png': l1,
    'logo@2x.png': l2,
    'logo@3x.png': l3,
    'strip.png': t1,
    'strip@2x.png': t2,
    'strip@3x.png': t3,
  };
}
