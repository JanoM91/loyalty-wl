# PROMPT MAESTRO · Loyalty WL (programa de lealtad white label)

> Versión 1.1 · 14 nov 2026 · Redactado por Claude Sonnet 5.5; corregido por Claude Fable 5.2 al cerrar la Fase 0 (ver «Correcciones de la Fase 0» en §4).
> **Estado (15 nov 2026): Fases 0, 1 y 2 entregadas (`docs/03-estado-fases-1-2.md`). La Fase 3 espera el visto bueno explícito de Jano. Lee primero «Correcciones de las Fases 1 y 2» en §4.**

## Cómo usarlo (para Jano)

1. Abre una terminal y arranca Claude Code en la carpeta nueva, dándole lectura al repo de referencia:

   ```bash
   cd "/Users/alejandroortiz/ExKalibur Consulting/LoyaltyProgram-WL"
   claude --add-dir "/Users/alejandroortiz/ExKalibur Consulting/LAPANA Xalapa/lapana-xalapa"
   ```

2. Elige el modelo más potente con `/model`.
3. Primer mensaje: «Lee `PROMPT-MAESTRO.md` completo y ejecuta la Fase 0. No avances a la Fase 1 sin mi aprobación.»

Todo lo que sigue a la línea es el prompt.

---

# 1. Misión

Construye **Loyalty WL**: una plataforma de programas de lealtad *white label* para negocios de Xalapa y la región. Cada negocio («negocio» = *tenant*) tiene su propio programa, con su logotipo, colores, reglas de lealtad, sucursales, personal y clientes, aislados de los demás, sobre una sola instalación.

La referencia es el sistema que ya existe para **LAPANA Boulangerie** (repo `lapana-xalapa`, módulo de lealtad). El objetivo es **paridad funcional con ese módulo de lealtad**, no con todo el repo, convertida en multi-negocio y con la marca configurable.

Trabajas para **Jano** (Exkalibur Consulting). Exkalibur son dos personas: Jano y su hermano Beto, ingeniero de software. Por eso la plataforma tiene que poder operarla una sola persona sin intervención manual por negocio: dar de alta un negocio nuevo no debe requerir tocar código ni infraestructura.

# 2. Cómo trabajar con Jano

- **Español**, y llámalo Jano. Textos de producto en español mexicano.
- Jano tiene conocimientos básicos de programación y razona muy bien el negocio. **No simplifiques el razonamiento empresarial; simplifica la explicación técnica.**
- Cuando le toque a él ejecutar algo, da **una instrucción a la vez**: en qué terminal y carpeta, qué comando, qué resultado esperar y cómo reconocer un fallo. No inventes rutas, credenciales ni resultados.
- **Si puedes ejecutar comandos tú** (comprueba con `pnpm -v` y `node -v`), hazlo y no se los delegues. Si no puedes, dilo y pásaselos de uno en uno.
- **Honestidad ante todo.** Nunca digas que algo compila, pasa pruebas o funciona si no lo ejecutaste. Lo no verificado se declara como no verificado. Un pase de Wallet **no cuenta como funcionando** hasta que Jano lo vea instalado en un teléfono real.
- **No asumas información que Jano no ha dado.** Lo que falte queda como «pendiente»; ofrece una recomendación explícita en lugar de decidir en silencio.
- **Máximo 8 preguntas en toda la Fase 0**, con opciones y tu recomendación. Nada de cuestionarios largos.
- **Cuestiona** las premisas débiles (incluidas las de este prompt) con razones y una alternativa concreta. Nada de elogios automáticos ni promesas de éxito.
- **La documentación le desgasta.** La escribes tú, breve, a partir del trabajo hecho.
- **Autorizaciones.** Este prompt no te autoriza a desplegar a producción, comprar dominios o planes, crear cuentas (Apple, Google, Vercel, Neon, Resend), enviar correos a terceros ni publicar nada. Cada una de esas acciones requiere la aprobación explícita de Jano en el chat. Los pasos que dependen de sus cuentas (certificados de Apple, consola de Google Wallet, DNS) los hace él; tú le das los pasos exactos.

# 3. Reglas de seguridad sobre el repo de referencia

- `lapana-xalapa` es **solo lectura**. Nunca lo modifiques. Según `docs/17` y `docs/22` tiene un piloto con clientes reales (no verifiqué su alcance actual), así que trátalo como producción.
- **No ejecutes comandos de git que escriban en él** (`add`, `commit`, `checkout`, `switch`, `stash`, `fetch`, `pull`, `gc`…). Una sesión anterior dejó un `.git/index.lock` huérfano que bloqueó su trabajo. Para leer historia usa solo `git log`, `git show <rama>:<ruta>`, `git ls-tree`, `git diff` entre ramas ya locales.
- La copia local está en la rama `feature/analitica-clientes` (no en `develop`). Para ver la versión de `develop` de un archivo: `git show develop:<ruta>`.
- **No leas ni copies** `.env.local`, `.claude-transfer/*.bundle` ni nada de `.git/objects`. Usa `.env.example` como guía de variables. **Jamás copies datos de clientes, secretos ni certificados** de LAPANA a este proyecto.
- No reutilices el Pass Type ID `pass.com.lapana-xalapa.lealtad`, el Issuer ID de Google ni ninguna credencial de LAPANA. Loyalty WL tiene las suyas (ver §6.7).
- Código de referencia = punto de partida que **copias y generalizas** en un repo nuevo. No hagas un fork ni refactorices LAPANA en sitio.

