import { createSign } from 'node:crypto';

import type { ConfigGoogleWallet } from './config';

/**
 * Firmas y tokens para Google Wallet, sin librerías.
 *
 * Google acepta dos cosas firmadas con la llave de la cuenta de servicio:
 * - un JWT «savetowallet», que es el enlace con el que la persona guarda el
 *   pase en su teléfono;
 * - un JWT de aserción con el que se pide un token de acceso para llamar a la
 *   API (crear la clase, crear y actualizar objetos).
 *
 * Son JWT RS256 normales; `node:crypto` firma sin más dependencias.
 */

const ALCANCE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function b64url(dato: Buffer | string): string {
  return Buffer.from(dato).toString('base64url');
}

/** Firma `carga` como JWT RS256 con la llave de la cuenta de servicio. */
export function firmarJwt(carga: Record<string, unknown>, llavePem: string): string {
  const cabecera = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(carga));
  const firma = createSign('RSA-SHA256')
    .update(`${cabecera}.${cuerpo}`)
    .sign(llavePem, 'base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

/**
 * El enlace «Guardar en Google Wallet» para un objeto ya creado en la API.
 * `origen` es el del sitio (protocolo y dominio, sin ruta).
 */
export function enlaceGuardar(
  config: ConfigGoogleWallet,
  d: { readonly objectId: string; readonly classId: string; readonly origen: string },
): string {
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = firmarJwt(
    {
      iss: config.cuentaServicio,
      aud: 'google',
      typ: 'savetowallet',
      iat: ahora,
      origins: [d.origen],
      payload: { loyaltyObjects: [{ id: d.objectId, classId: d.classId }] },
    },
    config.llave,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

let tokenCache: { valor: string; expira: number } | null = null;

/** Token de acceso para la API, con caché mientras siga vigente. */
export async function tokenDeAcceso(config: ConfigGoogleWallet): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor;

  const ahora = Math.floor(Date.now() / 1000);
  const asercion = firmarJwt(
    {
      iss: config.cuentaServicio,
      scope: ALCANCE,
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600,
    },
    config.llave,
  );

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: asercion,
    }),
  });
  if (!r.ok) {
    throw new Error(
      `Google no dio token de acceso (${r.status}): ${(await r.text()).slice(0, 200)}`,
    );
  }
  const datos = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { valor: datos.access_token, expira: Date.now() + datos.expires_in * 1000 };
  return datos.access_token;
}
