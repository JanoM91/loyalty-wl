# 00 · Decisiones de la Fase 0

> 14 nov 2026 · Redactado por Claude (Fable 5.2) al cerrar la Fase 0.
> Actualizado el 15 nov 2026 con las respuestas de Jano (§0) y una segunda revisión de tamaños contra la copia ya emparejada.
> **Estado: decisiones de §0 aprobadas por Jano. El arranque de la Fase 1 espera su visto bueno explícito.**
> Referencia: `lapana-xalapa`, rama `develop` en `2391356` (13 nov 2026), igual a `origin/develop` en la copia local.

## 0. Respuestas de Jano (15 nov 2026)

| Tema | Decisión de Jano | Consecuencia |
| --- | --- | --- |
| Referencia | La versión más reciente del repo. | Hoy es `develop@2391356`. Al iniciar cada fase se compara `develop` contra ese punto en el alcance de lealtad y se le reporta la diferencia. |
| Apple Wallet | **Opción A:** cada negocio con su cuenta de Apple; Exkalibur como proveedor de servicios. | Credencial por negocio, cifrada (D10). Apple Wallet se activa por negocio cuando su cuenta está lista; el alta «en 30 minutos» no lo incluye. Un negocio opera desde el día uno con tarjeta web y Google Wallet. |
| Google Wallet | Proceder como indica Google. | Un Issuer de Exkalibur (agregador) con una clase por negocio (D11). |
| Cuentas | Hay que crearlas. | Las crea Jano en la Fase 4 con pasos de uno en uno: Apple Developer de Exkalibur (para los negocios de demostración y las pruebas, bajo su propia marca) y la consola de Google Wallet. |
| Nombre y dominio | «Loyalty WL» y `@wl/*` provisionales; dominio antes de desplegar. | — |
| Caso de diseño | Cadena de cafeterías con muchas sucursales. | Muchas sucursales por negocio, navegación ágil entre ellas y cuentas de caja por sucursal. |
| Reglas por omisión | Como LAPANA hoy. | Una visita por tarjeta, sucursal y día. El folio se pide siempre y no bloquea con QR; sin tarjeta, folio o foto son obligatorios. |
| Folio del ticket | El QR solo valida la visita; **el folio es lo que permite cruzar visita y compra** mientras el programa no esté conectado al punto de venta. | El folio, la caja y el importe se conservan como datos de primera clase. Ajuste por negocio: folio *pedido* (omisión) u *obligatorio*. **Por confirmar:** si la omisión debe ser *obligatorio*. |
| Hosting | Jano ya paga Vercel. Acepta Vercel + Neon Launch + Resend. | Vercel no agrega costo fijo (§5). |
| Arquitectura | Un mismo proyecto aloja muchos programas de lealtad. | Confirma D3 y D8: un proyecto de Vercel, una base, un negocio por subdominio. |
| Legal | Plantillas «revisar con abogado»; cada negocio responsable de las suyas; Jano lleva §7 a un abogado. | — |

## 1. Qué se verificó y qué no

| Tema | Estado |
| --- | --- |
| Lectura de docs 00, 16, 17, 18, 21, 22, 27, 30; `schema.prisma` (modelos de lealtad, auth, sucursal, campañas); migraciones (índices y restricciones); todo `domain/loyalty`; `database/src/lealtad/caja.ts`, `programa.ts`, `tarjetas.ts` (alta), `alta-caja.ts` (migración); `auth/roles.ts`; middleware, sesiones, acciones de caja, `lib/wallet` (Apple y Google), cron de fotos, manifest, layout, correo, marca | Leído |
| `acceso.ts`, `verificacion.ts`, `reenvio.ts`, `reportes.ts`, `analitica.ts`, `wallet.ts`, `auth/usuarios.ts`, `auth/sesion.ts` | Leídos por firmas y búsquedas, no línea por línea |
| Pantallas (`Caja.tsx`, `NuevoCliente.tsx`, panel), `docs/03` y `04` (solo índice: describen el e-commerce) | No leídos a fondo |
| Pruebas de LAPANA | **No ejecutadas** (el entorno no tiene `pnpm` ni puede bajar los motores de Prisma) |
| Experimento de aislamiento | Ejecutado: 24 de 24 comprobaciones pasan (§3) |
| Vercel, Neon, Resend, Blob, Google Wallet, Apple | Consultados en sus páginas oficiales el 14 nov 2026 (§5 y §6) |
| Neon con su pooler, latencia real en Vercel, pases en teléfono | **No verificado** |

