# 04 · Modalidades, base de datos y diseño

Fecha: 15 nov 2026. Recoge el contexto que Jano dio al cerrar las Fases 1 y 2. **Manda sobre `PROMPT-MAESTRO.md` donde difieran.**

## Lo que dijo Jano

1. El programa de LAPANA opera a diario y validó la demanda: el servicio se ofrecerá a muchos giros (restaurantes, bares, spas, taquerías, cafeterías, panaderías, escuelas de arte…).
2. El stack de LAPANA no es obligatorio. Hay cuenta de Supabase además de Neon.
3. Cada programa tiene identidad propia: diseño, colores, premios y reglas, configurables.
4. Dos modalidades:
   - **Privada:** proyecto de Vercel y base propios, muy personalizada, con acompañamiento y todos los servicios (campañas, reportes). Diseños y plantillas distintos para dar unicidad.
   - **Lite:** varios programas en el mismo proyecto y la misma base, independientes entre sí. El negocio personaliza logos, colores y premios. Campañas y reportes avanzados los administra Exkalibur.
5. Las demos usan un diseño distinto al de LAPANA: mínimo y actual, en el sitio del cliente y en el panel.

## Cómo queda resuelto en el código

**Un solo código para las dos modalidades.** No hay dos productos que mantener.

| | Lite | Privada |
| --- | --- | --- |
| Instalación | Compartida: `<negocio>.<dominio>` | Propia: su proyecto de Vercel y su base |
| Cómo se elige el negocio | Subdominio | Variable `WL_NEGOCIO_UNICO=<slug>`; vale cualquier dominio |
| Ajuste `plan` del negocio | `LITE` | `PRIVADA` |
| Marca editable por el negocio | Sí (`/admin/marca`) | Sí, más diseño a la medida |
| Campañas y reportes completos | Los administra Exkalibur | Abiertos (cuando existan: Fase 5) |

- `funcionesDelPlan(negocio)` decide qué ve cada modalidad. Hoy solo distingue campañas y reportes completos, que todavía no existen.
- El `plan` vive en los ajustes del negocio, que **solo cambia la plataforma**: la base no deja que el negocio se lo cambie a sí mismo (probado).
- Una instalación privada sigue usando el mismo aislamiento (RLS y dos roles), con un solo negocio dentro. Pasar a un cliente de lite a privada es mover sus filas a otra base; falta escribir esa herramienta.

**Marca en tres capas.**

1. *Colores* (cinco, por negocio): tarjeta, texto de la tarjeta, sellos, página y texto.
2. *Plantilla* (`aire`, `noche`, `calida`): tipografía, formas y cómo se derivan las superficies. Añadir una plantilla es un bloque de CSS en `globals.css`; ahí va la unicidad de la modalidad privada.
3. *Pantallas*: no cambian entre negocios.

El dueño edita nombre, plantilla, colores, frase, contacto y datos legales en `/admin/marca`, con vista previa. La base solo le deja cambiar el nombre y la marca de **su** negocio. Se rechazan combinaciones ilegibles (contraste menor a 4.5:1 en texto).

**Diseño de las demos** (plantilla `aire`; `noche` para la barbería): una sola familia para títulos (Bricolage Grotesque) y otra para texto (Onest), servidas desde el propio sitio; la tarjeta es el color de la marca con el número de estampas en grande; barra flotante de íconos; panel con navegación en píldoras. El único movimiento es el sello que se llena al ganar una estampa, más el fundido entre pantallas.

## Base de datos: Neon o Supabase

**Recomendación: seguir en Neon.** Razones, con precios consultados el 15 nov 2026 (verificar antes de contratar):

- La modalidad privada crea **una base por cliente**. En Neon Launch no hay cuota mensual ni cargo por proyecto, y una base sin uso se apaga sola a los 5 minutos: un cliente pequeño cuesta casi nada. En Supabase Pro la cuota es por organización (25 USD al mes) y cada proyecto adicional suma desde 10 USD al mes, se use o no. Con 10 clientes privados, eso es un costo fijo de alrededor de 115 USD al mes en Supabase.
- En el plan gratuito de Supabase los proyectos se pausan tras una semana sin actividad; no sirve para clientes reales.
- El código usa PostgreSQL estándar (RLS, roles, `set_config`): funciona igual en los dos. Cambiar después es posible; no hay nada atado a Neon.
- Lo que Supabase añade (autenticación, almacenamiento, tiempo real) aquí no se usa: el acceso es propio y las fotos van a Vercel Blob.

Contra Neon: al despertar una base apagada, la primera consulta tarda más. Para un cliente con caja activa se puede desactivar el apagado en el plan Launch (se paga el cómputo continuo). Sin medir todavía.

Fuentes: neon.com/docs/introduction/plans, neon.com/guides/neon-launch-plan-vs-supabase-pro-plan, supabase.com/pricing (vía resúmenes de terceros fechados entre agosto y noviembre de 2026).

## Evidencia (15 nov 2026, entorno de Claude)

- `pnpm lint`, `format:check`, `typecheck`, `build`: sin errores. `pnpm test`: 177 pruebas (dominio 88, datos 83, web 6).
- Recorrido en navegador con el diseño nuevo: `cafe-demo` 10 de 10 pasos (incluye guardar la marca); `barberia-demo` 11 de 11.
- Instalación privada simulada (`WL_NEGOCIO_UNICO=cafe-demo`): un dominio cualquiera abre el programa del café.

## Pendiente

- **Subir logotipos** desde el panel (hoy el nombre se escribe con la tipografía de la plantilla).
- **Panel de plataforma** para dar de alta negocios sin tocar código (resto de la Fase 3) y manual por negocio.
- **Más plantillas** y una guía para diseñar una a la medida (modalidad privada).
- Herramienta para **pasar un negocio de lite a privada**.
- Fechas del panel por zona horaria del negocio, fotos privadas, E2E en CI (siguen de `03`).
- Nada de esto se ha probado con el motor normal de Prisma, en Neon ni en un celular real.