# 4. El sistema de referencia, tal como lo encontré

> Inventario hecho por Claude Sonnet 5.5 leyendo `README.md`, `package.json`, `docs/00, 16, 17, 18, 21, 22 (parcial), 27`, el `schema.prisma` (modelos de lealtad, `Branch`, `UserAccount`, `AuditLog`), `domain/loyalty/programa.ts` y `motor.ts` (parcial), `database/src/lealtad/programa.ts`, `auth/roles.ts`, `lib/marca.ts`, `middleware.ts`, `next.config.ts`, `vercel.json`, `.env.example`, `lealtad/layout.tsx`, `tokens.css` y un `grep` de acoplamientos.
> **No leí** el código de las acciones de caja, el de Wallet completo, comunicación, POS, pruebas ni las páginas del panel. **Verifica todo lo de esta sección antes de apoyarte en ello** y corrige este documento si algo no coincide.

## Correcciones de la Fase 0 (mandan sobre el resto de §4 y sobre §6.7 y §6.8)

Verificado contra el código el 14 nov 2026. Detalle en `docs/00-decisiones.md` y `docs/01-brechas.md`.

1. **La referencia de paridad es `develop@2391356` (13 nov 2026)**, la más reciente del repo, ya emparejada en la copia local por Jano (antes iba 7 commits atrás). Al iniciar cada fase, compara `develop` contra ese punto en el alcance de lealtad y repórtale la diferencia. Respecto del inventario original agrega el enlace personal permanente (`/lealtad/mi/<token>`), la contraseña opcional y push en Wallet (`docs/30-lealtad-push-y-enlace-personal.md`).
2. **Con QR, la falta de folio no bloquea la visita**: la caja inventa uno (`SF-…`) y acredita. Solo «sin tarjeta» exige folio o foto. Jano precisó que el QR solo valida la visita y que **el folio es lo que permite cruzar visita y compra** mientras no haya conexión al punto de venta: el folio se pide siempre y hay un ajuste por negocio para hacerlo obligatorio.
3. **No existe lectura de ticket con IA**: solo el valor `IA` en un tipo y una etiqueta de analítica.
4. **Apple (§6.7):** el acuerdo vigente del Apple Developer Program (Anexo 5, sección 1) prohíbe usar el Pass Type ID propio para firmar el pase de un tercero y pide distribuir bajo la propia marca. **Decisión de Jano: cada negocio con su propia cuenta de Apple y Exkalibur como proveedor de servicios.** Las credenciales son un dato por negocio, cifrado; Apple Wallet se activa por negocio cuando su cuenta está lista. Google: un Issuer de Exkalibur con una clase por negocio.
5. El `serialNumber` del pase ya es el UUID de la tarjeta (único entre negocios): no hay que cambiarlo. El servicio web de Apple debe llevar el id del negocio en la ruta.
6. El script que dibuja las tiras de Wallet **no está en el repo**.
7. Las fotos de ticket se guardan como Blob **público**; en WL van a Blob privado.
8. La bitácora «inmutable por permisos» no está aplicada en ninguna migración.
9. `packages/ui` no lo importa el módulo de lealtad ni el panel.
10. A la tabla de §4.3 le faltan ~1 450 líneas del marco del panel (acceso, contraseña, cuenta, sucursales, portada, `components/admin`), ~670 de `lib/admin`, `lib/lealtad` y correo, y ~150 del cron de fotos y el middleware. Total v1 a portar, medido sobre `develop@2391356`: ~20 200 líneas más ~2 800 de pruebas.
11. `/lealtad` tiene además `comprar` (pedidos: fuera), `c` y `baja` (comunicación: Fase 5), y `unete/[sucursal]` (alta desde el cartel QR: entra).
12. Conteos sobre `develop@2391356`: 204 llamadas `prisma.…`, 27 SQL directas, 44 `tx.…` y 18 transacciones en el paquete de datos, **más 25 llamadas `prisma.…` hechas directamente desde `apps/web`**. La zona horaria también está fija en `fechaLocal` (`domain/order/schedule.ts`, del que depende `motor.ts`) y en un `T06:00:00Z` de `operacionesDeHoy`.
13. `main` está 165 commits atrás de `develop`: no es «producción» en la práctica. No sé desde qué rama despliega Vercel.
14. RLS: el rol de la aplicación **no puede ser el dueño** de las tablas, y `$queryRaw` no pasa por la extensión de cliente. Experimento en `docs/experimentos/00-aislamiento/` (24 de 24), pendiente de repetir con el motor nativo de Prisma y contra Neon.

