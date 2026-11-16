# 01 · Brechas: qué se copia, qué se reescribe y qué se excluye

> 14 nov 2026 · Fase 0. **Segunda revisión el 15 nov 2026** sobre `develop@2391356`, ya emparejada en la copia local: todas las cifras de §1 y §7 se volvieron a medir. Rutas relativas a `lapana-xalapa`. Líneas de TS/TSX sin pruebas. La marca «(develop)» señala lo que faltaba en la copia anterior.
> **Copiar** = se trae y se le quita la marca. **Reescribir** = cambia la forma (contexto de negocio, firma de funciones o enfoque). **Excluir** = no entra.

## 1. Resumen

| Bloque | Líneas | Destino |
| --- | ---: | --- |
| Dominio de lealtad | 1 287 | Copiar y generalizar |
| Datos de lealtad (sin `clientes.ts`) | 4 288 | Reescribir firmas; conservar la lógica |
| Auth del panel | 1 033 | Copiar y aislar por negocio |
| App del cliente (`/lealtad` sin `comprar`, `c`, `baja`) | 2 456 | Copiar y generalizar |
| Componentes de lealtad | 833 | Copiar; tema por variables |
| Panel de lealtad (sin POS) | 5 629 | Copiar y aislar |
| Wallet (`lib/wallet` + `api/wallet`) | 1 544 | Reescribir marca, imágenes y credenciales |
| Usuarios del panel | 893 | Copiar y aislar |
| Acceso, cuenta, sucursales, portada y marco del panel | ~1 450 | Copiar y recortar (**no estaba en el prompt**) |
| `lib/admin`, `lib/lealtad`, correo | ~670 | Copiar; correo se reescribe (**no estaba en el prompt**) |
| Cron de fotos, middleware, `fechaLocal` y `sumarDias` | ~150 | Reescribir (**no estaba en el prompt**) |
| **Total v1 a portar** | **~20 200** | más ~2 800 de pruebas (dominio 845, datos 1 651, Wallet 273) |
| Comunicación (app, componentes, lib, datos, dominio, rutas) | ~3 900 | Fase 5 |
| Nuevo, sin equivalente en LAPANA | — | Negocios, marca, tema, panel de plataforma, imágenes dinámicas, manual, exportar y borrar |

## 2. Dominio · `packages/domain/src/loyalty`

| Archivo | Destino | Qué cambia |
| --- | --- | --- |
| `programa.ts` | Copiar | Fuera el catálogo `PREMIOS` (pan dulce) y `PROGRAMA_V1`/`V2`; quedan como fixture de pruebas con un rubro neutro. Respaldo genérico si falta el nombre. |
| `motor.ts` | Copiar | Depende de `../order/schedule` (`sumarDias`, `fechaLocal`): traer esas dos funciones y que reciban la zona horaria. El texto «más de 48 horas» sale de la ventana del programa. Reglas de comprobante por ajuste del negocio (D14). |
| `acceso.ts` | Copiar | `esVarianteDeLapana` y `RELLENO_MARCA` pasan a una regla que recibe el nombre del negocio. Fuera «pan12345», «panaderia», «boulangerie», «xalapa123» de la lista fija. `mensajeEnlaceAcceso` por plantilla. |
| `contacto.ts` | Copiar | Prefijo del código (`LP-`) por negocio. El celular a 10 dígitos es solo de México: se conserva (mercado declarado). |
| `reenvio.ts` | Copiar | «LAPANA 🥖» y asuntos por plantilla. (develop) agrega el enlace personal. |
| `sin-tarjeta.ts` | Copiar | Exigir comprobante pasa a ajuste. |
| Pruebas: `lealtad`, `acceso`, `reenvio`, `sin-tarjeta` (845 líneas) | Copiar | Ajustar fixtures. Cobertura mínima de 90 %. |

## 3. Datos · `packages/database`

