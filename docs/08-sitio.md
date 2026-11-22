# 08 · Sitio del servicio (club-lealtad.com)

Fecha: 16 nov 2026. Reemplaza la página de inicio provisional de la instalación compartida.

## Qué es

El sitio que ven los dueños de negocio en la raíz de `club-lealtad.com`. Seis páginas:

| Dirección | Contenido |
| --- | --- |
| `/` | Inicio: tarjeta de ejemplo que se sella, selector de giros, resumen de pasos, gamificación y planes |
| `/como-funciona` | El recorrido para el dueño, el cliente y la caja; reglas de fábrica |
| `/negocios` | Giros con ejemplos y los negocios activos del sitio (salen de la base) |
| `/gamificacion` | Servicio adicional para Lite y Privada |
| `/planes` | Lite y Privada lado a lado |
| `/guia` | Guía de lealtad para dueños, con fuentes |

Solo existen en la instalación compartida y fuera de la dirección de un negocio. En una instalación privada (`WL_NEGOCIO_UNICO`) o en un subdominio dan 404 (`exigirSitioDelServicio`).

## Dónde está

- Páginas: `apps/web/src/app/{como-funciona,negocios,gamificacion,planes,guia}/page.tsx` y `components/sitio/Inicio.tsx`.
- Piezas comunes: `components/sitio/Marco.tsx`. Piezas con estado: `components/sitio/Interactivos.tsx`.
- Estilos: `components/sitio/sitio.css`, todos bajo `.cl` para no tocar las pantallas de los negocios. La paleta son las variables del primer bloque.
- `como-funciona`, `gamificacion`, `planes` y `guia` se agregaron a `SLUGS_RESERVADOS`: ningún negocio puede llamarse así.

## Marca (21 nov 2026)

Jano eligió el logo **«Tarjeta negra»**: una tarjeta negra de sellos con filo lima, el último sello es el premio en coral y hay otra tarjeta coral detrás. El paquete completo (SVG, PNG, íconos, avatar e imagen para compartir) y sus reglas están en `marca/` (raíz del repo, ver `marca/LEEME.md`).

- Paleta (`sitio.css`): noche `#120A2A`, lima `#C6FF3D`, coral `#FF5B3A`, violeta `#6C3BFF` para botones, crema `#FFF6EA` de fondo. `--acc` es el acento de trazos y figuras: coral sobre fondo claro y lima dentro de `.dk`, porque la lima no se ve sobre crema.
- Tipografía: Fredoka para logotipo y títulos (`@fontsource-variable/fredoka`, se carga solo en el sitio desde `Marco.tsx`), Onest para texto.
- Logo en encabezado y pie: `Isotipo` y `Logo` en `Marco.tsx`.
- Favicon, ícono de iPhone e imagen al compartir: archivos `club-lealtad-*` en `apps/web/public`, declarados en `metadatosDelSitio()` (`lib/sitio.ts`). Solo las páginas del sitio los llevan; tarjetas y paneles siguen con la marca de cada negocio.
- Los correos del sitio (sin negocio) usan noche y crema (`lib/correo.ts`).
- Panel del dueño (`ESTILO_PANEL` en `lib/admin/panel.ts`): mismos colores y títulos en Fredoka. La lima va en rellenos con texto noche y sobre fondos oscuros; donde el acento va solo sobre crema (barras, progreso, bordes de aviso) se usa `realce` (coral, `--wl-realce`). Fuera del panel, `realce` es el acento del negocio. Los sellos de la caja llevan contorno noche.
- Las piezas de «Juega y gana» (#18) usan `--acc` en sus sombras.

## Decisiones de Jano

- Todos los botones de contacto van a WhatsApp (`WL_CONTACTO_WHATSAPP`; si falta, +52 2222 5513 73). Más adelante irá a un contacto único con un agente de IA.
- La gamificación se ofrece como servicio adicional en Lite y en Privada.
- Poco texto, fondos en movimiento, contenido que aparece al pasar el cursor y secciones que entran con el scroll.

## Lo que el sitio promete y el producto aún no tiene

- Gamificación (retos, rachas, niveles, insignias, referidos, ruleta y sorteos): no hay código.
- Campañas a clientes y reportes completos: Fase 5.
- Pasar de Lite a Privada: falta la herramienta de migración.
- Apple Wallet y Google Wallet: sin probar en teléfono real (`07-wallet.md`).

## Pendiente

- Precios: hoy dice «Cotización en la demo».
- Términos y aviso de privacidad del sitio.
- Testimonio o caso real con permiso del negocio.
- Los premios y juegos por giro son ejemplos; falta validarlos.
- Las páginas del sitio se indexan en buscadores; las tarjetas y paneles siguen sin indexarse.
- No se ha visto en navegador: la construcción y el aspecto se comprueban en la vista previa de Vercel.
