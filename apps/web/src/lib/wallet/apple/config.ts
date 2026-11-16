/**
 * Configuración de Apple Wallet.
 *
 * Un solo emisor para toda la instalación: el Pass Type ID y su certificado
 * son de la plataforma (o del negocio, en una instalación privada). Cada pase
 * lleva la marca del negocio; lo que distingue a un negocio de otro es la
 * dirección de su servicio web, que incluye su tramo (`sitio.mx/cafe/api/…`).
 *
 * Todo sale de variables de entorno. Los certificados van en base64 porque
 * las variables no admiten saltos de línea con comodidad; aquí se decodifican
 * a PEM. Si falta algo, `appleWalletConfigurado()` es false y el sitio no
 * ofrece el pase: el programa sigue funcionando con el QR de la web.
 */

export interface ConfigAppleWallet {
  readonly passTypeId: string;
  readonly teamId: string;
  /** PEM del certificado del Pass Type ID. */
  readonly certificado: string;
  /** PEM de la llave privada con la que se firmó la solicitud del certificado. */
  readonly llave: string;
  readonly llaveContrasena: string | undefined;
  /** PEM del certificado intermedio de Apple (WWDR G4). */
  readonly wwdr: string;
}

let cache: ConfigAppleWallet | null | undefined;

function pem(nombre: string): string | null {
  const b64 = process.env[nombre];
  if (!b64) return null;
  const texto = Buffer.from(b64, 'base64').toString('utf8').trim();
  return texto.startsWith('-----BEGIN') ? texto : null;
}

export function configAppleWallet(): ConfigAppleWallet | null {
  if (cache !== undefined) return cache;

  const passTypeId = process.env.APPLE_PASS_TYPE_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const certificado = pem('APPLE_PASS_CERT_BASE64');
  const llave = pem('APPLE_PASS_KEY_BASE64');
  const wwdr = pem('APPLE_WWDR_CERT_BASE64');

  if (!passTypeId || !teamId || !certificado || !llave || !wwdr) {
    cache = null;
    return null;
  }

  cache = {
    passTypeId,
    teamId,
    certificado,
    llave,
    llaveContrasena: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdr,
  };
  return cache;
}

export function appleWalletConfigurado(): boolean {
  return configAppleWallet() !== null;
}

/** Solo para pruebas: olvida la configuración leída. */
export function olvidarConfigAppleWallet(): void {
  cache = undefined;
}
