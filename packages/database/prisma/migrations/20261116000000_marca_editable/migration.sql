-- El negocio edita su propia marca desde su panel.
--
-- Hasta ahora la aplicación solo podía LEER la tabla de negocios. Ahora puede
-- cambiar dos columnas (nombre y marca) y solo de la fila del negocio en
-- curso: lo hace cumplir la base, no el código. Estado, slug, prefijo y
-- ajustes (que incluyen la modalidad contratada) siguen siendo de plataforma.

ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;

-- Leer cualquier negocio sigue haciendo falta: así se resuelve el subdominio.
CREATE POLICY "tenant_lectura" ON "tenant" FOR SELECT USING (true);

CREATE POLICY "tenant_edita_el_suyo" ON "tenant" FOR UPDATE
  USING ("id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

GRANT UPDATE ("name", "brand", "updated_at") ON "tenant" TO wl_app;
