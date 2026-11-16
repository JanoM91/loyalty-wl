import { textoProximoPremio, type ProgramaLealtad } from '@wl/domain';
import type { VistaTarjeta } from '@wl/database';

/**
 * Clase y objeto de Google Wallet a partir de la tarjeta y del negocio.
 *
 * En Google el pase se divide en dos: la **clase** (el programa de un negocio:
 * nombre, logotipo, color) y el **objeto** (la tarjeta de una persona:
 * estampas, QR, premios). Aquí ambos se construyen como funciones puras, igual
 * que `pass.json` en Apple, para probarlos sin credenciales.
 *
 * Las estampas se muestran en la imagen principal (`heroImage`). Como Google
 * guarda en caché las imágenes por dirección, cada número de estampas y cada
 * diseño tienen la suya: al cambiar, cambia la dirección y el teléfono
 * descarga la nueva.
 */

export interface NegocioGoogle {
  /** Id del negocio (uuid): de ahí sale el identificador de su clase. */
  readonly id: string;
  readonly nombre: string;
  /** Color de fondo de la marca, en hexadecimal. */
  readonly fondo: string;
  /** Dirección base del negocio, sin barra final: "https://sitio.mx/cafe". */
  readonly origen: string;
  /** Huella del diseño (marca y programa): va en las direcciones de imagen. */
  readonly huella: string;
}

export interface IdentidadGoogle {
  readonly issuerId: string;
  /** Lo que lleva el QR: la misma dirección que el QR de la web. */
  readonly urlQr: string;
  /** Enlace personal permanente («Mi tarjeta»), si la tarjeta ya tiene. */
  readonly urlPersonal?: string | null;
}

interface Imagen {
  readonly sourceUri: { readonly uri: string };
  readonly contentDescription: {
    readonly defaultValue: { readonly language: 'es'; readonly value: string };
  };
}

const imagen = (uri: string, descripcion: string): Imagen => ({
  sourceUri: { uri },
  contentDescription: { defaultValue: { language: 'es', value: descripcion } },
});

/**
 * Identificador de la clase de un negocio: `<emisor>.wl_<id sin guiones>`.
 * Sale del id y no del nombre corto para que renombrar el negocio no cree un
 * programa nuevo en Google.
 */
export function idClase(issuerId: string, negocioId: string): string {
  return `${issuerId}.wl_${negocioId.replace(/-/g, '')}`;
}

/** Identificador del objeto: el del emisor más el id de la tarjeta. */
export function idObjeto(issuerId: string, cardId: string): string {
  return `${issuerId}.${cardId}`;
}

export function urlImagenLogo(n: NegocioGoogle): string {
  return `${n.origen}/api/wallet/imagen/logo.png?v=${n.huella}`;
}

export function urlImagenTira(n: NegocioGoogle, estampas: number): string {
  return `${n.origen}/api/wallet/imagen/tira-${Math.max(0, Math.trunc(estampas))}.png?v=${n.huella}`;
}

export interface ClaseGoogle {
  readonly id: string;
  readonly issuerName: string;
  readonly programName: string;
  readonly programLogo: Imagen;
  readonly hexBackgroundColor: string;
  readonly reviewStatus: 'UNDER_REVIEW';
  readonly countryCode: 'MX';
  readonly localizedProgramName: {
    readonly defaultValue: { readonly language: 'es'; readonly value: string };
  };
}

export function construirClase(issuerId: string, n: NegocioGoogle): ClaseGoogle {
  const programa = `Tarjeta de lealtad de ${n.nombre}`;
  return {
    id: idClase(issuerId, n.id),
    issuerName: n.nombre,
    programName: programa,
    localizedProgramName: { defaultValue: { language: 'es', value: programa } },
    programLogo: imagen(urlImagenLogo(n), n.nombre),
    hexBackgroundColor: n.fondo,
    // Google exige este valor al crear o modificar una clase.
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
  };
}

