-- ---------------------------------------------------------------------------
-- Rol del panel de plataforma (`wl_plataforma`)
--
-- Hasta ahora el panel de plataforma se conectaba con el rol dueño
-- (DIRECT_URL), que además puede cambiar la estructura, quitar el
-- aislamiento y dar permisos. Este rol agrupa solo lo que el panel usa:
-- leer y escribir datos de todos los clubes y de las tablas de plataforma.
--
-- No puede: crear, cambiar ni borrar tablas; quitar RLS ni tocar políticas;
-- dar o quitar permisos; vaciar tablas (TRUNCATE); ni editar o borrar las
-- bitácoras (`audit_log`, `platform_audit`), que solo crecen.
--
-- Es NOLOGIN, como `wl_app`. Quien opera crea un usuario miembro y pone su
-- cadena en DATABASE_URL_PLATAFORMA (ver docs del proyecto, 19):
--
--   CREATE ROLE wl_panel LOGIN PASSWORD '...' IN ROLE wl_plataforma;
--
-- Sin esa variable, el panel sigue usando DIRECT_URL como antes.
--
-- Cada tabla nueva con RLS necesita su política `<tabla>_plataforma`: la
-- prueba `rol-plataforma.integracion.test.ts` falla si falta.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wl_plataforma') THEN
    CREATE ROLE wl_plataforma NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO wl_plataforma;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wl_plataforma', t.relname);
    -- Las políticas de negocio filtran por `app.tenant_id`; el panel cruza
    -- clubes, así que lleva la suya, solo para este rol.
    IF t.relrowsecurity THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO wl_plataforma USING (true) WITH CHECK (true)',
        t.relname || '_plataforma',
        t.relname
      );
    END IF;
  END LOOP;
END
$$;

-- Bitácoras: solo agregar y leer.
REVOKE UPDATE, DELETE ON "audit_log" FROM wl_plataforma;
REVOKE UPDATE, DELETE ON "platform_audit" FROM wl_plataforma;

-- Tablas que creen las migraciones futuras (con el mismo rol dueño).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wl_plataforma;
