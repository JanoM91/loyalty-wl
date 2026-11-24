# 05 · Panel de plataforma y logotipos

Fecha: 16 nov 2026. Cierra la parte de la Fase 3 que faltaba: dar de alta un negocio sin tocar código.

## Qué es

`/plataforma` es el panel de Exkalibur. Desde ahí se crea un negocio, se le invita a su dueño, se cambia su modalidad y se suspende o reactiva. Vive en la raíz del sitio compartido; no pertenece a ningún negocio.

| Pantalla | Para qué |
| --- | --- |
| `/plataforma/entrar` | Acceso del equipo de Exkalibur |
| `/plataforma` | Lista de negocios con modalidad, estado, sucursales y tarjetas |
| `/plataforma/nuevo` | Alta en una sola pantalla |
| `/plataforma/<negocio>` | Ficha: direcciones, enlace del dueño, modalidad, suspender |

## Cómo se da de alta un negocio

1. Entrar a `/plataforma` y abrir **Nuevo negocio**.
2. Llenar: nombre, dirección en el sitio, prefijo del código de tarjeta, modalidad, una de las 20 combinaciones de color, estampas y premios, sucursales (una por renglón) y correo del dueño.
3. **Crear negocio.** La ficha muestra una sola vez el enlace del dueño. Hay que mandárselo (WhatsApp o correo propio): con él fija su contraseña.
4. El dueño entra a su panel y ajusta marca, logotipos, programa, sucursales y cuentas de su personal.

El negocio queda operando al crearlo: su portada, su tarjeta y su caja ya abren.

## Antes de usarlo: crear tu cuenta de plataforma

No hay pantalla de registro. La cuenta se crea desde la terminal, y la contraseña se teclea ahí (no se muestra, no se guarda en el historial):

- Dónde: terminal, en la carpeta del proyecto, con `DIRECT_URL` puesto en `.env.local`.
- Qué: `pnpm --filter @wl/database plataforma:usuario tu-correo "Tu nombre"`
- Resultado esperado: «Listo: tu-correo ya puede entrar en /plataforma/entrar».
- Si falla con «Falta DIRECT_URL», esa variable no está cargada.

Repetir el comando con el mismo correo cambia la contraseña y cierra sus sesiones. Cinco intentos fallidos seguidos bloquean la cuenta 15 minutos.

## Decisiones de seguridad

- Las cuentas y sesiones de plataforma están en tablas propias (`platform_user`, `platform_session`) a las que el rol de la aplicación **no tiene ningún permiso** (probado): solo las toca el rol dueño.
- Por eso **el servidor web necesita `DIRECT_URL`** además de `DATABASE_URL`. Es un cambio contra lo dicho en `02-aislamiento.md`: el rol dueño ya vive en el servidor, aunque solo lo usa el código de `plataforma.ts` y `plataforma-acceso.ts`. Endurecerlo (un tercer rol solo para plataforma) queda pendiente.
- La cookie de plataforma solo viaja a `/plataforma`; nunca a las páginas de un negocio.
- El enlace del dueño pasa por la dirección de la ficha al crearlo (queda en el historial del navegador de quien da el alta). Sirve una sola vez y vence.

## Logotipos

En `/admin/marca` el dueño sube tres archivos (PNG, JPG o WebP, hasta 1 MB): logotipo para fondos claros, logotipo para la tarjeta y sello de las estampas. Van a Vercel Blob, en la carpeta de marca de su negocio; la base solo acepta direcciones de esa carpeta (probado). Sin token de Blob, la sección avisa que la subida no está activa y el nombre se sigue escribiendo con la tipografía del diseño.

**La subida en sí no se ha ejecutado nunca**: aquí no hay token de Blob. Sí está probado todo lo que no depende del almacén.

## Evidencia (16 nov 2026, entorno de Claude)

- `pnpm lint`, `format:check`, `typecheck`, `build`: sin errores. `pnpm test`: 207 pruebas (dominio 113, datos 86, web 8).
- `tests/e2e/alta-negocio.mjs` en Chrome, 9 de 9 pasos: sin sesión manda a entrar; con contraseña equivocada no entra; alta de «Tacos El Güero» desde el panel; el dueño fija su contraseña y ve sus dos sucursales; la portada lleva su premio; un cliente crea su tarjeta con el prefijo `TG`; suspender cierra el programa y reactivar lo devuelve.
- Recorridos anteriores siguen pasando: café 10 de 10, barbería 11 de 11.
- Criterio de la Fase 3 («un tercer negocio, solo desde el panel, operando en menos de 30 minutos»): el robot tarda 3 segundos del formulario al primer cliente con tarjeta. **Falta la medición que cuenta: Jano haciéndolo a mano.**

## Pendiente

- Probar todo fuera de este entorno: motor normal de Prisma, Neon, Vercel, celular real, subida de logotipos.
- Manual breve por negocio (dueño y cajero).
- Editar desde plataforma los ajustes finos de un negocio (reglas de comprobante, zona horaria, prefijo) y agregar sucursales desde el panel del dueño.
- Endurecer el acceso de plataforma (tercer rol de base, segundo factor).
- Lo que sigue abierto en `03` y `04`: fotos privadas, fechas por zona horaria, E2E en CI, nombre y textos del sitio, herramienta lite → privada.

## Equipo, bitácora, ingresos y actividad (24 nov 2026)

| Pantalla | Para qué |
| --- | --- |
| `/plataforma/equipo` | Invitar a alguien (enlace de un solo uso, 72 h), generarle un enlace de contraseña, darlo de baja o reactivarlo |
| `/plataforma/cuenta` | Cambiar la contraseña propia y cerrar las demás sesiones |
| `/plataforma/entrar/recuperar` | «¿Olvidaste tu contraseña?»: enlace por correo (una hora, tres por hora) |
| `/plataforma/bitacora` | Quién hizo qué, cuándo, desde qué IP y en qué club (tabla `platform_audit`) |
| `/plataforma/ingresos` | Pagos registrados con importe, el mes, recurrente estimado y renovaciones en 30 días |
| `/plataforma/actividad` | Visitas, tarjetas y último acceso por club, y «A quién llamar» con WhatsApp |
| `/plataforma/exportar` | CSV para Excel de clubes y dueños (`?que=pagos` para los pagos) |

- La terminal (`pnpm plataforma:usuario`, dentro de `packages/database`) sigue sirviendo por si nadie puede entrar.
- Cada pago se registra con lo cobrado (tabla `platform_payment`) y se puede anular: si es el último, la fecha de pago regresa a la de antes. Los pagos anteriores al 24 nov no tienen importe.
- Las tablas nuevas son de plataforma: el rol `wl_app` no tiene permisos sobre ellas.
- Hallazgo: en Next 15.5, cuando una acción de servidor repinta la misma página (redirect a esa página con otros parámetros o `revalidatePath`), a veces la pantalla no cambia aunque el cambio sí se guardó. Pasa también en `main`. Los formularios nuevos hacen una carga completa de la página al terminar.
