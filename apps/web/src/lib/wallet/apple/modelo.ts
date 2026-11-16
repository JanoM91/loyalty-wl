import { textoProximoPremio, type ProgramaLealtad } from '@wl/domain';
import type { VistaTarjeta } from '@wl/database';

/**
 * El contenido del pase (`pass.json`) a partir de la tarjeta y del negocio.
 *
 * Es una función pura: recibe la tarjeta, la marca del negocio y los datos de
 * identificación y devuelve el objeto que Apple espera. Así se prueba sin
 * certificados.
 *
 * Diseño: una `storeCard` con la tira (`strip`) de estampas arriba, como en la
 * web. Los campos de texto repiten lo esencial para quien lo lee de reojo en
 * la fila: cuántas estampas lleva, qué sigue y si tiene premios listos. El
 * reverso explica el programa y lleva los enlaces.
 */

/** Lo que el pase toma del negocio. */
export interface NegocioPase {
  readonly nombre: string;
  /** Colores de la marca, en hexadecimal (#rrggbb). */
  readonly fondo: string;
  readonly sobreFondo: string;
  readonly acento: string;
  /** Correo o WhatsApp de ayuda que el negocio publicó; null si ninguno. */
  readonly ayuda: string | null;
  /** Dirección del programa para mostrar: "sitio.mx/cafe/lealtad". */
  readonly sitioPrograma: string;
  /**
   * Wallet escribe el nombre junto al logotipo. Va en false cuando el negocio
   * subió un logotipo que ya lo dice.
   */
  readonly escribirNombre: boolean;
}

export interface IdentidadPase {
  readonly passTypeId: string;
  readonly teamId: string;
  /** Base del servicio web del negocio, sin barra final. Apple agrega /v1/… */
  readonly webServiceUrl: string;
  readonly token: string;
  /** Lo que lleva el QR: la misma dirección que el QR de la web. */
  readonly urlQr: string;
  readonly urlTerminos: string;
  readonly urlTarjetaWeb: string;
  /** Nombres de las sucursales con el programa encendido. */
  readonly sucursales: readonly string[];
  /** Enlace personal permanente («Mi tarjeta»), si la tarjeta ya tiene. */
  readonly urlPersonal?: string | null;
  /** Último mensaje del negocio para esta tarjeta. */
  readonly mensaje?: string | null;
}

/**
 * Texto del campo de mensajes cuando todavía no hay ninguno. El campo existe
 * siempre: Apple solo avisa en la pantalla bloqueada cuando cambia el valor de
 * un campo que ya estaba en el pase, no cuando aparece uno nuevo.
 */
export function mensajeVacio(nombre: string): string {
  return `Aquí verás los avisos de ${nombre}.`;
}