15. Decisiones aprobadas por Jano el 15 nov 2026 (detalle en `docs/00-decisiones.md` §0): nombre «Loyalty WL» y `@wl/*` provisionales; caso de diseño, una cadena de cafeterías con muchas sucursales; reglas por omisión como LAPANA hoy; alta de negocios asistida; un solo proyecto de Vercel (ya contratado por Jano) con Neon Launch y Resend; textos legales por plantilla «revisar con abogado»; las cuentas de Apple Developer y Google Wallet de Exkalibur las crea Jano en la Fase 4.
16. LAPANA adoptó en `docs/31` el estándar E2E de Exkalibur (historias de usuario en `tests/e2e/specs/` y Playwright). Propuesta: usarlo también aquí desde la Fase 2.

## Correcciones de las Fases 1 y 2 (15 nov 2026; mandan sobre §6 y §7 donde difieran)

Estado y evidencia en `docs/03-estado-fases-1-2.md`; aislamiento en `docs/02-aislamiento.md`.

1. **Fases 1 y 2 construidas.** Lo siguiente es la Fase 3. No avances sin la aprobación de Jano.
2. **El negocio va por contexto, no por parámetro** (cambia D5): `conNegocio(negocio, fn)` o el resolutor de la web; `prisma`, `transaccion` y `lote` de `@wl/database` lo llevan. Sin negocio, falla. No uses `prisma.$transaction` ni el cliente `base`.
3. La tabla de sucursales se llama `branch` (no `location`).
4. Folio con QR: se pide siempre y no bloquea (`comprobanteConQr: PEDIDO`, por omisión); un negocio puede exigirlo (`OBLIGATORIO`).
5. **Las fotos siguen en Blob público** (dirección no adivinable, carpeta por negocio). El punto 7 de arriba (Blob privado) quedó pendiente.
6. El rol Dueño administra usuarios. Marketing y Solo lectura no se ofrecen todavía.
7. En el entorno de Claude no se puede descargar el motor de Prisma: allí se usa `WL_PRISMA_WASM=1` (motor WASM + `@prisma/adapter-pg`). Es solo para ese entorno; en la Mac de Jano, CI y Vercel va el motor normal, **aún sin probar**.
8. Pendientes antes de desplegar: `prisma migrate diff` sin diferencias, prueba en Neon con los dos roles, dominio y remitente de correo, revisión legal de las plantillas.

## 4.1 Stack y estructura

Monorepo `pnpm` + `turbo`. Next.js 15.5 · React 19 · Tailwind 4 · TypeScript · Prisma 5.22 · PostgreSQL en Neon · Vercel (hosting, Blob para fotos, cron) · Resend (correo) · `passkit-generator` (Apple Wallet) · API de Google Wallet con JWT RS256 · `qrcode` y `jsqr`. Versiones según `docs/00`: Node 24 y pnpm **9.12.0 exacto** (el CI de LAPANA usa Node 20: decide uno y justifícalo).

La aplicación real vive en `apps/web` (sitio público, PWA de lealtad **y** panel `/admin`). `apps/admin` y `apps/chatbot` son esqueletos casi vacíos.

## 4.2 Qué hace el módulo de lealtad (según `docs/16, 17, 18, 21, 22, 27`)

- **Tarjeta del cliente** (PWA en `/lealtad`): alta web, QR único por tarjeta, estampas, premios, historial, perfil, instalación en pantalla de inicio (manifest dinámico), baja de promociones.
- **Caja** (`/admin/lealtad/caja`): *Registrar visita*, *Entregar premio*, *Registrar visita sin tarjeta* (con comprobante: foto del ticket o folio), alta de cliente en caja, migración de tarjeta física a digital, reenvío de acceso por WhatsApp (`wa.me`) o correo.
- **Programa configurable** (`/admin/lealtad/programa`): versiones inmutables (`loyalty_program`, una activa), posiciones de la tarjeta, premios por posición, modalidad por visita o por importe (tramos), ventana de contingencia. Lo ya ganado conserva el nombre y la versión con que se ganó.
- **Acceso con contraseña** (`docs/22`): correo o celular + contraseña (scrypt), bloqueo por tarjeta e IP en base de datos, enlaces de un solo uso, solicitudes de acceso atendidas desde caja.
- **Apple Wallet** y **Google Wallet**: el pase se actualiza solo cuando cambia la tarjeta.
- **Panel**: tarjetas, pendientes de revisión, sucursales y cartel QR por sucursal, usuarios con roles (`ADMIN`, `DUENO`, `GERENTE`, `SUCURSAL`, `MARKETING`, `LECTOR`), bitácora (`audit_log`), analítica (`/admin/lealtad/analitica`).
- **Comunicación** (`docs/21`): campañas por correo/WhatsApp asistido con **grupo de control** y medición contra la base.
- Reglas del motor (`domain/loyalty/motor.ts`): una acreditación por tarjeta, sucursal y fecha de compra; un ticket se acredita una sola vez; hoy se acredita al momento, ayer o antier queda como contingencia pendiente; premios al pasar por su posición y la tarjeta se reinicia conservando el sobrante.
- Ya hay decisiones de LAPANA incrustadas como reglas fijas (p. ej. comprobante obligatorio sin tarjeta; foto de la tarjeta física desde 5 estampas; máximo `posiciones − 2 − estampas actuales` visitas migradas). En Loyalty WL deben pasar a **ajustes del negocio con valores por omisión**.

