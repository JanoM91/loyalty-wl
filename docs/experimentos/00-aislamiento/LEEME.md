# Experimento de aislamiento (Fase 0, 14 nov 2026)

Evidencia de `docs/00-decisiones.md` §3. No es código de producto.

- `esquema.sql`: dos negocios, 2 000 tarjetas cada uno, RLS por `app.tenant_id`, rol dueño y rol de aplicación.
- `schema.prisma`: el mismo modelo para Prisma 5.22.
- `exp.cjs`: las 24 comprobaciones y la medición de latencia.
- `resultado.txt`: la salida de la corrida.

Cómo se corrió: Postgres 16.15 local en el puerto 5544, Node 22, `prisma@5.22.0`, `@prisma/client@5.22.0`, `@prisma/adapter-pg@5.22.0`, `pg`.

Limitación: el entorno no pudo descargar los motores nativos de Prisma, así que el cliente se generó con `prisma generate --no-engine` y se cargó el motor WASM que trae el paquete, con el adaptador `pg` (por eso `exp.cjs` importa `.prisma/client/wasm.js`, parchado a mano). Con una instalación normal basta importar `@prisma/client`. Repetir en la Fase 1 con el motor nativo y contra Neon.
