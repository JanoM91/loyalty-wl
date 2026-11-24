-- Avisos a dueños, completos: envío programado, plantillas, estado de entrega
-- por destinatario y buzón dentro del panel de cada club.
--
-- platform_notice, platform_notice_recipient y platform_notice_template son de
-- plataforma: sin permisos para wl_app. club_notice es de negocio (tenant_id con
-- RLS): el dueño lee sus avisos y marca cuándo los leyó.

ALTER TABLE "platform_notice" ADD COLUMN "status" VARCHAR(12) NOT NULL DEFAULT 'ENVIADO';
ALTER TABLE "platform_notice" ADD COLUMN "audience_value" VARCHAR(100);
ALTER TABLE "platform_notice" ADD COLUMN "scheduled_at" TIMESTAMPTZ;
ALTER TABLE "platform_notice" ADD COLUMN "sent_at" TIMESTAMPTZ;
ALTER TABLE "platform_notice" ALTER COLUMN "clubs" SET DEFAULT 0;
ALTER TABLE "platform_notice" ALTER COLUMN "sent" SET DEFAULT 0;
ALTER TABLE "platform_notice" ADD CONSTRAINT "platform_notice_status_check"
  CHECK ("status" IN ('PROGRAMADO', 'ENVIANDO', 'ENVIADO', 'CANCELADO'));
UPDATE "platform_notice" SET "sent_at" = "created_at" WHERE "sent_at" IS NULL;
CREATE INDEX "platform_notice_status_scheduled_at_idx" ON "platform_notice"("status", "scheduled_at");

CREATE TABLE "platform_notice_recipient" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "tenant_id" UUID,
    "tenant_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "owner_name" VARCHAR(160) NOT NULL DEFAULT '',
    "resend_id" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notice_recipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_notice_recipient_notice_id_idx" ON "platform_notice_recipient"("notice_id");
CREATE INDEX "platform_notice_recipient_resend_id_idx" ON "platform_notice_recipient"("resend_id");

ALTER TABLE "platform_notice_recipient" ADD CONSTRAINT "platform_notice_recipient_notice_id_fkey"
  FOREIGN KEY ("notice_id") REFERENCES "platform_notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_notice_recipient" ADD CONSTRAINT "platform_notice_recipient_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform_notice_template" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "updated_by" VARCHAR(160) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notice_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_notice_template_name_key" ON "platform_notice_template"("name");

-- Buzón del dueño: una copia del aviso por club.
CREATE TABLE "club_notice" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "notice_id" UUID NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "club_notice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "club_notice_tenant_id_notice_id_key" ON "club_notice"("tenant_id", "notice_id");
CREATE INDEX "club_notice_tenant_id_created_at_idx" ON "club_notice"("tenant_id", "created_at");

ALTER TABLE "club_notice" ADD CONSTRAINT "club_notice_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "club_notice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_notice_por_negocio" ON "club_notice"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

-- El dueño solo lee y marca como leído; lo escribe la plataforma (rol dueño).
GRANT SELECT ON "club_notice" TO wl_app;
GRANT UPDATE ("read_at") ON "club_notice" TO wl_app;