## 4.3 Tamaño (líneas de TS/TSX, medidas por mí)

| Ruta en `lapana-xalapa` | Líneas | Destino |
| --- | ---: | --- |
| `packages/domain/src/loyalty` | 1 279 | Copiar y generalizar (es lógica pura con pruebas) |
| `packages/database/src/lealtad` | 4 606 | Reescribir con aislamiento por negocio |
| `packages/database/src/auth` | 1 033 | Copiar y aislar por negocio |
| `apps/web/src/app/lealtad` | 2 605 | Copiar y generalizar |
| `apps/web/src/components/lealtad` | 833 | Copiar y generalizar |
| `apps/web/src/app/admin/lealtad` | 7 643 | Copiar **sin** las pantallas ligadas al POS (`ventas-pos`, `cruce`, `clientes`, compras en la ficha) |
| `apps/web/src/lib/wallet` + `app/api/wallet` | 1 276 + 144 | Reescribir la parte de marca e imágenes (ver §6.6) |
| `apps/web/src/app/admin/usuarios` | 893 | Copiar y aislar |
| Comunicación (`admin/comunicacion` + `lib/comunicacion` + `database/src/comunicacion`) | 1 235 + 257 + 941 | Fase 5 |

Hay 18 archivos `*.test.ts` en `packages/domain/tests` (incluyen los de pedidos y POS, que no se copian) y pruebas de integración en `packages/database/tests` que corren solo en CI contra un Postgres real (`LAPANA_PRUEBAS_BD=1`).

## 4.4 Qué queda fuera (todo lo propio de una panadería con e-commerce y POS)

Catálogo, carrito, checkout, pedidos, productos, alérgenos, disponibilidad, textos del sitio (CMS), páginas públicas de historia/sucursales/blog, `apps/chatbot`, `services/pos-connector`, `scripts/*pos*`, todo lo de **SoftRestaurant** (`packages/domain/src/pos`, `packages/database/src/pos`, `api/pos/*`, `ventas-pos`, `cruce`, `docs/19, 24–26, 29`), el Data Warehouse (`sql/001_analytics_schemas.sql`), `packages/domain` de pedidos/entrega/precios/promociones/segmentación de catálogo, hoja de producción y «Comprar próximamente». Si dudas de si algo entra, pregunta con una recomendación; no lo copies por si acaso.

## 4.5 Acoplamientos a LAPANA que encontré (lista inicial, no exhaustiva)

Medí **140 líneas con la marca «lapana» en 55 archivos** del módulo (sin contar `import '@lapana/…'` ni pruebas). Los puntos importantes:

- **Marca en código:** `apps/web/src/lib/marca.ts` (nombre, frase, redes, razón social, domicilio fiscal, correo de privacidad, WhatsApp, correo de pedidos); `lealtad/layout.tsx` (título, `themeColor`, logo, enlaces legales); `lealtad/manifest.webmanifest/route.ts` (nombre, descripción, cookie `lapana_app`); `lib/correo.ts` y `lib/comunicacion/correo-campana.ts` (remitente, cabecera «LAPANA», pie con «Xalapa, Veracruz»).
- **Wallet:** `NOMBRE_ORGANIZACION`, `description` y `changeMessage` en `wallet/apple/modelo.ts`; `issuerName`, `programName`, `programLogo` y `SUFIJO_CLASE = 'lapana_lealtad_v1'` en `wallet/google/*`; variables `APPLE_PASS_TYPE_ID`, `APPLE_PASS_CERT_BASE64`… y `GOOGLE_WALLET_*` **globales** (un solo negocio por despliegue); **imágenes estáticas** en `apps/web/public/wallet/{apple,google}/strip_0…strip_10` generadas con un script de dibujo a partir de `public/marca/*.svg`, con íconos de croissant y corona.
- **Dominio puro con marca o rubro dentro:** `programa.ts` (catálogo `PREMIOS` de pan dulce, `PROGRAMA_V1` y `V2`), `acceso.ts` (`esVarianteDeLapana`: lista negra de contraseñas con «lapana»), `reenvio.ts` y mensajes de acceso (texto con «LAPANA» y 🥖).
- **Cookies y prefijos:** `lapana_admin`, `lapana_app`; código público de tarjeta `LP-XXXX-XXXX`.
- **Tema visual:** `packages/ui/src/tokens.css` con variables `--lp-*` (paleta de pan, fuentes Fraunces e Inter). Los colores y la tipografía están fijos en CSS.
- **Páginas legales:** `lealtad/terminos` nombra las tres sucursales de LAPANA; existe `app/aviso-de-privacidad` y `MARCA.legal` está pensado para alimentarlo (no verifiqué que la página lo use).
- **Un solo negocio en la base:** no existe `tenant_id`. `phone`, `email` y `public_code` de `loyalty_card`, `ticket_key` de `loyalty_accrual` y `email` de `user_account` son **únicos globales**. `Branch` mezcla sucursal con pedidos a domicilio, `posCode` de SoftRestaurant y horarios.
- **Zona horaria «Xalapa» fija** (`'America/Mexico_City'`) dentro del SQL de `analitica.ts` y `clientes.ts`.
- **Superficie a aislar por negocio:** al menos ~190 llamadas `prisma.<modelo>.<op>` en `lealtad`, `auth` y `comunicacion` (solo conté las que empiezan con `prisma.`; las hechas con `tx.` dentro de transacciones no las conté, así que son más), y ~26 consultas SQL directas (`$queryRaw` / `$executeRaw`) en esos mismos módulos (8 de ellas, en `clientes.ts`, atadas a tablas del POS). Además, índices **parciales** definidos en migraciones SQL (por ejemplo, «una visita por tarjeta, sucursal y fecha» excluye las visitas migradas) que Prisma no puede declarar.
- **Crons:** `vercel.json` programa `/api/cron/lealtad-fotos` (según `docs/17`, las fotos de ticket se borran a los 90 días; no leí el código del cron) y `/api/cron/comunicacion`; en WL deben recorrer todos los negocios.

