# 09 · Asistente de alta, prueba de 7 días y embudo de la campaña

Fecha: 21 nov 2026. Decisiones de Jano tomadas ese día y lo que se construyó con ellas.

## Decisiones de Jano

| Tema | Decisión |
| --- | --- |
| Oferta | Prueba gratis de 7 días naturales desde el registro, con todo Lite y sin tarjeta bancaria |
| Precio de Lite | $269 al mes o $2,699 al año, IVA incluido |
| Día 8 sin pago | El club se pausa (la caja no sella); las tarjetas se conservan 30 días y después se borra |
| Cobro | Enlace de pago por WhatsApp y activación manual desde `/plataforma`; CFDI a quien lo pida |
| Titular | Jano, persona física (RESICO); «club-lealtad» es el nombre comercial |
| Público | Estado de Veracruz, dueños de retail y servicios; sin mencionar «hecho en Xalapa» |
| Giros | Primero salones, uñas, barberías y peluquerías; después cafeterías, panaderías y reposterías |
| Asistente | Nombre, giro, premio, WhatsApp y correo; color entre seis o tomado de una foto del logotipo |
| Premios por omisión | Barbería y peluquería: 5 sellos, sexto corte gratis. Salón y uñas: 5 sellos, 50% en el siguiente servicio. Cafetería, panadería y repostería: 5 sellos, una pieza gratis |
| Candados | Un club por correo y por WhatsApp, una sucursal, tope de 200 tarjetas en prueba, aviso por cada alta |
| Destino del anuncio | `/belleza` y `/cafeterias`, con el asistente a la vista |
| Campaña en Meta | Hasta $4,000; creativos de Claude más un video grabado en un negocio conocido |
| Seguimiento | Jano por WhatsApp con plantillas (días 0, 2, 6 y 7); automatizar después |
| Condición para pautar | Wallet funcionando en un iPhone y un Android reales; pruebas en frío antes |
| Meta | 30 negocios nuevos y 10 pagos anuales |

## Qué se construyó

- **Asistente** (`components/sitio/Asistente.tsx`, acción en `app/empezar/acciones.ts`). Crea el negocio, su programa, la sucursal «Principal» y la cuenta del dueño, sin pasar por Exkalibur.
- **Páginas de destino**: `/belleza`, `/cafeterias` y `/empezar` (general). Las tres quedan como direcciones reservadas.
- **Pantalla final** (`/empezar/listo`): enlace para elegir contraseña, enlace para sacar la propia tarjeta, QR de mostrador y dirección de la caja.
- **Prueba y pausa**. `ajustes.pruebaVence` guarda el fin de la prueba; `estadoComercial` devuelve `PRUEBA`, `PAUSADO` o `ACTIVO`. Pausado: `acreditarVisita` rechaza con `PROGRAMA_PAUSADO` y `crearTarjeta` no crea. En prueba: tope de 200 tarjetas. No requiere tarea programada: se decide por fecha en cada operación.
- **Plataforma**. La lista marca «En prueba» y «Prueba vencida»; la ficha muestra el contacto del alta y los botones «Registrar pago y activar» y «Dar 7 días de prueba desde hoy».
- **Giros y premios** en `packages/domain/src/alta/giros.ts`.
- **Color por foto**: el navegador lee el color dominante y elige la más cercana de las 20 combinaciones. La foto no se sube.
- El sitio muestra ya el precio de Lite y su botón principal lleva al asistente.

## Cómo entra el dueño sin correo

El asistente no manda correo: al terminar, la pantalla final trae el enlace de un solo uso para elegir contraseña. Por eso el alta funciona aunque Resend no esté configurado. Sí hace falta correo para recuperar una contraseña olvidada.

## Candados que hay y que no hay

Hay: un club por correo y por WhatsApp, campo trampa para robots, tope de 40 clubes nuevos por día en todo el sitio, tope de 200 tarjetas en prueba.

No hay: verificación de que el WhatsApp o el correo sean de quien los escribe, ni límite por dirección IP.

## Pendiente

- **Borrado a los 30 días de pausado**: no está construido; hoy un club pausado se queda guardado.
- **Aviso por cada alta**: se manda por correo a `WL_AVISOS_CORREO` cuando el correo esté configurado; mientras, el club aparece en `/plataforma`.
- **Aviso al dueño dentro de su panel** de cuántos días de prueba le quedan.
- **Términos y aviso de privacidad del servicio**, con Jano como titular; faltan su domicilio y un correo de privacidad. Deben publicarse antes de pautar.
- **Medición**: pixel de Meta y eventos del embudo.
- **Variables en Vercel** (21 nov: solo hay `DATABASE_URL`, `DIRECT_URL` y `CRON_SECRET`): faltan las de Apple Wallet, Google Wallet, Resend y el almacén de archivos. Pasos en `07-wallet.md`.
- Cuenta de cobro (Mercado Pago o Stripe) y activos de Meta (página, Instagram, cuenta publicitaria).
- Guion del video, creativos y plantillas de WhatsApp.
- Nada de esto se ha visto en un celular real.