## 2. Decisiones propuestas

> **Actualización 15 nov 2026 (Fases 1 y 2):** D5 se implementó con contexto (`AsyncLocalStorage` + resolutor) en vez de un `db` por parámetro, para portar el código de LAPANA sin cambiar firmas. Sigue fallando cerrado y RLS es la barrera real. Detalle y límites en `02-aislamiento.md`.

| # | Decisión | Razón | Descartado |
| --- | --- | --- | --- |
| D1 | Repo nuevo en `LoyaltyProgram-WL`; copiar y generalizar. | LAPANA está en producción con clientes reales y sigue cambiando (`develop` avanzó 7 commits en 3 días, varios de lealtad). | Fork: arrastra POS, pedidos y catálogo. Refactor en sitio: pone en riesgo datos reales. |
| D2 | Referencia en `develop@2391356` (**aprobado**: la más reciente del repo), con revisión de diferencias al iniciar cada fase. | Incluye el enlace personal permanente, la contraseña opcional y el push en Wallet (`docs/30`), y el blindaje de `docs/31`. | Seguir a `develop` commit por commit: objetivo móvil dentro de una fase. |
| D3 | Base compartida con `tenant_id NOT NULL` en todas las tablas de negocio. | Dos personas operan la plataforma; una migración para todos. | Base o proyecto de Neon por negocio: migraciones y conexiones por negocio. Esquema por negocio: Prisma no lo maneja bien. |
| D4 | **Dos roles de Postgres**: `wl_owner` (dueño; solo migraciones) y `wl_app` (la aplicación; sin `BYPASSRLS`). RLS en cada tabla de negocio. | Comprobado: el dueño se salta RLS; la app no puede ser el dueño (§3, pruebas 13–14). | Un solo rol con `FORCE ROW LEVEL SECURITY`: funciona, pero un error de migración deja la app sin defensa. |
| D5 | Acceso a datos por un objeto `db` **ligado a un negocio** que cada función recibe como parámetro: abre una transacción, fija `app.tenant_id` con `set_config(…, true)` e inyecta `tenantId` en cada operación. Sin `prisma` global exportado. | Hoy las ~190 llamadas usan un `prisma` global y funciones sin contexto (`programaVigente()`, `listarTarjetas()`). Si el parámetro es obligatorio, olvidarlo es un error de tipos y no una fuga. | `AsyncLocalStorage`: menos cambios, pero un olvido falla en ejecución, no al compilar. |
| D6 | RLS es **la defensa única** del SQL directo (26 consultas), no un respaldo. | Comprobado: `$queryRaw` no pasa por la extensión de cliente (prueba 23). Además cada consulta llevará su filtro explícito. | Confiar solo en la extensión. |
| D7 | Unicidad por negocio: `(tenant_id, phone)`, `(tenant_id, email)`, `(tenant_id, public_code)`, `(tenant_id, ticket_key)`, `(tenant_id, version)` del programa, `(tenant_id, slug)` de sucursal, `(tenant_id, email)` de usuario. Índices parciales con `tenant_id`: una versión activa por negocio, una visita por tarjeta, sucursal y día, una solicitud de acceso abierta por tarjeta. Los hashes de tokens siguen siendo únicos globales (son aleatorios). | Comprobado (pruebas 15–16). | Unicidad global: impediría que una persona tenga tarjeta en dos negocios. |
| D8 | El negocio se resuelve por `Host` (`{slug}.<dominio>`); panel del negocio en el mismo host bajo `/admin`; panel de plataforma en el dominio raíz. Las URL absolutas (QR, correos, pases) salen del negocio, no de `NEXT_PUBLIC_APP_URL`. | Vercel admite dominios comodín en todos los planes (§5). | Ruta `/n/{slug}`: mezcla cookies de todos los negocios en un host. |
| D9 | El servicio web de Apple Wallet lleva el **id del negocio en la ruta** (`/api/wallet/apple/{tenantId}/v1/…`) sobre el host de plataforma. | El pase guarda su `webServiceURL`; si dependiera del subdominio, cambiar el slug rompería los pases instalados. El `serialNumber` ya es el UUID de la tarjeta, único entre negocios: no hay que cambiarlo. | Host del negocio en el pase. |
| D10 | Credenciales de Wallet como **entidad** (`wallet_credential`, cifradas) asignable a la plataforma o a un negocio. **Aprobado: cada negocio usa la suya (opción A).** La de plataforma queda para los negocios de demostración de Exkalibur. | El acuerdo de Apple restringe firmar pases de terceros con un Pass Type ID propio (§6). Construirlo así desde el inicio cuesta poco; cambiarlo con pases instalados es caro. | Variables de entorno globales como en LAPANA. |
| D11 | Google Wallet: un Issuer de Exkalibur y una clase por negocio (`{issuer}.{tenantId}_v1`). | Google contempla agregadores que emiten por cuenta de otros (§6). | Un Issuer por negocio. |
| D12 | Fotos de ticket y de tarjeta física en **Blob privado** con prefijo por negocio; se sirven por una ruta autenticada. | LAPANA las sube con `access: 'public'`: cualquiera con la URL las ve. Blob privado ya existe en todos los planes (§5). | Blob público con URL difícil de adivinar. |
| D13 | Zona horaria del negocio como dato (`tenant.timezone`), pasada al dominio y al SQL. | Está fija en al menos 11 líneas de SQL, en `fechaLocal` y en un `T06:00:00Z` de `operacionesDeHoy`. | Variable de entorno global. |
| D14 | Reglas hoy fijas pasan a ajustes del negocio con el valor de LAPANA por omisión: comprobante con QR y sin tarjeta, umbral de evidencia (5), tope de migración (`posiciones − 2`), vigencias de enlaces, prefijo del código, días de conservación de fotos (90). | Pedido en §4.2 y §6.8 del prompt. | Dejarlas en código. |
| D15 | Tiras de Wallet e íconos generados con `sharp` y guardados en Blob (público: no llevan datos personales) con hash de marca, posiciones y estampas. | LAPANA tiene 11 imágenes fijas y el script que las dibujó **no está en el repo**. | Imágenes por negocio hechas a mano. |
| D16 | Alta de negocios **asistida** en v1 (la crea Exkalibur desde el panel de plataforma). | Recomendación del prompt; sin objeción. Se asume salvo que Jano diga otra cosa. | Autoservicio: exige cobro, verificación y soporte. |
| D17 | Node 22 LTS en CI y en Vercel. | LAPANA declara Node 24 en `docs/00` y usa 20 en CI: se elige una sola versión con soporte largo. **No verifiqué** qué versiones ofrece hoy Vercel. | Mantener la discrepancia. |
| D19 | Adoptar el estándar de Exkalibur que LAPANA estrenó en `docs/31`: historias de usuario en `tests/e2e/specs/` y recorrido E2E con Playwright, además de las pruebas de fuga. **Propuesta.** | Es el criterio de salida de la Fase 2 (alta → visita → premio → canje) hecho repetible. | Solo pruebas unitarias y de integración. |
| D18 | Bitácora inmutable de verdad: `wl_app` solo con `INSERT` y `SELECT` sobre `audit_log`. | El esquema de LAPANA dice que los permisos impiden `UPDATE` y `DELETE`, pero ninguna migración lo aplica. | Solo por convención. |