# 5. Alcance

## v1 (lo que debe existir para vender a un primer negocio)
1. Paridad con el módulo de lealtad de LAPANA (§4.2) **excepto** comunicación y todo lo ligado al POS.
2. Multi-negocio con aislamiento demostrado por pruebas.
3. Marca configurable por negocio: nombre, frase, logotipos (claro/oscuro/isotipo), colores, textos legales, redes y contacto.
4. Reglas configurables por negocio: programa (posiciones, premios, modalidad), reglas de acreditación y de comprobante, zona horaria, prefijo del código de tarjeta.
5. Apple Wallet y Google Wallet con marca del negocio, sin generar imágenes a mano.
6. Panel de **plataforma** (para Exkalibur) con alta asistida de un negocio nuevo en minutos.
7. Manual digital breve generado por negocio (dueño y cajero), porque el éxito del cliente depende de que su personal use la caja sin ayuda.

## Después de v1
Comunicación y campañas con grupo de control (Fase 5), dominios propios por negocio, conectores opcionales de POS (SoftRestaurant como *plugin*, no como parte del núcleo), facturación y planes, notificaciones push web, WhatsApp automático (requiere cuenta de Meta; hoy es asistido con `wa.me`), idioma distinto del español, alta autoservicio.

## Fuera de alcance
E-commerce, pedidos, catálogo, CMS de sitio, chatbot, y cualquier asesoría legal (Jano ha expresado por ahora una exclusión de temas legales; su alcance exacto sigue pendiente, ver §6.9).

# 6. Decisiones de arquitectura (recomendaciones: Jano las aprueba o cambia en la Fase 0)

## 6.1 Repo nuevo, copiar y generalizar
Repo nuevo en `LoyaltyProgram-WL`, mismo stack, estructura de monorepo parecida pero propia (scope de paquetes propio, no `@lapana/*`; nombre comercial pendiente, usa `@wl/*` como provisional). **Razón:** según su documentación, LAPANA tiene un piloto con datos reales de clientes (LFPDPPP); volver multi-negocio *esa* base es el riesgo más caro del proyecto. Más adelante LAPANA puede migrar como negocio #1, y eso es una decisión aparte. Descarta el fork y el refactor en sitio.

## 6.2 Multi-negocio: base compartida con `tenant_id`
- Todas las tablas de negocio llevan `tenant_id NOT NULL`. Las únicas tablas sin él son las de plataforma (negocios, dominios, administradores de plataforma).
- **Unicidad por negocio:** `(tenant_id, phone)`, `(tenant_id, email)`, `(tenant_id, public_code)`, `(tenant_id, ticket_key)`, `(tenant_id, email)` en usuarios. Una misma persona puede tener una tarjeta en dos negocios sin que se vean entre sí.
- **Doble defensa:** (a) capa de acceso a datos que inyecta el `tenant_id` de forma obligatoria (extensión de cliente Prisma; que **no se pueda** consultar sin tenant), y (b) **Row Level Security** en Postgres como respaldo. Para (b) verifica con un experimento corto: `SET LOCAL app.tenant_id` dentro de transacción con el pooler de Neon, que la conexión de la aplicación **no** sea la dueña de las tablas (o usa `FORCE ROW LEVEL SECURITY`; el dueño omite RLS si no), y mide el costo en latencia en serverless. Si RLS es inviable en Prisma 5.22 + Neon, decide con datos y deja la razón por escrito.
- **El SQL directo** (los ~26 `$queryRaw`) se parametriza por tenant y por zona horaria; las pruebas deben cubrirlo.
- **Puerta de calidad obligatoria:** pruebas automáticas de *fuga entre negocios* (con dos negocios sembrados, ninguna consulta ni acción del cliente, caja o panel devuelve ni modifica datos del otro). Sin esas pruebas en verde no se pasa de la Fase 1.
- Descartada, pero revisable: una base por negocio (más aislamiento, pero migraciones y conexiones por negocio son una carga operativa grande para dos personas).

