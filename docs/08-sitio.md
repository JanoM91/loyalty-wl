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