## 3. Experimento de aislamiento

Postgres 16.15 local, Prisma Client 5.22.0. Dos negocios con 2 000 tarjetas cada uno. Código en `docs/experimentos/00-aislamiento/`.

**Limitación:** no se pudieron descargar los motores nativos de Prisma (`binaries.prisma.sh` bloqueado), así que el cliente corrió con el motor WASM y el adaptador `pg`. La API de extensiones y de transacciones es la misma, pero **falta repetirlo en la Fase 1 con el motor nativo y contra Neon**.

| Qué se comprobó | Resultado |
| --- | --- |
| Sin negocio fijado, el rol de la app no ve ni inserta nada | Pasa (1, 9) |
| Con el negocio A: no lee, actualiza, borra ni inserta filas de B | Pasa (2–6) |
| `$queryRaw` y `SELECT … FOR UPDATE` dentro de la transacción quedan filtrados | Pasa (7, 8) |
| El ajuste no sobrevive a la transacción, ni con una sola conexión compartida ni tras un rollback | Pasa (10–12) |
| El rol dueño se salta RLS; con `FORCE` queda filtrado | Pasa (13, 14) |
| Mismo celular en dos negocios sí; dos veces en el mismo, no | Pasa (15, 16) |
| Extensión de cliente sola: filtra `count`, `findUnique`, `update`, `updateMany`, `create` y transacciones interactivas | Pasa (17–22, 24) |
| Extensión de cliente sola: `$queryRaw` **no** queda filtrado | Confirmado (23): por eso D6 |

