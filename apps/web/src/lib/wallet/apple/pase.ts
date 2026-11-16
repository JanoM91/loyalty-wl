import { PKPass } from 'passkit-generator';
import {
  enlacePersonalDeTarjeta,
  mensajeWalletDeTarjeta,
  programaVigente,
  tarjetaParaPase,
  type Negocio,
} from '@wl/database';

import { urlEnlacePersonal } from '@/lib/lealtad/enlace-personal';
import { urlTarjeta } from '@/lib/lealtad/qr';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

import { imagenesDelPase } from '../imagenes';
import {
  ayudaDelNegocio,
  marcaDeImagen,
  programaDeImagen,
  sucursalesParticipantes,
} from '../negocio';
import { configAppleWallet, type ConfigAppleWallet } from './config';
import { construirPassJson, type NegocioPase } from './modelo';

/**
 * Construye y firma el pase (`.pkpass`) de una tarjeta.
 *
 * Un `.pkpass` es un zip con `pass.json`, las imágenes, un manifiesto con el
 * hash de cada archivo y la firma del manifiesto con el certificado del Pass
 * Type ID. `passkit-generator` arma y firma; aquí solo decidimos qué va dentro.
 *
 * Se llama siempre dentro de una petición de un negocio (el botón de la
 * tarjeta o el servicio web que consulta el iPhone): de ahí salen el negocio y
 * la dirección de su servicio web.
 */

export interface PaseGenerado {
  readonly archivo: Buffer;
  /** Fecha de la versión del pase; es el `Last-Modified` de la respuesta. */
  readonly actualizado: Date;
  readonly codigo: string;
  readonly negocio: string;
}

export const TIPO_MIME_PASE = 'application/vnd.apple.pkpass';

export function negocioDelPase(negocio: Negocio, origen: string): NegocioPase {
  const c = negocio.marca.colores;
  return {
    nombre: negocio.nombre,
    fondo: c.fondo,
    sobreFondo: c.sobreFondo,
    acento: c.acento,
    ayuda: ayudaDelNegocio(negocio),
    sitioPrograma: `${origen.replace(/^https?:\/\//, '')}/lealtad`,
    escribirNombre: !negocio.marca.logoClaroUrl,
  };
}

/** Dirección del servicio web de PassKit de este negocio, sin barra final. */
export function urlServicioWeb(origen: string): string {
  return `${origen}/api/wallet/apple`;
}

async function firmar(
  datos: NonNullable<Awaited<ReturnType<typeof tarjetaParaPase>>>,
  config: ConfigAppleWallet,
): Promise<Buffer> {
  const { tarjeta, token } = datos;
  const [negocio, origen, programa, personal, mensaje, sucursales, urlQr] = await Promise.all([
    exigirNegocio(),
    origenDeLaPeticion(),
    programaVigente(),
    enlacePersonalDeTarjeta(tarjeta.id),
    mensajeWalletDeTarjeta(tarjeta.id),
    sucursalesParticipantes(),
    urlTarjeta(tarjeta.codigo),
  ]);

  const passJson = construirPassJson(
    tarjeta,
    negocioDelPase(negocio, origen),
    {
      passTypeId: config.passTypeId,
      teamId: config.teamId,
      webServiceUrl: urlServicioWeb(origen),
      token,
      urlQr,
      urlTerminos: `${origen}/lealtad/terminos`,
      urlTarjetaWeb: `${origen}/lealtad/tarjeta`,
      sucursales,
      urlPersonal: personal ? await urlEnlacePersonal(personal) : null,
      mensaje: mensaje?.texto ?? null,
    },
    programa,
  );

  const imagenes = await imagenesDelPase(
    marcaDeImagen(negocio),
    programaDeImagen(programa),
    tarjeta.estampas,
  );
  const pase = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      ...imagenes,
    },
    {
      wwdr: config.wwdr,
      signerCert: config.certificado,
      signerKey: config.llave,
      signerKeyPassphrase: config.llaveContrasena,
    },
  );
  return pase.getAsBuffer();
}

/**
 * El pase de una tarjeta, o null si la tarjeta no existe, está inactiva o
 * Apple Wallet no está configurado.
 */
export async function generarPase(cardId: string): Promise<PaseGenerado | null> {
  const config = configAppleWallet();
  if (!config) return null;
  const datos = await tarjetaParaPase(cardId);
  if (!datos) return null;
  const negocio = await exigirNegocio();
  const archivo = await firmar(datos, config);
  return {
    archivo,
    actualizado: datos.actualizada,
    codigo: datos.tarjeta.codigo,
    negocio: negocio.slug,
  };
}
