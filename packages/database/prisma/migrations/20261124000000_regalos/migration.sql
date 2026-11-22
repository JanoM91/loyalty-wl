-- Regalos automáticos del club: «Te extrañamos» y cumpleaños.
-- Tabla de negocio: tenant_id con RLS, igual que las demás.

CREATE TABLE "club_gift" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "emailed_at" TIMESTAMPTZ,
    "redeemed_at" TIMESTAMPTZ,
    "redeemed_branch_id" UUID,
    "redeemed_by_id" UUID,

    CONSTRAINT "club_gift_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_gift_kind_check" CHECK ("kind" IN ('REGRESO', 'CUMPLE')),
    CONSTRAINT "club_gift_status_check" CHECK ("status" IN ('DISPONIBLE', 'ENTREGADO'))
);

CREATE UNIQUE INDEX "club_gift_card_id_kind_period_key" ON "club_gift"("card_id", "kind", "period");
CREATE INDEX "club_gift_tenant_id_created_at_idx" ON "club_gift"("tenant_id", "created_at");
CREATE INDEX "club_gift_tenant_id_emailed_at_idx" ON "club_gift"("tenant_id", "emailed_at");
CREATE INDEX "club_gift_card_id_status_idx" ON "club_gift"("card_id", "status");

ALTER TABLE "club_gift" ADD CONSTRAINT "club_gift_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_gift" ADD CONSTRAINT "club_gift_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_gift" ADD CONSTRAINT "club_gift_redeemed_branch_id_fkey" FOREIGN KEY ("redeemed_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "club_gift" ADD CONSTRAINT "club_gift_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_gift" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_gift_por_negocio" ON "club_gift"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "club_gift" TO wl_app;
