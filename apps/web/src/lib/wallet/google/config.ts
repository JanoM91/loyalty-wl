/**
 * Configuración de Google Wallet.
 *
 * Un solo emisor para toda la instalación (la cuenta de emisor de la
 * plataforma, o la del negocio en una instalación privada). Cada negocio tiene
 * su propia **clase** dentro de ese emisor, con su nombre, logotipo y color.
 *
 * Tres variables: el Issuer ID de la consola de Google Pay & Wallet, el correo
 * de la cuenta de servicio con permiso en esa consola y su llave privada (el
 * campo `private_key` del JSON que da Google Cloud), en base64. Sin ellas el
 * sitio no ofrece el pase de Google y nada más cambia.
 */

export interface ConfigGoogleWallet {
  readonly issuerId: string;
  readonly cuentaServicio: string;
  /** PEM de la llave privada de la cuenta de servicio. */
  readonly llave: string;
}

let cache: ConfigGoogleWallet | null | undefined;

export function configGoogleWallet(): ConfigGoogleWallet | null {
  if (cache !== undefined) return cache;

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const cuentaServicio = process.env.GOOGLE_WALLET_SA_EMAIL?.trim();
  const b64 = process.env.GOOGLE_WALLET_SA_KEY_BASE64;
  const llave = b64 ? Buffer.from(b64, 'base64').toString('utf8').trim() : '';

  if (!issuerId || !cuentaServicio || !llave.startsWith('-----BEGIN')) {
    cache = null;
    return null;
  }

  cache = { issuerId, cuentaServicio, llave };
  return cache;
}

export function googleWalletConfigurado(): boolean {
  return configGoogleWallet() !== null;
}

/**
 * ¿Se muestra el botón al público? Mientras Google tenga la cuenta en modo
 * demostración solo las cuentas de prueba pueden guardar el pase: el botón se
 * esconde hasta que `GOOGLE_WALLET_PUBLICO` sea "1". La dirección
 * `/lealtad/tarjeta/google-wallet` funciona igual, para probar.
 */
export function googleWalletPublico(): boolean {
  return googleWalletConfigurado() && process.env.GOOGLE_WALLET_PUBLICO === '1';
}
