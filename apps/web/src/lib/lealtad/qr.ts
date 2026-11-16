import QRCode from 'qrcode';
import { origenDeLaPeticion } from '@/lib/negocio';

/**
 * Códigos QR del programa, dibujados en el servidor como SVG.
 *
 * SVG y no imagen: se ve nítido a cualquier tamaño (en la pantalla del
 * celular y en el cartel impreso del mostrador) y no requiere almacenamiento.
 */

/** Lo que lleva el QR personal: una dirección que termina en el código. */
export async function urlTarjeta(codigo: string): Promise<string> {
  return `${await origenDeLaPeticion()}/lealtad/t/${codigo}`;
}

/** Lo que lleva el QR del mostrador de cada sucursal. */
export async function urlAfiliacion(slug: string): Promise<string> {
  return `${await origenDeLaPeticion()}/lealtad/unete/${slug}`;
}

export async function qrSvg(texto: string, oscuro = '#14100c'): Promise<string> {
  return QRCode.toString(texto, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: oscuro, light: '#ffffff' },
  });
}
