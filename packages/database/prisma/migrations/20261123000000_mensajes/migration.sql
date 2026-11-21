-- «Mensajes a tus clientes»: correos del negocio a quienes aceptaron promociones.
-- Tabla de negocio: tenant_id con RLS, igual que las demás.

CREATE TABLE "club_message" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "subject" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'ENVIANDO',
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "club_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "club_message_tenant_id_created_at_idx" ON "club_message"("tenant_id", "created_at" DESC);

ALTER TABLE "club_message" ADD CONSTRAINT "club_message_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_message" ADD CONSTRAINT "club_message_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_message_por_negocio" ON "club_message"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "club_message" TO wl_app;
