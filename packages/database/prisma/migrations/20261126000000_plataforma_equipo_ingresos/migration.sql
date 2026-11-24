-- Panel de plataforma: equipo (cuentas por invitación y recuperación),
-- bitácora de lo que hace cada cuenta y pagos registrados a mano.
-- Igual que las demás tablas platform_*, el rol de la aplicación (wl_app) NO
-- recibe permisos: solo las usa el rol dueño.

-- Cuentas creadas por invitación: sin contraseña hasta usar el enlace.
ALTER TABLE "platform_user" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "platform_user" ADD COLUMN "password_changed_at" TIMESTAMPTZ;
ALTER TABLE "platform_user" ADD COLUMN "invited_by" VARCHAR(160);

CREATE TYPE "PlatformTokenPurpose" AS ENUM ('INVITACION', 'RECUPERACION');

CREATE TABLE "platform_password_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "purpose" "PlatformTokenPurpose" NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_password_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_password_token_token_hash_key" ON "platform_password_token"("token_hash");
CREATE INDEX "platform_password_token_user_id_created_at_idx" ON "platform_password_token"("user_id", "created_at");

ALTER TABLE "platform_password_token" ADD CONSTRAINT "platform_password_token_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bitácora. Sin llave foránea al club: la fila sobrevive a su borrado.
CREATE TABLE "platform_audit" (
    "id" UUID NOT NULL,
    "actor_email" VARCHAR(160) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "tenant_id" UUID,
    "tenant_slug" VARCHAR(63),
    "detail" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_created_at_idx" ON "platform_audit"("created_at" DESC);
CREATE INDEX "platform_audit_tenant_id_created_at_idx" ON "platform_audit"("tenant_id", "created_at");

-- Pagos registrados a mano.
CREATE TYPE "PlatformPaymentConcept" AS ENUM ('LITE', 'ARCADE');
CREATE TYPE "PlatformPaymentPeriod" AS ENUM ('MES', 'ANIO');

CREATE TABLE "platform_payment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "tenant_slug" VARCHAR(63) NOT NULL,
    "tenant_name" VARCHAR(160) NOT NULL,
    "concept" "PlatformPaymentConcept" NOT NULL,
    "period" "PlatformPaymentPeriod" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_until" TIMESTAMPTZ NOT NULL,
    "previous_until" TIMESTAMPTZ,
    "note" VARCHAR(250),
    "registered_by" VARCHAR(160) NOT NULL,
    "voided_at" TIMESTAMPTZ,
    "voided_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_payment_amount_check" CHECK ("amount_cents" >= 0)
);

CREATE INDEX "platform_payment_created_at_idx" ON "platform_payment"("created_at");
CREATE INDEX "platform_payment_tenant_id_created_at_idx" ON "platform_payment"("tenant_id", "created_at");

ALTER TABLE "platform_payment" ADD CONSTRAINT "platform_payment_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