## 6.3 Cómo se identifica el negocio
Subdominio por negocio (`{slug}.<dominio-de-plataforma>`) que resuelve el tenant desde `Host` en el middleware; el panel del negocio vive en el mismo host bajo `/admin`, como en LAPANA. Panel de plataforma de Exkalibur en el dominio raíz, bajo una ruta propia. Dominios propios por negocio, después. Verifica en la documentación vigente de Vercel cómo se configuran los dominios comodín (`*.dominio`) y qué plan exigen.

## 6.4 Autenticación y roles
- `user_account` por negocio (correo único dentro del negocio). Rol nuevo `PLATAFORMA` (Exkalibur) sin `tenant_id`.
- Conserva scrypt, sesiones con hash en base de datos, bloqueo por tarjeta e IP en base de datos, enlaces de un solo uso y el confinamiento de `SUCURSAL` a la caja.
- Cookies sin marca: `wl_admin`, `wl_card`, `wl_app` (con prefijo `__Host-` si es viable). Quítale a `acceso.ts` la lista negra «lapana»; pásala a una regla que tome el nombre del negocio.
- **No** construyas suplantación de identidad (*impersonate*) en v1. El dueño se invita con enlace de un solo uso, reutilizando el flujo de `admin_password_token`.

## 6.5 Marca configurable
- Configuración de marca por negocio (tabla o JSON validado con Zod): nombre, frase, logos, paleta, fuente de una lista corta, textos legales, redes, contacto.
- **Tema en tiempo de ejecución**: variables CSS inyectadas en el `<html>` desde la configuración, no una reconstrucción de Tailwind por negocio. Sustituye `--lp-*` por tokens neutrales de plataforma.
- **Guardas de accesibilidad:** calcula el contraste WCAG de cada combinación elegida y rechaza o corrige las que no lleguen a 4.5:1 para texto normal. LAPANA ya aplica esta regla en `tokens.css` (el acento decora y no es color de acción; sus comentarios remiten a `docs/07`, que no leí).
- Todo texto con nombre del negocio, rubro o emoji (🥖, «pan dulce») sale del dominio y pasa a **plantillas con variables**. Los premios dejan de tener un catálogo fijo: solo existen los que define el programa del negocio, con un respaldo genérico.

## 6.6 Wallet con imágenes dinámicas
- Las tiras (`strip_N`: Apple 375×144 pt en 1x/2x/3x; Google 1032×336), el logo (Google 660×660) y el ícono de Apple se **generan** a partir de la marca y del número de posiciones con `sharp` (ya está en el árbol de dependencias de Next) o equivalente, y se **cachean en Vercel Blob** con una clave que incluya un hash de (marca, posiciones, estampas). Se regeneran al cambiar la marca o el programa. LAPANA solo tiene imágenes de 0 a 10 estampas: en WL el número de posiciones es variable (el dominio admite 1–30).
- Google cachea imágenes por URL: versiona la URL (en LAPANA, `VERSION_IMAGENES`).
- Los íconos de premio son de rubro (croissant, corona): ofrece un juego neutro de íconos configurable.

## 6.7 Credenciales de Wallet a nivel plataforma (recomendación, **a verificar**)
- **Apple:** un solo Pass Type ID y un solo certificado de Exkalibur; la marca de cada negocio va en cada pase (`organizationName`, colores, logo). Ventaja: una sola renovación anual del certificado en vez de una por negocio. El `serialNumber` debe ser único por Pass Type ID: usa un identificador que incluya el negocio. El `webServiceURL` puede apuntar a un host central de plataforma.
- **Google:** un solo Issuer ID de Exkalibur y **una clase (`loyaltyClass`) por negocio** (`classId` con el slug del negocio y versión).
- **Verifica en la documentación oficial vigente de Apple y Google** (WebFetch) que emitir pases de varios negocios bajo la cuenta de Exkalibur está permitido por sus términos, y qué requiere la aprobación de «publishing access» de Google. Si no lo está, la alternativa son credenciales por negocio guardadas cifradas; dilo antes de construirlo.
- Pregunta a Jano de quién es la cuenta de Apple Developer usada en LAPANA y si Exkalibur tiene una propia. No reutilices las credenciales de LAPANA.

## 6.8 Reglas de acreditación y comprobante configurables
Hoy la regla es «una visita por tarjeta, sucursal y día, operada por personal de caja, con ticket». Muchos negocios pequeños no tienen folio de ticket. Diseña modos de comprobante por negocio (ninguno con límite diario, folio opcional, folio obligatorio, foto) **sin debilitar el valor por omisión antifraude**: que la acreditación siga siendo hecha por personal autenticado, con límite por día y sucursal. No verifiqué si existe lectura de ticket con IA (la columna `capture_source` admite `IA`); averígualo.

