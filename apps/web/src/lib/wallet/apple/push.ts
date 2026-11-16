import http2 from 'node:http2';

import type { ConfigAppleWallet } from './config';

/**
 * Aviso a Apple (APNs) de que un pase cambió.
 *
 * Para los pases no hace falta una llave de notificaciones aparte: se usa el
 * mismo certificado del Pass Type ID como certificado de cliente TLS. El
 * mensaje va vacío; el tema (`apns-topic`) es el identificador del pase y el
 * token dice a qué iPhone. Al recibirlo, Wallet pregunta a nuestro servicio
 * web qué tarjetas cambiaron y descarga las nuevas versiones.
 *
 * Se usa `http2` de Node y no `fetch` porque `fetch` no admite certificados
 * de cliente.
 */

const SERVIDOR = 'https://api.push.apple.com';

export type ResultadoPush =
  | { readonly ok: true }
  /** Apple dice que el token ya no sirve: hay que olvidar el dispositivo. */
  | { readonly ok: false; readonly tokenInvalido: true; readonly motivo: string }
  | { readonly ok: false; readonly tokenInvalido: false; readonly motivo: string };

export function enviarPushPase(
  pushToken: string,
  config: ConfigAppleWallet,
  tiempoMaximoMs = 8000,
): Promise<ResultadoPush> {
  return new Promise((resolve) => {
    let terminado = false;
    const terminar = (r: ResultadoPush) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      cliente.close();
      resolve(r);
    };

    const cliente = http2.connect(SERVIDOR, {
      cert: config.certificado,
      key: config.llave,
      passphrase: config.llaveContrasena,
    });
    cliente.on('error', (e) =>
      terminar({ ok: false, tokenInvalido: false, motivo: `conexión: ${e.message}` }),
    );

    const reloj = setTimeout(
      () => terminar({ ok: false, tokenInvalido: false, motivo: 'tiempo agotado' }),
      tiempoMaximoMs,
    );

    const peticion = cliente.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': config.passTypeId,
      'apns-push-type': 'background',
      'content-type': 'application/json',
    });

    let estado = 0;
    let cuerpo = '';
    peticion.on('response', (cabeceras) => {
      estado = Number(cabeceras[':status'] ?? 0);
    });
    peticion.setEncoding('utf8');
    peticion.on('data', (trozo: string) => (cuerpo += trozo));
    peticion.on('end', () => {
      if (estado === 200) return terminar({ ok: true });
      let razon = cuerpo;
      try {
        razon = String((JSON.parse(cuerpo) as { reason?: string }).reason ?? cuerpo);
      } catch {
        /* cuerpo no es JSON */
      }
      const invalido = estado === 410 || razon === 'BadDeviceToken' || razon === 'Unregistered';
      terminar({ ok: false, tokenInvalido: invalido, motivo: `${estado} ${razon}`.trim() });
    });
    peticion.on('error', (e) =>
      terminar({ ok: false, tokenInvalido: false, motivo: `petición: ${e.message}` }),
    );

    peticion.end(JSON.stringify({ aps: {} }));
  });
}