Latencia local, sin red (400 repeticiones): consulta directa p50 1.16 ms; transacción interactiva con `set_config` p50 4.99 ms; transacción por lote p50 3.01 ms (varía poco entre corridas). Lo que mide es que cada transacción agrega de 2 a 3 viajes a la base. En Neon cada viaje cuesta más: **no medido**. Mitigación: una sola transacción por petición o acción, no una por consulta (las escrituras de LAPANA ya van en 18 transacciones).

## 4. Hallazgos que cambian el plan

1. **La referencia se movió.** `develop` tiene desde el 11 nov el enlace personal permanente sin contraseña, la contraseña opcional y push en Wallet. Resuelto: ver §0 y D2.
2. **Apple.** La recomendación de §6.7 del prompt (un Pass Type ID de Exkalibur para todos) choca con el texto del acuerdo. Resuelto: opción A (§0).
3. **Con QR, la falta de folio no bloquea la visita.** El prompt decía «con ticket»; en el código, si la caja no captura folio se inventa uno (`SF-…`) y la visita se acredita. Solo sin tarjeta se exige folio o foto. Esas visitas sin folio real **no se pueden cruzar con la compra**; por eso el ajuste *folio obligatorio* (§0).
4. **La lectura de ticket con IA no existe.** Solo está el valor `IA` en un tipo y una etiqueta en analítica; ninguna acción lo usa.
5. **`main` no es producción en la práctica**: está 165 commits atrás de `develop` (3 ago). No sé desde qué rama despliega Vercel.
6. **Tamaño real a portar (segunda revisión, 15 nov, sobre `develop@2391356`):** cerca de **20 200 líneas** más ~2 800 de pruebas. La primera cuenta (19 500) se hizo sobre la copia atrasada y metía 192 líneas de pruebas de Wallet como código. Incluye piezas que el prompt no listó: marco del panel (~1 450), utilidades y correo (~670), cron de fotos y middleware (~150). Comunicación (Fase 5) son ~3 900, no ~3 000. Detalle en `01-brechas.md`.
7. **Hay 25 llamadas a `prisma` hechas directamente desde la aplicación web** (por ejemplo `lib/admin/lealtad.ts` y `lib/wallet/apple/pase.ts`), fuera del paquete de datos. No las había contado; también pasan por el `db` del negocio (D5).

## 5. Infraestructura (páginas oficiales, 14 nov 2026)

- **Vercel, dominios comodín:** en todos los planes. Requiere usar los nameservers de Vercel en el dominio (o delegar la validación del certificado). Un comodín cubre un solo nivel de subdominio. Dominios propios por negocio: 50 por proyecto en Hobby, sin tope práctico en Pro.
- **Vercel, uso comercial:** Hobby es solo para uso personal y no comercial. Cobrar a negocios exige **Pro: US$20 al mes por asiento**, con US$20 de crédito de uso incluido. En Hobby los cron corren una vez al día; en Pro, hasta cada minuto.
- **Neon:** Free = 100 horas-CU y 1 GB por proyecto, se suspende a los 5 min sin uso (no se puede desactivar) y restaura hasta 6 horas atrás. Launch = por uso, sin mínimo: US$0.106 por hora-CU, US$0.35 por GB-mes, restauración hasta 7 días. No leí sus términos sobre uso comercial.
- **Resend:** Free = 3 000 correos al mes, 100 al día, 3 dominios. Pro = US$20 por 50 000 al mes, 10 dominios, sin tope diario.
- **Blob:** privado disponible en todos los planes; US$0.023 por GB-mes fuera de lo incluido.

### Costo mensual estimado (USD)

Jano ya paga Vercel, así que esa fila no es costo nuevo; se deja como referencia. Supuestos míos, **no medidos**: un asiento de Vercel; cómputo de Neon de 0.25 CU activo 12 h diarias (90 horas-CU) para 1 y 10 negocios, y 0.5 CU activo 16 h (240 horas-CU) para 50; base de 1, 2 y 5 GB. No incluye uso de Vercel por encima del crédito, dominio ni cuenta de Apple Developer.

