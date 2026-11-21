-- Arcade del club: configuración del dueño, partidas y cupones.
-- Las tres tablas son de negocio: tenant_id con RLS, igual que las demás.

CREATE TYPE "ArcadeCouponStatus" AS ENUM ('DISPONIBLE', 'CANJEADO');

CREATE TABLE "arcade_config" (
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arcade_config_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "arcade_play" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "game" VARCHAR(20) NOT NULL,
    "day" DATE NOT NULL,
    "seed" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "score" INTEGER,
    "level" INTEGER,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "arcade_play_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arcade_coupon" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "challenge_id" VARCHAR(40) NOT NULL,
    "period" VARCHAR(12) NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "ArcadeCouponStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "redeemed_at" TIMESTAMPTZ,
    "redeemed_branch_id" UUID,
    "redeemed_by_id" UUID,

    CONSTRAINT "arcade_coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "arcade_play_tenant_id_idx" ON "arcade_play"("tenant_id");
CREATE INDEX "arcade_play_card_id_day_idx" ON "arcade_play"("card_id", "day");
CREATE INDEX "arcade_play_tenant_id_day_idx" ON "arcade_play"("tenant_id", "day");
CREATE UNIQUE INDEX "arcade_coupon_card_id_challenge_id_period_key" ON "arcade_coupon"("card_id", "challenge_id", "period");
CREATE UNIQUE INDEX "arcade_coupon_tenant_id_code_key" ON "arcade_coupon"("tenant_id", "code");
CREATE INDEX "arcade_coupon_tenant_id_idx" ON "arcade_coupon"("tenant_id");
CREATE INDEX "arcade_coupon_status_expires_at_idx" ON "arcade_coupon"("status", "expires_at");

ALTER TABLE "arcade_config" ADD CONSTRAINT "arcade_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arcade_config" ADD CONSTRAINT "arcade_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arcade_play" ADD CONSTRAINT "arcade_play_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arcade_play" ADD CONSTRAINT "arcade_play_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arcade_coupon" ADD CONSTRAINT "arcade_coupon_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arcade_coupon" ADD CONSTRAINT "arcade_coupon_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arcade_coupon" ADD CONSTRAINT "arcade_coupon_redeemed_branch_id_fkey" FOREIGN KEY ("redeemed_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arcade_coupon" ADD CONSTRAINT "arcade_coupon_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "arcade_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arcade_config_por_negocio" ON "arcade_config"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "arcade_play" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arcade_play_por_negocio" ON "arcade_play"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "arcade_coupon" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arcade_coupon_por_negocio" ON "arcade_coupon"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "arcade_config" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "arcade_play" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "arcade_coupon" TO wl_app;