## 6.9 Datos personales y temas legales
Cada negocio es el **responsable** de los datos de sus clientes y Exkalibur es **encargado** (LFPDPPP). Jano ha expresado por ahora una exclusión de los temas legales (el alcance exacto de esa exclusión está pendiente: confírmalo en la Fase 0), así que, mientras tanto: (a) genera **plantillas** de términos y aviso de privacidad con los datos de cada negocio, marcadas como *«revisar con abogado»*, nunca como definitivas; (b) da soporte técnico a derechos ARCO (exportar y borrar los datos de un cliente o de un negocio completo, con retención configurable y bitácora); (c) deja a Jano una lista corta de lo que necesita resolver con un abogado (contrato de servicio, cláusulas de encargado). No des asesoría legal.

## 6.10 Correo y almacenamiento
Resend con remitente de plataforma y **nombre visible del negocio**, `Reply-To` del negocio; dominio de remitente propio por negocio, después. Vercel Blob con prefijo por negocio. Los crons recorren todos los negocios activos y respetan su zona horaria.

## 6.11 Costos y términos que debes verificar antes de proponer un plan de infraestructura
LAPANA se diseñó para 0–25 USD al mes en capas gratuitas. **Un SaaS que cobra a terceros puede no caber en esas capas** (revisa en las páginas vigentes los términos de uso comercial y límites de Vercel, Neon, Resend y Blob). Entrega a Jano una tabla breve de costo mensual por cantidad de negocios (por ejemplo 1, 10 y 50) con las fuentes citadas. No inventes cifras.

# 7. Plan por fases

Cada fase termina con: lint, typecheck, pruebas y build en verde (o lo que no pudiste ejecutar, dicho claramente); documentación breve actualizada; y un resumen para Jano de **máximo 10 líneas** con lo hecho, lo no verificado y las decisiones que necesitas de él. **No pases a la siguiente fase sin su visto bueno.**

