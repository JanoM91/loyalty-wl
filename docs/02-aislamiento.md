# 02 · Aislamiento entre negocios

Actualizado: 15 nov 2026 (Fases 1 y 2). Sustituye el diseño D5 de `00-decisiones.md` en un punto (ver «Cambio contra lo planeado»).

## Cómo funciona

1. **Una base, una columna.** Toda tabla de negocio lleva `tenant_id`. La tabla `tenant` es la única sin ella.
2. **La base hace cumplir el aislamiento (RLS).** Cada tabla tiene la política `<tabla>_por_negocio`: solo se ven y se escriben filas cuyo `tenant_id` es igual al ajuste `app.tenant_id` de la transacción. Sin ese ajuste no se ve nada.
3. **Dos roles.** El dueño (`DIRECT_URL`) migra, siembra y da de alta negocios. La aplicación (`DATABASE_URL`) usa un rol miembro de `wl_app`, sin `BYPASSRLS`. La bitácora (`audit_log`) solo admite leer e insertar.
4. **Candado de arranque.** Antes de la primera consulta, el paquete comprueba con qué rol está conectado. Si es dueño, superusuario o se salta RLS, lanza `RolInseguroError` y no consulta.
5. **El negocio sale del contexto, no de un parámetro.**
   - En la web: el middleware saca el subdominio del `Host`, lo deja en una cabecera interna (descartando la que mande el navegador) y `instrumentation-node.ts` registra el resolutor. Dirección sin negocio, o negocio suspendido → 404.
   - En tareas, siembra y pruebas: `conNegocio(negocio, fn)`.
   - Sin negocio en contexto → `SinNegocioError`. Nunca se consulta «sin filtro».
6. **Doble cerrojo.** `prisma` (exportado) abre una transacción por operación, fija `app.tenant_id` y además añade `tenantId` al `where`. `transaccion(fn)` y `lote(fn)` fijan el ajuste; dentro de ellas protege RLS.
7. **`tenant_id` lo pone la base** (valor por omisión desde `app.tenant_id`). El código nunca lo escribe, así que no puede escribirlo mal.

## Reglas para quien programe

- Consultas de negocio solo dentro de `@wl/database`, con `prisma`, `transaccion` o `lote`. El cliente `base` no se exporta.
- Prohibido `prisma.$transaction`, `$queryRawUnsafe` con texto del usuario y `findUnique` por claves que ya no son únicas globales (slug, correo, código, celular): usar `findFirst`.
- Tabla nueva = columna `tenant_id` con su valor por omisión + política RLS + permisos a `wl_app` + caso en `tests/fuga.test.ts`.
- Operaciones de plataforma (crear, suspender o borrar un negocio) solo en `plataforma.ts`, con el rol dueño.

## Qué prueban las pruebas

`packages/database/tests/`:

- `fuga.test.ts` (14): leer, contar, actualizar, borrar y crear cruzado entre dos negocios; SQL crudo; sin contexto; contextos concurrentes; bitácora inmutable.
- `candado.test.ts`: con el rol dueño como «aplicación», se niega.
- `dos-negocios.test.ts`: recorrido completo en dos negocios con programa, prefijo, zona horaria y regla de comprobante distintos.
- Integración portada de LAPANA (lealtad, acceso, usuarios, alta en caja), cada archivo en su propio negocio.

En CI corren contra un Postgres real; si fallan, no se fusiona.

## Cambio contra lo planeado

D5 pedía pasar un `db` por parámetro a cada función. Se cambió a **contexto** (puntos 5 y 6) para portar ~20 000 líneas de LAPANA sin cambiar firmas y poder traer sus correcciones futuras con diferencias pequeñas. La seguridad no depende de ello: sigue fallando cerrado y RLS es la barrera real.

## Límites conocidos

- Las llaves foráneas no incluyen `tenant_id`: que una fila no apunte a otra de otro negocio lo garantiza RLS (no se puede leer el id ajeno), no una restricción.
- Dentro de `transaccion` no se añade el `where` de aplicación; solo protege RLS.
- La migración SQL se generó con un script propio a partir de `schema.prisma` (aquí no se pudo descargar el motor de Prisma). **Falta que Jano corra una vez** `pnpm --filter @wl/database exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "<base vacía>"` y confirme que no reporta diferencias.
- El negocio se elige por `x-forwarded-host` (lo fija Vercel) o `Host`. Elegir negocio no da permisos: cada sesión se busca dentro del negocio elegido.
- No probado con el motor nativo de Prisma ni en Neon; solo con el motor WASM contra PostgreSQL 16 local.
