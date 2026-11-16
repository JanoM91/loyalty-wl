# 07 · Tarjeta en Apple Wallet y Google Wallet (Fase 4)

Fecha: 16 nov 2026. Decisiones de Jano: usar la cuenta de Apple Developer de
Beto (la misma con la que se hizo LAPANA), seguir el método de LAPANA
(`lapana-xalapa/docs/16` y `30`) y dejar la app nativa de tiendas fuera por
ahora. Dominio del servicio compartido: `club-lealtad.com`.

## Qué hace

- La tarjeta de cada cliente se puede guardar en Apple Wallet (iPhone) y en
  Google Wallet (Android) con un botón en `/lealtad/tarjeta`.
- El pase lleva la **marca del negocio** (nombre, colores, logotipo o inicial),
  las estampas dibujadas según su programa, el próximo premio y el **mismo QR**
  que la web: en caja se escanea desde el panel, sin que el cliente abra nada.
- Se **actualiza solo** cuando la caja acredita una visita o entrega un premio,
  y avisa en la pantalla bloqueada («Llevas 4 de 8 estampas», «🎁 Tienes un
  premio listo»). También se actualiza si el negocio cambia su marca o su
  programa.
- Al reverso: enlace personal a la tarjeta web, premios, sucursales, términos.

## Cómo está armado (lo que cambia frente a LAPANA)

| Tema | LAPANA | Loyalty WL |
| --- | --- | --- |
| Emisor | Uno, del negocio | **Uno por instalación**: en Lite, el de la plataforma para todos los negocios; en Privada, el del cliente |
| Marca del pase | Fija | La del negocio (`brand`), leída en cada pase |
| Imágenes | PNG fijos en `public/` | **Dibujadas al vuelo** por negocio, programa y estampas (`lib/wallet/imagenes.tsx`, motor `next/og`), con caché en memoria |
| Servicio web de Apple | `/api/wallet/apple` | `/<negocio>/api/wallet/apple`: cada pase apunta al servicio de su negocio, así toda consulta queda dentro de su aislamiento |
| Google | Una clase | **Una clase por negocio** (`<emisor>.wl_<id del negocio>`), que se crea y se pone al día sola |
| Campañas push | Sí | No todavía (Fase 5). El campo de mensajes ya va en el pase para que funcionen después |

No se reutiliza nada de LAPANA: ni su Pass Type ID, ni su certificado, ni su
emisor de Google.

Código: `apps/web/src/lib/wallet/` (`apple/`, `google/`, `imagenes.tsx`,
`negocio.ts`, `avisar.ts`), rutas en `app/api/wallet/` y
`app/lealtad/tarjeta/{apple,google}-wallet`. Datos: `packages/database/src/lealtad/wallet.ts`.

## Configuración (una sola vez)

### Apple (cuenta de Beto)

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers →
   «+» → Pass Type IDs → `pass.com.club-lealtad.tarjeta`.
2. En una carpeta **fuera del repo**:
   ```bash
   openssl genrsa -out wl-pass.key 2048
   openssl req -new -key wl-pass.key -out wl-pass.csr -subj "/CN=Loyalty WL Pass/C=MX"
   ```
3. Certificates → «+» → Pass Type ID Certificate → elegir el identificador →
   subir `wl-pass.csr` → descargar `pass.cer`.
4. `openssl x509 -inform DER -in pass.cer -out wl-pass.pem`
5. Intermedio de Apple (WWDR G4): descargar
   `https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer` y convertir:
   `openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr-g4.pem`
6. Variables en Vercel (producción y vista previa, sensibles):

   | Variable | Valor |
   | --- | --- |
   | `APPLE_PASS_TYPE_ID` | el identificador del paso 1 |
   | `APPLE_TEAM_ID` | Team ID de la cuenta (Membership details) |
   | `APPLE_PASS_CERT_BASE64` | `base64 -i wl-pass.pem \| tr -d '\n'` |
   | `APPLE_PASS_KEY_BASE64` | `base64 -i wl-pass.key \| tr -d '\n'` |
   | `APPLE_PASS_KEY_PASSPHRASE` | vacía si la llave no tiene contraseña |
   | `APPLE_WWDR_CERT_BASE64` | `base64 -i wwdr-g4.pem \| tr -d '\n'` |

El certificado **vence al año**: se renueva en el portal y se cambia
`APPLE_PASS_CERT_BASE64`. La llave puede ser la misma.

### Google

1. pay.google.com/business/console → Google Wallet API → crear la cuenta de
   emisor. Anotar el Issuer ID.
2. Google Cloud: proyecto nuevo → habilitar «Google Wallet API» → cuenta de
   servicio → llave JSON.
3. Consola de Wallet → Usuarios → invitar el correo de la cuenta de servicio
   como Desarrollador. Agregar las cuentas de prueba.
4. Variables en Vercel:

   | Variable | Valor |
   | --- | --- |
   | `GOOGLE_WALLET_ISSUER_ID` | Issuer ID |
   | `GOOGLE_WALLET_SA_EMAIL` | `client_email` del JSON |
   | `GOOGLE_WALLET_SA_KEY_BASE64` | `private_key` del JSON, en base64 (sensible) |
   | `GOOGLE_WALLET_PUBLICO` | `0` en modo demostración (botón oculto; la dirección `/lealtad/tarjeta/google-wallet` sí funciona para probar); `1` al aprobarse la publicación |

Sin las variables de una plataforma, su botón no aparece y todo lo demás
sigue igual.

## Antes de emitir el primer pase real

**Conectar el dominio definitivo.** Cada pase lleva grabadas la dirección del
QR y la de su servicio web. Un pase emitido con la dirección temporal de
Vercel seguiría apuntando ahí.

## Qué está comprobado y qué no

Comprobado en el entorno de desarrollo (16 nov), con un certificado de prueba
propio (no de Apple):

- Pruebas de los modelos de pase de Apple y Google por negocio (18).
- E2E en dos negocios (`WALLET_PRUEBA=1`): la tarjeta descarga un `.pkpass`
  con manifiesto, firma válida e imágenes en tres tamaños; lleva las estampas
  correctas, el QR de la web y el servicio web de su negocio; el servicio web
  registra un dispositivo, informa qué pase cambió, entrega el pase, responde
  304 sin cambios y da de baja; sin token responde 401 y **otro negocio no
  puede leer el pase**.
- Las imágenes se dibujan con los colores y el número de estampas de cada
  negocio.

**No comprobado** (no cuenta como funcionando hasta verlo en teléfono real):

- Que un iPhone acepte el pase con el certificado real y lo actualice.
- El aviso a Apple (APNs) desde Vercel.
- Todo Google Wallet contra la API real (solo están probados los modelos).
- Logotipos subidos por el negocio dentro del pase (falta el almacén de
  archivos); si el logotipo no se puede dibujar, el pase usa la inicial.

Riesgos a vigilar en la primera prueba real:

- Un mismo iPhone con pases de varios negocios bajo el mismo identificador:
  cada pase consulta el servicio de su negocio. Es el diseño previsto por
  Apple, pero hay que verlo funcionar con dos negocios en un teléfono.
- El certificado vive en la cuenta personal de Beto. Para clientes de la
  modalidad Privada conviene un identificador propio de cada cliente.

## Si un pase no se actualiza

1. Registros de Vercel: `[wallet] Apple reporta:` son errores que Wallet
   manda; `[wallet] push a Apple falló` es un rechazo de APNs.
2. Tabla `wallet_registration`: ¿el iPhone está registrado?
3. En el iPhone: Wallet → pase → (…) → apagar y encender «Actualizaciones
   automáticas».