| Concepto | 1 negocio | 10 negocios | 50 negocios |
| --- | ---: | ---: | ---: |
| Vercel Pro (ya contratado) | 20 | 20 | 20 |
| Neon Launch | ~10 | ~10 | ~27 |
| Resend | 0 | 20 | 20 |
| Blob (fotos) | <1 | <1 | ~1 |
| **Total aproximado** | **~30** | **~50** | **~70** |

El costo casi no crece con los negocios: el fijo manda. Por negocio baja de ~30 a ~1.4 USD al mes. Sin contar Vercel, el costo nuevo es de ~10, ~30 y ~50 USD al mes. Con la opción A de Apple, la cuota anual del programa de desarrolladores la paga cada negocio (importe no verificado en esta fase).

## 6. Wallet: qué dicen Apple y Google

**Google.** Su documentación define al emisor incluyendo a «agregadores» que crean pases por cuenta de otros. La cuenta nueva nace en modo demo (solo cuentas de prueba); para publicar hay que completar el perfil de negocio, tener al menos una clase y pedir el acceso, que Google revisa. Un Issuer de Exkalibur con una clase por negocio encaja. **No verifiqué** si cada clase nueva pasa por revisión.

**Apple.** El Apple Developer Program License Agreement vigente (Anexo 5, «Passes», sección 1) dice, en resumen: el Pass Type ID solo sirve para firmar **tu** pase, distribuido bajo **tu propia marca**; si el pase menciona la marca de un tercero debes tener los derechos; no puedes ceder el Pass Type ID a terceros salvo a un proveedor de servicios, **ni usarlo para firmar el pase de un tercero**. Apple puede revocar el Pass Type ID a su discreción. La sección 2.9 permite contratar a un proveedor de servicios que actúe solo por cuenta del titular, con contrato escrito.

Lectura práctica (no es asesoría legal):

| Opción | Cómo | A favor | En contra |
| --- | --- | --- | --- |
| A. Cuenta de Apple por negocio | Cada negocio se inscribe al programa; Exkalibur opera como su proveedor de servicios y guarda su certificado cifrado. | Es lo que el acuerdo describe. Cada negocio aísla su riesgo. | Fricción en el alta (cuenta, pago anual y certificado por negocio, renovación anual por negocio). Rompe «alta en 30 minutos». |
| B. Un Pass Type ID de Exkalibur | Todos los pases firmados por Exkalibur con la marca del negocio. | Alta inmediata; una sola renovación. Hay plataformas que lo hacen. | Choca con «no firmar el pase de un tercero». Si Apple revoca, **se caen los pases de todos los negocios a la vez**. En foros de Apple reportan que los pases con el mismo identificador se agrupan en Wallet. |
| C. Arquitectura para ambas (D10) | La credencial es un dato; cada negocio usa la suya o la de plataforma. | Deja la decisión comercial abierta sin rehacer código. | Un poco más de trabajo en la Fase 4. |

Recomendación original: C. **Decisión de Jano (15 nov): opción A.** El contrato de servicio debe nombrar a Exkalibur como proveedor de servicios del negocio ante Apple (§7).

## 7. Para el abogado de Jano (lista corta)

1. Contrato de servicio Exkalibur–negocio, con cláusulas de encargado de datos (LFPDPPP).
2. Anexo 5 y sección 2.9 del acuerdo de Apple: cláusula que nombre a Exkalibur proveedor de servicios de cada negocio y le permita custodiar su certificado.
3. Plantillas de términos y aviso de privacidad que la plataforma genera por negocio.

## 8. Fuentes

- [Vercel · Multi-tenant Limits](https://vercel.com/docs/platforms/multi-tenant-platforms/limits) · [Quickstart](https://vercel.com/docs/platforms/multi-tenant-platforms/quickstart)
- [Vercel · Terms of Service](https://vercel.com/legal/terms) · [Hobby plan](https://vercel.com/docs/plans/hobby.md) · [Pricing](https://vercel.com/pricing) · [Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Blob · Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) · [Private Blob](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available)
- [Neon · Plans](https://neon.com/docs/introduction/plans) · [Pricing](https://neon.com/pricing)
- [Resend · Pricing](https://resend.com/pricing)
- [Google Wallet · Key concepts](https://developers.google.com/wallet/generic/resources/terminology) · [Publishing access](https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/request-publishing-access)
- [Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) (Anexo 5 y §2.9) · [Foro de Apple: Pass Type ID por negocio](https://developer.apple.com/forums/thread/126778)
