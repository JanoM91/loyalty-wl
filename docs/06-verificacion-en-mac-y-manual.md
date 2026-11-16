# 06 · Verificación en la Mac de Jano, manual y sucursales

Fecha: 16 nov 2026. Corrige lo que `03`, `04` y `05` daban por «no verificado» y registra lo añadido después.

## Lo que ya quedó verificado fuera del entorno de Claude

Jano instaló el proyecto en su Mac contra una base nueva en Neon (`loyalty-wl-dev`, región `aws-us-east-2`, PostgreSQL 18, cómputo de 0.25 CU).

| Qué | Cómo se sabe |
| --- | --- |
| Las tres migraciones se aplican con el motor normal de Prisma en Neon | Jano corrió `pnpm db:migrate`; Claude lo comprobó por SQL: 3 migraciones, 19 tablas, 18 políticas de aislamiento |
| El usuario de la aplicación (`wl_web`) no se salta el aislamiento ni ve las tablas de plataforma | Comprobado por SQL en Neon |
| El usuario dueño de Neon sí se salta el aislamiento, así que el candado de arranque tiene sentido ahí | Comprobado por SQL en Neon |
| Siembra, arranque, alta de tarjeta, visita en caja y panel de plataforma funcionan en la Mac | Lo reportó Jano («todas las pruebas salieron bien»); Claude no lo vio |

Sigue pendiente de verificar: `prisma migrate diff` (que el esquema y las migraciones coinciden), correos, fotos y logotipos (sin almacén de archivos), celular real, lector de QR con cámara, Vercel y el CI de GitHub. Tampoco se registró cuánto tardó Jano en dar de alta un negocio a mano.

## Un solo archivo de variables

Los comandos de base y la aplicación leen `.env.local` de la **raíz** del proyecto. Antes el README lo decía y el código no lo hacía; ya coincide. Necesita Node 22.9 o más nuevo.

## Añadido

- **Ayuda (`/admin/ayuda`).** El manual del negocio dentro de su panel, escrito con sus datos: su dirección, su prefijo de código, sus premios y su regla de folio. El personal de sucursal ve la parte de caja; la dirección ve además qué preparar antes de abrir y qué revisar cada semana. Se imprime desde el navegador. Cierra el punto «manual por negocio» de la Fase 3.
- **Sucursal nueva (`/admin/sucursales`).** Administración y Dueño abren sucursales desde su panel. Nacen apagadas para el programa; se encienden en «Sucursales y códigos».

## Evidencia (16 nov 2026, entorno de Claude)

- `pnpm lint`, `typecheck`, `build`: sin errores. `pnpm test`: 207 pruebas.
- Recorrido en Chrome: café 12 de 12 pasos, barbería 13 de 13 (ahora incluyen abrir la ayuda y crear una sucursal). Alta de negocio desde plataforma: 9 de 9.

## Estado de la Fase 3

Hecho: marca por negocio con plantillas y 20 combinaciones, términos y privacidad por plantilla, cartel con la marca, panel de plataforma (crear, invitar, modalidad, suspender), manual por negocio, páginas de inicio de las dos modalidades.

Falta para cerrarla: que Jano mida el alta a mano (criterio de «menos de 30 minutos»), nombre y textos del sitio, y probar correos y logotipos con sus servicios reales.

## Lo siguiente

1. **Desplegar en Vercel** una instalación compartida de prueba. Requiere la aprobación explícita de Jano y definir: proyecto de Vercel, variables (`DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET`), y si se usa ya el dominio definitivo o la dirección temporal de Vercel.
2. **Correo (Resend) y archivos (Vercel Blob)**: sin ellos no hay recuperación de contraseña por correo, ni fotos de ticket, ni logotipos.
3. **Wallet (Fase 4)**: necesita las cuentas de Apple Developer y Google Wallet que Jano crea.
4. Decisiones abiertas: negocio por contexto, rol Dueño administrando usuarios, fotos privadas, colores exactos de los artículos, estándar E2E.
