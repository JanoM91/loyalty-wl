# 03 · Estado al cierre de las Fases 1 y 2

Fecha: 15 nov 2026. Referencia portada: `lapana-xalapa` `develop@2391356`.

## Hecho

**Fase 1 · Cimientos multi-negocio**

- Monorepo (`@wl/domain`, `@wl/database`, `@wl/web`), esquema con `tenant`, migración inicial con RLS en 16 tablas, dos roles, candado de arranque y contexto de negocio. Detalle en `02-aislamiento.md`.
- Alta de negocios (`crearNegocio`), invitación del dueño por enlace de un solo uso y siembra de dos negocios de demostración: `cafe-demo` (8 estampas, 2 premios, 4 sucursales) y `barberia-demo` (5 estampas, 1 premio, folio obligatorio).

**Fase 2 · Paridad del núcleo de lealtad**

- Cliente: portada, alta, tarjeta con QR, premios, historial, perfil, acceso con contraseña, recuperación, enlace personal, verificación, instalación como app, términos y aviso de privacidad.
- Caja: visita, premio, visita sin tarjeta, alta en caja, migración de tarjeta física, reenvío de acceso, solicitudes.
- Panel: resumen, analítica, tarjetas, pendientes, sucursales con cartel QR, programa configurable, usuarios, cuenta, bitácora.
- Por negocio: nombre, colores, logotipos, frase, prefijo del código, zona horaria, reglas de comprobante, umbrales de migración y días de conservación de fotos.
- Regla del folio (decisión de Jano): con QR se pide siempre y **no bloquea**; la visita sin folio se acredita y queda anotada (`comprobanteConQr: PEDIDO`). Un negocio puede exigirlo (`OBLIGATORIO`).

## Evidencia (ejecutado el 15 nov 2026, en el entorno de Claude)

| Comprobación | Resultado |
| --- | --- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` | sin errores |
| `pnpm test` | 171 pruebas: dominio 88, datos 77 (14 de fuga), web 6 |
| `pnpm build` | compila; 38 rutas |
| Recorrido en navegador, `cafe-demo` | 9 de 9 pasos |
| Recorrido en navegador, `barberia-demo` (folio obligatorio) | 10 de 10 pasos |
| Texto «LAPANA» o de panadería en pantallas | ninguno |

El recorrido (`tests/e2e/recorrido.mjs`) hace en Chrome: alta web → el dueño fija contraseña y entra → visita en caja → premio disponible → entrega en caja → premio canjeado en el celular → detalle y analítica en el panel. **Atajo declarado:** como se gana una estampa por día, las estampas que faltan para el premio y la verificación del contacto se ponen directo en la base.

## No verificado

- **Motor nativo de Prisma y Neon.** Todo corrió con el motor WASM contra PostgreSQL 16 local (aquí no se puede descargar el motor nativo). `prisma migrate deploy` no se ejecutó nunca: las tablas se crearon aplicando el SQL de la migración con `psql`.
- **Migración contra el esquema** (`prisma migrate diff`): pendiente de Jano, ver `02-aislamiento.md`.
- **Correos**: ninguno enviado (sin Resend). Los textos se armaron pero no se vieron en una bandeja.
- **Fotos de tickets**: sin token de Blob, la caja registra sin foto. Subida y limpieza diaria no se ejecutaron.
- **Pantallas no recorridas en navegador** (sí cubiertas por pruebas de datos): recuperación de contraseña del cliente y del panel, alta en caja, visita sin tarjeta, migración de tarjeta física, pendientes, edición del programa, usuarios, cartel, instalación como app.
- **Celular real**, lector de QR con cámara, Vercel y subdominios reales.
- **CI de GitHub**: el flujo está escrito y no ha corrido.

## Diferencias contra LAPANA y contra lo planeado

1. Contexto de negocio en vez de parámetro `db` (ver `02-aislamiento.md`).
2. La tabla de sucursales conserva el nombre `branch` (01-brechas proponía `location`).
3. El rol **Dueño** también administra usuarios (en LAPANA solo Administración). Marketing y Solo lectura no se ofrecen: no tienen pantallas.
4. Fuera por ahora: campañas y push, clientes y compras, cruce con ventas y carga del punto de venta, pedidos, catálogo. Wallet queda apagado hasta la Fase 4.
5. La barra del cliente cambia «Comprar» por «Reglas».
6. El sello de cada estampa es el isotipo del negocio, o una palomita si no lo ha subido.

## Pendiente conocido (no bloquea, sí hay que decidir o hacer)

- **Fechas del panel** se muestran en hora del centro de México para todos; las reglas (una visita por día) sí usan la zona de cada negocio.
- **Fotos**: van a Blob público con dirección no adivinable, separadas por negocio, como en LAPANA. Hacerlas privadas (corrección 7 de la Fase 0) no se hizo: falta revisar qué ofrece hoy Vercel Blob para almacenamiento privado.
- **Marca, ajustes y sucursales nuevas** se cambian por código o base; el panel de plataforma es la Fase 3.
- **Términos y aviso de privacidad** son plantillas: cada negocio debe revisarlas con su abogado.
- **Un solo remitente de correo** de plataforma con el nombre del negocio; falta definir dominio y dirección.
- **E2E en CI** y adopción del estándar E2E de Exkalibur (D19): sin aprobar.