export interface ObjetoGoogle {
  readonly id: string;
  readonly classId: string;
  readonly state: 'ACTIVE' | 'INACTIVE';
  readonly accountId: string;
  readonly accountName: string;
  readonly loyaltyPoints: {
    readonly label: string;
    readonly balance: { readonly string: string };
  };
  readonly secondaryLoyaltyPoints: {
    readonly label: string;
    readonly balance: { readonly string: string };
  };
  readonly barcode: {
    readonly type: 'QR_CODE';
    readonly value: string;
    readonly alternateText: string;
  };
  readonly heroImage: Imagen;
  readonly textModulesData: readonly {
    readonly id: string;
    readonly header: string;
    readonly body: string;
  }[];
  readonly linksModuleData: {
    readonly uris: readonly {
      readonly id: string;
      readonly uri: string;
      readonly description: string;
    }[];
  };
}

export function construirObjeto(
  t: VistaTarjeta,
  n: NegocioGoogle,
  id: IdentidadGoogle,
  programa: ProgramaLealtad,
): ObjetoGoogle {
  const listos = t.premios.filter((p) => p.disponible).length;
  const nombre = t.nombre?.trim() || 'Tu tarjeta';
  const premiosTexto = [...programa.hitos]
    .sort((a, b) => a.posicion - b.posicion)
    .map((h) => `${h.posicion} estampas: ${h.nombre}.`)
    .join(' ');

  return {
    id: idObjeto(id.issuerId, t.id),
    classId: idClase(id.issuerId, n.id),
    state: 'ACTIVE',
    accountId: t.codigo,
    accountName: nombre,
    loyaltyPoints: {
      label: 'Estampas',
      balance: { string: `${t.estampas} de ${programa.posiciones}` },
    },
    secondaryLoyaltyPoints: {
      label: 'Tarjeta',
      balance: { string: `N.º ${t.ciclo}` },
    },
    barcode: { type: 'QR_CODE', value: id.urlQr, alternateText: t.codigo },
    heroImage: imagen(
      urlImagenTira(n, t.estampas),
      `${t.estampas} de ${programa.posiciones} estampas`,
    ),
    textModulesData: [
      {
        id: 'siguiente',
        header: listos > 0 ? 'Premios listos' : 'Próximo premio',
        body:
          listos > 0
            ? listos === 1
              ? 'Tienes un premio listo. Pídelo en caja.'
              : `Tienes ${listos} premios listos. Pídelos en caja.`
            : textoProximoPremio(t.estampas, programa),
      },
      {
        id: 'como',
        header: 'Cómo funciona',
        body: 'Muestra el código en caja en cada compra y recibes tus estampas. La tarjeta se actualiza sola.',
      },
      { id: 'premios', header: 'Premios', body: premiosTexto },
    ],
    linksModuleData: {
      uris: [
        id.urlPersonal
          ? { id: 'web', uri: id.urlPersonal, description: 'Abrir mi tarjeta (enlace personal)' }
          : { id: 'web', uri: `${n.origen}/lealtad/tarjeta`, description: 'Tu tarjeta en la web' },
        {
          id: 'terminos',
          uri: `${n.origen}/lealtad/terminos`,
          description: 'Términos y aviso de privacidad',
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------

/**
 * Qué aviso merece un cambio del objeto, comparando lo que Google tiene con lo
 * nuevo. Google cuenta máximo 3 avisos por pase en 24 h, así que se gasta uno
 * solo por cambio: el premio listo (mensaje) gana sobre la estampa (cambio de
 * saldo).
 */
export type AvisoGoogle = 'PREMIO' | 'ESTAMPA' | null;

export function avisoPorCambio(
  previo: { readonly saldo: string | null; readonly premiosListos: boolean } | null,
  nuevo: ObjetoGoogle,
): AvisoGoogle {
  if (!previo) return null;
  const listos = nuevo.textModulesData.some(
    (m) => m.id === 'siguiente' && m.header === 'Premios listos',
  );
  if (listos && !previo.premiosListos) return 'PREMIO';
  if (previo.saldo !== null && previo.saldo !== nuevo.loyaltyPoints.balance.string)
    return 'ESTAMPA';
  return null;
}

/** Mensaje de Google Wallet (`addMessage`). */
export interface MensajeGoogle {
  readonly id: string;
  readonly header: string;
  readonly body: string;
  readonly messageType: 'TEXT' | 'TEXT_AND_NOTIFY';
}

export function mensajeGoogle(
  id: string,
  header: string,
  body: string,
  notificar: boolean,
): MensajeGoogle {
  return {
    id: id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64),
    header: header.slice(0, 80),
    body: body.slice(0, 500),
    messageType: notificar ? 'TEXT_AND_NOTIFY' : 'TEXT',
  };
}