## Fase 0 · Verificación y decisiones (sin escribir código de producto)
- Lee, en este orden, en `lapana-xalapa`: `README.md`, `docs/00`, `17`, `22`, `16`, `18`, `21`, `03` (arquitectura), `04` (modelo de datos); `schema.prisma` completo; `packages/domain/src/loyalty/*`; `packages/database/src/lealtad/*` y `auth/*`; `apps/web/src/app/lealtad` y `admin/lealtad` (estructura y acciones de caja); `lib/wallet/*`.
- **Corrige el inventario de §4** con lo que encuentres.
- Haz el **experimento corto de aislamiento** de §6.2 (Prisma 5.22 + Postgres: extensión de cliente y RLS) y reporta resultados.
- Verifica las dudas de §6.3, §6.7 y §6.11 con documentación oficial vigente.
- **Entregables:** `docs/00-decisiones.md` (decisiones y razones, una línea por alternativa descartada), `docs/01-brechas.md` (qué se copia, qué se reescribe, qué se excluye, con rutas) y un mensaje a Jano con **hasta 8 preguntas**, cada una con opciones y recomendación. Sugeridas:
  1. Nombre comercial provisional del producto y dominio de plataforma.
  2. Primer negocio piloto de Loyalty WL (¿la cadena de cafeterías con 20 o más sucursales en Veracruz que Jano ha mencionado como prospecto? ¿otro? ¿LAPANA como negocio #1 más adelante?). Úsalo como caso de diseño: una cadena así exige muchas sucursales por negocio y navegación ágil entre ellas.
  3. Cuenta de Apple Developer y de Google Wallet que se usará.
  4. Valores por omisión de acreditación y comprobante (§6.8).
  5. Alta asistida (Jano crea cada negocio) o autoservicio en v1. Recomendación: asistida.
  6. Plan de hosting aceptable (§6.11).
  7. Quién redacta los textos legales de cada negocio (§6.9).
  8. Si hay un segundo negocio de ejemplo para la demo (rubro y colores).

## Fase 1 · Cimientos multi-negocio
- Repo nuevo con la estructura, configuración (`eslint`, `prettier`, `tsconfig`, `turbo`, CI) y **las convenciones de §8**.
- Copia `domain` de lealtad (con sus pruebas) y generalízalo: sin catálogo de premios fijo, sin «lapana», con textos por plantilla. Mantén la regla de que `domain` no importa frameworks (lo hace cumplir ESLint).
- Esquema Prisma nuevo (`tenant`, marca, `location` en lugar de `Branch` sin pedidos ni POS, `user_account`, sesiones, bitácora, tablas de lealtad y de Wallet) con migraciones, incluidos los índices parciales.
- Resolución de negocio por `Host`, capa de acceso con `tenant_id` obligatorio y RLS según el experimento.
- Siembra de **dos negocios de demostración** con marca y programa distintos.
- **Criterio de salida:** las pruebas de fuga entre negocios pasan, y lo demás del CI también.

## Fase 2 · Núcleo de lealtad (paridad)
Portar, por orden: alta web, tarjeta y QR; caja (visita, premio, sin tarjeta, alta en caja, migración física); acceso con contraseña y recuperación; programa configurable con versiones; panel (tarjetas, pendientes, sucursales con cartel QR, usuarios, cuenta, bitácora); analítica sin POS. Cada pieza llega con sus pruebas y sin ninguna cadena de LAPANA.
**Criterio de salida:** recorrido completo (alta → visita → premio → canje) en cada uno de los dos negocios de demo, con evidencia de las pruebas ejecutadas y una lista honesta de lo que solo se probó a mano.

## Fase 3 · Marca white label y alta de negocios
- Tema en tiempo de ejecución, manifest PWA e íconos por negocio, correos y mensajes de WhatsApp con plantillas, términos y privacidad por plantilla, cartel QR con la marca.
- **Panel de plataforma:** crear negocio → marca → programa (con plantillas de arranque, como «premio cada N visitas» o «por importe») → sucursales → invitar al dueño → publicar. Suspender y reactivar negocios.
- Manual digital breve para dueño y cajero, generado por negocio.
- **Criterio de salida:** un tercer negocio, dado de alta **solo desde el panel y sin tocar código**, queda operando en menos de 30 minutos (mide y reporta el tiempo real).

## Fase 4 · Wallet multi-negocio
Generación dinámica de imágenes y cache, pases de Apple y Google con la marca de cada negocio, servicio web de Apple central, avisos de actualización, renovación documentada del certificado.
**Criterio de salida:** pase instalado y actualizándose en un iPhone y un Android reales **de Jano**. Hasta entonces, esta fase figura como «no verificada en dispositivo». Dale los pasos de certificados y consolas de uno en uno.

## Fase 5 · Comunicación y campañas (después del primer cliente)
Portar `docs/21`: audiencias, grupo de control, medición, baja en cada correo, webhook de Resend. Aislado por negocio.

## Fase 6 · Operación
Despliegue (con la aprobación de Jano), dominio comodín, respaldos y restauración probada, monitoreo, límites por negocio, tabla de costos (§6.11), exportación y borrado por negocio (§6.9), guía de incidentes de una página.

# 8. Convenciones de ingeniería (heredadas de LAPANA; consérvalas salvo que justifiques lo contrario)

- TypeScript estricto. **Dinero en centavos** (enteros); nunca `float`.
- `domain` puro: sin Next, React ni Prisma, y con cobertura mínima de 90 % que bloquea el merge.
- Migraciones compatibles hacia atrás (expandir → migrar → contraer).
- Commits en español con Conventional Commits (`feat(caja): …`). Ramas `feature/`, `fix/`, `chore/`, `docs/` desde `develop`.
- Textos en español mexicano, incluidos los mensajes de error. Nunca menos de 16 px en cuerpo de texto; el color nunca comunica solo.
- **Trampas que LAPANA ya pagó** (verifica si aplican a tu entorno): imports sin extensión `.js`; Tailwind no lee paquetes dentro de `node_modules` (hace falta `@source` hacia `packages/ui`); carpetas `src/` vacías rompen `tsc`; `next-env.d.ts` no se versiona; Prettier en la raíz; ESLint se ejecuta desde la raíz; `vitest` declarado en cada paquete que tenga pruebas; `turbo` con interfaz `"stream"`.
- Seguridad: ningún secreto en el repo; `.env.example` completo y sin valores reales; no registres datos personales en logs; respuestas idénticas ante «existe / no existe» en recuperación de acceso (así lo hace LAPANA); límites de intentos en base de datos, no en memoria.
- Pruebas de integración contra un Postgres real en CI. En una computadora de desarrollo, `DATABASE_URL` **no debe** apuntar a datos reales.

# 9. Cómo debes proceder

1. Crea una lista de tareas y mantenla al día. Trabaja en pasos pequeños y comitea seguido.
2. Puedes usar subagentes para **exploración paralela de solo lectura** (por ejemplo, auditar acoplamientos módulo por módulo). Para escribir código en paralelo, usa ramas o *worktrees* separados y integra solo con las pruebas en verde.
3. Antes de afirmar un resultado, ejecútalo. Si no puedes, dilo.
4. Si algo de este prompt contradice lo que ves en el código, **manda el código**: corrige el prompt y avisa a Jano.
5. Cuando haya una decisión que cambie dinero, plazos, alcance o la relación con clientes, **detente y pregúntale**, con opciones y tu recomendación.

# 10. Qué no sé (no lo rellenes con suposiciones)

- Nombre comercial del producto y dominio de plataforma.
- Si existe una cuenta de Apple Developer / Google Wallet de Exkalibur, y de quién es la de LAPANA.
- Primer cliente real de Loyalty WL, precio y modelo de cobro (fuera de alcance de v1).
- Capacidad y disponibilidad de Beto para operar o mantener la plataforma.
- Qué parte del piloto de LAPANA está hoy en producción y cuántos clientes reales tiene.
- Planes de Vercel, Neon y Resend que Jano tiene contratados.
- Si los isotipos y marca de Exkalibur (el isotipo «Escalón») deben aparecer en el panel de plataforma; pregúntale y pídele el archivo.

# 11. Tu primera respuesta

Empieza la Fase 0. Tu primer mensaje a Jano debe decirle, en pocas líneas, qué vas a leer y en qué orden. El entregable de la Fase 0 es el de §7; **no escribas código de producto antes de que él lo apruebe**.