/** Escapa texto para `attributedValue` (HTML mínimo que entiende Wallet). */
function html(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "#14100c" → "rgb(20, 16, 12)", el formato de color de Apple. */
export function rgbDeHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Aviso de la pantalla bloqueada al cambiar las estampas. Se arma con el
 * estado nuevo: así la tarjeta recién completada no dice «0 estampas» a secas.
 */
export function avisoEstampas(estampas: number, ciclo: number): string {
  if (estampas === 0 && ciclo > 1) return '¡Completaste tu tarjeta! Empiezas la nueva con %@.';
  return '¡Gracias por tu visita! Llevas %@ estampas.';
}

export interface CampoPase {
  readonly key: string;
  readonly label?: string;
  readonly value: string | number;
  readonly textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentRight' | 'PKTextAlignmentCenter';
  /** Texto de la notificación cuando este campo cambia. `%@` es el valor nuevo. */
  readonly changeMessage?: string;
  readonly attributedValue?: string;
}

export interface PassJson {
  readonly formatVersion: 1;
  readonly passTypeIdentifier: string;
  readonly teamIdentifier: string;
  readonly serialNumber: string;
  readonly organizationName: string;
  readonly logoText?: string;
  readonly description: string;
  readonly backgroundColor: string;
  readonly foregroundColor: string;
  readonly labelColor: string;
  readonly webServiceURL: string;
  readonly authenticationToken: string;
  readonly sharingProhibited: boolean;
  readonly barcodes: readonly {
    readonly format: 'PKBarcodeFormatQR';
    readonly message: string;
    readonly messageEncoding: 'iso-8859-1';
    readonly altText: string;
  }[];
  readonly storeCard: {
    readonly headerFields: readonly CampoPase[];
    readonly primaryFields: readonly CampoPase[];
    readonly secondaryFields: readonly CampoPase[];
    readonly auxiliaryFields: readonly CampoPase[];
    readonly backFields: readonly CampoPase[];
  };
}

export function premiosListos(t: VistaTarjeta): number {
  return t.premios.filter((p) => p.disponible).length;
}

export function construirPassJson(
  t: VistaTarjeta,
  negocio: NegocioPase,
  id: IdentidadPase,
  programa: ProgramaLealtad,
): PassJson {
  const listos = premiosListos(t);
  const nombre = t.nombre?.trim() || 'Tu tarjeta';
  const posiciones = programa.posiciones;

  const premiosTexto = [...programa.hitos]
    .sort((a, b) => a.posicion - b.posicion)
    .map((h) => `${h.posicion} estampas: ${h.nombre}${h.incluye ? ` (${h.incluye})` : ''}`)
    .join('\n');

  return {
    formatVersion: 1,
    passTypeIdentifier: id.passTypeId,
    teamIdentifier: id.teamId,
    serialNumber: t.id,
    organizationName: negocio.nombre,
    ...(negocio.escribirNombre ? { logoText: negocio.nombre } : {}),
    description: `Tarjeta de lealtad de ${negocio.nombre}`,
    backgroundColor: rgbDeHex(negocio.fondo),
    foregroundColor: rgbDeHex(negocio.sobreFondo),
    labelColor: rgbDeHex(negocio.acento),
    webServiceURL: id.webServiceUrl,
    authenticationToken: id.token,
    // El pase es personal: compartirlo regalaría las estampas de otra persona.
    sharingProhibited: true,
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: id.urlQr,
        messageEncoding: 'iso-8859-1',
        altText: t.codigo,
      },
    ],
    storeCard: {
      headerFields: [
        {
          key: 'estampas',
          label: 'ESTAMPAS',
          value: `${t.estampas} de ${posiciones}`,
          textAlignment: 'PKTextAlignmentRight',
          changeMessage: avisoEstampas(t.estampas, t.ciclo),
        },
      ],
      // La tira de estampas ocupa el lugar de los campos principales.
      primaryFields: [],
      secondaryFields: [
        { key: 'titular', label: 'TITULAR', value: nombre },
        {
          key: 'ciclo',
          label: 'TARJETA',
          value: `N.º ${t.ciclo}`,
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      auxiliaryFields: [
        {
          key: 'siguiente',
          label: listos > 0 ? 'PREMIOS LISTOS' : 'PRÓXIMO PREMIO',
          value:
            listos > 0
              ? listos === 1
                ? 'Tienes un premio listo. Pídelo en caja.'
                : `Tienes ${listos} premios listos. Pídelos en caja.`
              : textoProximoPremio(t.estampas, programa),
          changeMessage: listos > 0 ? '🎁 %@' : '%@',
        },
      ],
      backFields: [
        // Primero: es lo que se lee al tocar la notificación de un aviso.
        {
          key: 'mensaje',
          label: `Mensaje de ${negocio.nombre}`,
          value: id.mensaje?.trim() || mensajeVacio(negocio.nombre),
          changeMessage: '%@',
        },
        ...(id.urlPersonal
          ? [
              {
                key: 'mi_tarjeta',
                label: 'Abrir mi tarjeta (tu enlace personal)',
                value: id.urlPersonal,
                attributedValue: `<a href="${html(id.urlPersonal)}">Abrir mi tarjeta, perfil y premios</a>`,
              },
            ]
          : []),
        { key: 'codigo', label: 'Código de tu tarjeta', value: t.codigo },
        {
          key: 'como',
          label: 'Cómo funciona',
          value:
            'Muestra el código en caja en cada compra y recibes tus estampas. La tarjeta se actualiza sola en tu iPhone.',
        },
        { key: 'premios', label: 'Premios', value: premiosTexto },
        {
          key: 'sucursales',
          label: 'Sucursales participantes',
          value:
            id.sucursales.length > 0
              ? id.sucursales.join(' · ')
              : `Consulta las sucursales participantes en ${negocio.sitioPrograma}.`,
        },
        ...(id.urlPersonal
          ? []
          : [{ key: 'web', label: 'Tu tarjeta en la web', value: id.urlTarjetaWeb }]),
        {
          key: 'terminos',
          label: 'Términos y aviso de privacidad',
          value: id.urlTerminos,
        },
        ...(negocio.ayuda ? [{ key: 'ayuda', label: 'Ayuda', value: negocio.ayuda }] : []),
      ],
    },
  };
}