| Pieza | Destino | Qué cambia |
| --- | --- | --- |
| `src/index.ts` (cliente global) | Reescribir | Desaparece el `prisma` exportado; entra el `db` por negocio (D5). |
| `lealtad/caja.ts`, `alta-caja.ts`, `tarjetas.ts`, `verificacion.ts`, `acceso.ts`, `reenvio.ts`, `reportes.ts`, `mantenimiento.ts`, `wallet.ts` | Reescribir firmas | Cada función recibe `db`. `findUnique` por celular, correo, código y `ticket_key` pasa a clave compuesta con `tenant_id`. Las constantes de regla pasan a ajustes. |
| `lealtad/programa.ts` | Reescribir | La caché de 30 s es una variable global: debe ser por negocio. `version` única por negocio. |
| `lealtad/analitica.ts` (7 SQL), `reportes.ts` (1), `acceso.ts` (2), `caja.ts` (1) | Reescribir SQL | Filtro por negocio y zona horaria como parámetro. Cubrir con pruebas de fuga. |
| `lealtad/clientes.ts` (554 líneas, 8 SQL) | **Excluir** | Depende de tablas del POS. Las etapas de cliente (sin compras) se pueden rehacer después. |
| `lealtad/enlace-personal.ts` (develop, 164) | Copiar | Enlace permanente «Mi tarjeta». |
| 25 llamadas `prisma.…` hechas desde `apps/web` (`lib/admin/lealtad.ts`, `lib/wallet/apple/pase.ts`, entre otras) | Reescribir | Pasan al paquete de datos o reciben el `db` del negocio. |
| `auth/password.ts`, `roles.ts`, `sesion.ts`, `usuarios.ts` | Copiar y aislar | Correo único por negocio; rol `PLATAFORMA` sin negocio; cookie `wl_admin`. Revisar `MARKETING` y `LECTOR`: sus descripciones hablan de productos y precios. |
| `schema.prisma` | Reescribir | Ver §6. |
| Pruebas de integración (`lealtad`, `acceso`, `usuarios`, `alta-caja`, `password`: 1 651 líneas) | Copiar | Sembrar **dos** negocios; agregar las pruebas de fuga. Renombrar `LAPANA_PRUEBAS_BD`. |
| `comunicacion/campanas.ts` (941) | Fase 5 | — |
| `pos/*`, `pedidos/*`, `queries/*`, `analitica/tablero.ts` (develop), `prisma/importar.ts`, `productos.ts`, `sql/001_analytics_schemas.sql` | **Excluir** | — |

## 4. Aplicación · `apps/web/src`

| Ruta | Destino | Notas |
| --- | --- | --- |
| `app/lealtad/{alta,entrar,recuperar,acceso,verificar,tarjeta,premios,historial,perfil,t,unete,app,manifest.webmanifest}` + `acciones.ts`, `Portada.tsx`, `layout.tsx` | Copiar | Marca, colores, logo y `themeColor` desde el negocio. Cookies `wl_card` y `wl_app`. El manifest toma nombre e íconos del negocio. |
| `app/lealtad/mi/[token]` (develop, 121) | Copiar | Enlace personal. |
| `app/lealtad/error.tsx` (develop) | Copiar | Límite de error; hoy con identidad visual de LAPANA. |
| `tests/e2e/` y `.agents/skills/exkalibur-autonomous-e2e` (develop) | Tomar el estándar | Historias de usuario y recorrido con Playwright (D19). No se copian las historias de LAPANA. |
| `app/lealtad/terminos` | Reescribir | Plantilla con datos del negocio, marcada «revisar con abogado». Falta además el aviso de privacidad por negocio. |
| `app/lealtad/comprar` | **Excluir** | Pedidos. |
| `app/lealtad/c`, `app/lealtad/baja`, `api/baja`, `api/correo/webhook`, `api/cron/comunicacion` | Fase 5 | Comunicación. |
| `components/lealtad/*` | Copiar | `Iconos.tsx` (croissant y corona) pasa a un juego neutro configurable. `TarjetaSellos` ya dibuja N posiciones. |
| `app/admin/lealtad/{caja,pendientes,programa,sucursales,tarjetas,analitica}` + `page.tsx` | Copiar y aislar | `Caja.tsx` (1 074) y `NuevoCliente.tsx` (643) son las piezas más grandes. Mensajes «tarjeta LAPANA» y «LP-XXXX-XXXX» por negocio. |
| `app/admin/lealtad/{ventas-pos,cruce,clientes}` (2 071) | **Excluir** | POS. |
| `app/admin/{entrar,contrasena,cuenta,usuarios}`, `layout.tsx`, `page.tsx` | Copiar y aislar | El acceso busca la cuenta dentro del negocio del host. |
| `app/admin/sucursales` | Copiar y recortar | Sin horarios de pedidos ni datos de entrega. |
| `components/admin/{MarcoPanel,Formulario,SubnavLealtad}` | Copiar | Sin `SubnavPedidos`. |
| `app/admin/{alergenos,disponibilidad,pedidos,productos,comunicacion}`, `app/admin/analitica` (develop) | **Excluir** o Fase 5 | — |
| `middleware.ts` | Reescribir | Resuelve el negocio por `Host` además de la puerta del panel. |
| `lib/admin/{sesion,lealtad,correos-usuarios}.ts`, `lib/lealtad/*` | Copiar | `qr.ts` arma las URL con `NEXT_PUBLIC_APP_URL`: debe usar el host del negocio. |
| `lib/correo.ts` | Reescribir | Remitente de plataforma con nombre del negocio, `Reply-To`, cabecera y pie por plantilla. |
| `lib/marca.ts` | Reemplazar | Por la configuración de marca del negocio. |
| `lib/wallet/apple/*` | Reescribir | `NOMBRE_ORGANIZACION`, colores, textos, ayuda y `changeMessage` del negocio; credencial desde `wallet_credential`; imágenes generadas (hoy 11 tiras fijas y tope en 10). Ruta del servicio con id de negocio (D9). |
| `lib/wallet/google/*` | Reescribir | Clase por negocio; logo e imagen principal generados; `VERSION_IMAGENES` pasa a hash. |
| `app/api/wallet/apple/v1/*` | Copiar | Con el id de negocio en la ruta. |
| `app/api/cron/lealtad-fotos` | Reescribir | Recorre todos los negocios; prefijo por negocio; Blob privado. |
| `app/api/pos/*`, catálogo, carrito, checkout, sitio público, `lib/{catalog,carrito,pedido,textos,preparacion,pos}` | **Excluir** | — |
| `packages/ui` (680) | No se copia | Ninguna pantalla de lealtad ni del panel importa `@lapana/ui`. Solo se toma `tokens.css` como referencia para los tokens neutros. |
| `apps/admin`, `apps/chatbot`, `services/pos-connector`, `scripts/*`, `datos-lapana/` | **Excluir** | `datos-lapana/` tiene datos del cliente: no se toca. |

