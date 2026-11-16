-- Experimento de aislamiento (Fase 0). Ejecutar como superusuario en una base vacía «wlexp».
-- Antes: CREATE ROLE wl_owner LOGIN PASSWORD 'o'; CREATE ROLE wl_app LOGIN PASSWORD 'a' NOSUPERUSER NOBYPASSRLS;
--        CREATE DATABASE wlexp OWNER wl_owner;
SET ROLE wl_owner;
CREATE TABLE tenant (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL);
CREATE TABLE card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  public_code text NOT NULL,
  phone text,
  stamps int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, public_code),
  UNIQUE (tenant_id, phone)
);
GRANT USAGE ON SCHEMA public TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON card TO wl_app;
GRANT SELECT ON tenant TO wl_app;
ALTER TABLE card ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_tenant ON card
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
INSERT INTO tenant (id, slug) VALUES ('aaaaaaaa-0000-4000-8000-000000000001','cafe-a'), ('bbbbbbbb-0000-4000-8000-000000000002','barberia-b');
INSERT INTO card (tenant_id, public_code, phone, stamps)
  SELECT 'aaaaaaaa-0000-4000-8000-000000000001', 'A-'||g, '228000'||lpad(g::text,4,'0'), g%10 FROM generate_series(1,2000) g;
INSERT INTO card (tenant_id, public_code, phone, stamps)
  SELECT 'bbbbbbbb-0000-4000-8000-000000000002', 'B-'||g, '228000'||lpad(g::text,4,'0'), g%10 FROM generate_series(1,2000) g;
