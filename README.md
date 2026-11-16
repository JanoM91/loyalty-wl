# Loyalty WL

Plataforma de programas de lealtad **white label** de Exkalibur Consulting: un
solo sistema que aloja el programa de muchos negocios, cada uno con su marca,
sus reglas y sus datos aislados. Nace del módulo de lealtad de LAPANA
(`lapana-xalapa`), generalizado. Nombre y paquetes `@wl/*` son provisionales.

Estado: **Fases 1 y 2 construidas** (cimientos multi-negocio y paridad del
núcleo de lealtad). Ver `docs/03-estado-fases-1-2.md` para lo hecho, lo que
falta verificar y lo pendiente. Wallet, marca avanzada y panel de plataforma
son fases siguientes.

## Qué hay aquí

| Carpeta | Qué es |
| --- | --- |
| `packages/domain` | Reglas puras del programa (estampas, premios, validaciones). Sin base ni framework. |
| `packages/database` | Esquema, migración con RLS, contexto de negocio y toda la lógica con datos. |
| `apps/web` | La aplicación: tarjeta del cliente (`/lealtad`) y panel del negocio (`/admin`). |
| `tests/e2e` | Recorrido completo en navegador. |
| `docs` | Decisiones, brechas contra LAPANA, aislamiento y estado. |

## Ponerlo a andar en tu computadora

Necesitas Node 22, pnpm 9 y una base PostgreSQL (Neon sirve) con **dos roles**.

1. En la terminal, dentro de esta carpeta: `pnpm install`
2. Copia `.env.example` como `.env.local` y pon `DIRECT_URL` (rol dueño de la base).
3. Crea las tablas: `pnpm db:generate` y luego `pnpm db:migrate`
   - Resultado esperado: «All migrations have been successfully applied».
4. Crea el rol de la aplicación. En el editor SQL de tu base, con el rol dueño:
   `CREATE ROLE wl_web LOGIN PASSWORD '<una contraseña larga>' IN ROLE wl_app;`
   y pon ese usuario y contraseña en `DATABASE_URL`.
5. Siembra los dos negocios de demostración: `pnpm db:seed`
   - Imprime, por negocio, un enlace `/admin/contrasena/...` de un solo uso para
     que su dueño fije su contraseña.
6. Arranca: `pnpm dev` y abre `http://cafe-demo.localhost:3200` y
   `http://barberia-demo.localhost:3200` (Chrome resuelve `*.localhost` solo).
   - Panel: `http://cafe-demo.localhost:3200/admin`.

Si un paso falla con «RolInseguroError», `DATABASE_URL` está usando el rol
dueño: debe ser `wl_web`.

## Comandos

- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
- Las pruebas con base (fuga entre negocios e integración) solo corren con
  `WL_PRUEBAS_BD=1` y las dos URLs puestas; sin eso se **saltan** (y lo dicen).
- Enlace nuevo para el dueño de un negocio:
  `pnpm --filter @wl/database invitar <slug> <correo> "<nombre>"`
- Recorrido E2E (con la app corriendo):
  `node tests/e2e/recorrido.mjs cafe-demo duenio@cafe-demo.ejemplo.mx capturas`

## Reglas del repositorio

- Ramas desde `develop`; commits convencionales en español.
- Ninguna consulta de negocio fuera de `@wl/database`, y ahí siempre con
  `prisma` / `transaccion` / `lote` (llevan el negocio). Ver `docs/02-aislamiento.md`.
- `lapana-xalapa` es referencia de solo lectura. Aquí no entra ningún dato,
  secreto ni credencial de LAPANA.