## 5. Push en Wallet (solo en `develop`)

| Pieza | Destino propuesto |
| --- | --- |
| Avisos automáticos al acreditar (estampa nueva, premio listo) | Fase 4, con el resto de Wallet |
| Push de campañas (`lib/comunicacion/push.ts`, canal `PUSH`) | Fase 5 |
| Columnas `wallet_message*` y `personal_link_*` | Entran al esquema desde la Fase 1 |

## 6. Esquema nuevo (resumen)

| LAPANA | Loyalty WL |
| --- | --- |
| — | `tenant` (slug, estado, zona horaria, ajustes), `tenant_brand`, `tenant_domain`, `platform_user`, `wallet_credential` |
| `Branch` (pedidos, POS, horarios) | `branch` (se conservó el nombre para portar sin renombrar): nombre, dirección, contacto, `loyalty_enabled`, `loyalty_since` |
| `UserAccount`, `AdminSession`, `AdminPasswordToken`, `LoginAttempt`, `AuditLog` | Igual, con `tenant_id` |
| `LoyaltyCard` | Con `tenant_id`; sin `customer_id` ni `orders_notify_at`; campos de campañas se quedan para la Fase 5 |
| `LoyaltyAccrual`, `LoyaltyReward`, `LoyaltySession`, `LoyaltyCode`, `LoyaltyLoginAttempt`, `LoyaltyAccessRequest`, `LoyaltyProgram` | Con `tenant_id` |
| `WalletDevice`, `WalletRegistration` | Con `tenant_id`; dispositivo único por negocio |
| Enum `LoyaltyRewardKind` (en retirada) | No se trae |
| Vistas `pos_*`, esquema `sr`, tablas de pedidos, catálogo, CMS y campañas | No se traen (campañas: Fase 5) |

Índices parciales que Prisma no declara y van en SQL de migración: una versión activa del programa por negocio; una visita por tarjeta, sucursal y fecha salvo `MIGRACION`; una solicitud de acceso `ABIERTA` por tarjeta. Las políticas RLS y los permisos de `wl_app` también van en SQL.

## 7. Acoplamientos medidos

- **Marca:** 134 líneas con «lapana» en 57 archivos del alcance v1 (sin contar `@lapana/…` ni pruebas).
- **Rubro** (🥖, pan dulce, croissant, boulangerie): 27 líneas. **Lugar** (Xalapa y nombres de sucursal): 17 líneas.
- **Acceso a datos** en `lealtad`, `auth` y `comunicacion`: 204 llamadas `prisma.…` (173 sin comunicación), 44 `tx.…`, 27 SQL directas (8 en `clientes.ts`, que se excluye) y 18 transacciones. Además, 25 llamadas `prisma.…` desde la aplicación web.
- **URL base global:** `NEXT_PUBLIC_APP_URL` en QR, Apple y Google.
- **Estado global en memoria:** caché del programa, de la configuración de Apple y de Google.

## 8. Correcciones al §4 del prompt

1. La copia local iba 7 commits atrás de `develop`. Jano la emparejó el 15 nov: la referencia es `develop@2391356`.
2. El acceso ya no exige contraseña: enlace personal permanente y contraseña opcional (`docs/30`).
3. Con QR, la falta de folio no bloquea la visita (se guarda un folio `SF-…`); solo sin tarjeta es obligatorio. Sin folio real no hay cruce con la compra.
4. No existe lectura de ticket con IA.
5. El script que dibuja las tiras de Wallet no está en el repo.
6. El `serialNumber` del pase ya es el UUID de la tarjeta: no hace falta meterle el negocio.
7. Las fotos de ticket se guardan como Blob **público**.
8. La bitácora «inmutable por permisos» no está aplicada en ninguna migración.
9. `packages/ui` no lo usa el módulo de lealtad; los estilos salen de clases de Tailwind sobre `tokens.css`.
10. Faltaban en la tabla de tamaños ~2 270 líneas: marco del panel, utilidades, correo, cron de fotos y middleware.
11. Los crons existen como dice el prompt; el de fotos borra a los 90 días desde la **fecha de compra** y además limpia fotos huérfanas.
