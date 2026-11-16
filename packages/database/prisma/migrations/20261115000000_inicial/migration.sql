-- Loyalty WL · migración inicial (15 nov 2026)
--
-- Tablas, índices y llaves foráneas corresponden a prisma/schema.prisma. Al
-- final va lo que Prisma no sabe declarar: restricciones CHECK, índices
-- parciales, RLS por negocio y permisos del rol de la aplicación.

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL', 'MARKETING', 'LECTOR');

-- CreateEnum
CREATE TYPE "AdminTokenPurpose" AS ENUM ('INVITACION', 'RECUPERACION');

-- CreateEnum
CREATE TYPE "LoyaltyRewardStatus" AS ENUM ('DISPONIBLE', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "LoyaltyAccrualStatus" AS ENUM ('PENDIENTE', 'ACREDITADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "LoyaltyCodePurpose" AS ENUM ('VERIFICAR_CORREO', 'ACCESO', 'ACCESO_APP');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVO',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
    "code_prefix" VARCHAR(4) NOT NULL DEFAULT 'WL',
    "brand" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address_line" VARCHAR(250) NOT NULL,
    "neighborhood" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL DEFAULT '',
    "state" VARCHAR(120) NOT NULL DEFAULT '',
    "postal_code" VARCHAR(10) NOT NULL,
    "phone" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "loyalty_enabled" BOOLEAN NOT NULL DEFAULT false,
    "loyalty_since" DATE,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "role" "UserRole" NOT NULL,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" VARCHAR(255),
    "password_changed_at" TIMESTAMPTZ,
    "email_verified_at" TIMESTAMPTZ,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_session" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(255),

    CONSTRAINT "admin_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_password_token" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "user_id" UUID NOT NULL,
    "purpose" "AdminTokenPurpose" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "sent_by_email" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_password_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "email" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_card" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "public_code" VARCHAR(16) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "email_verified_at" TIMESTAMPTZ,
    "phone_verified_at" TIMESTAMPTZ,
    "name" VARCHAR(120),
    "birth_day" INTEGER,
    "birth_month" INTEGER,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "terms_version" VARCHAR(20) NOT NULL,
    "terms_accepted_at" TIMESTAMPTZ NOT NULL,
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "marketing_opt_in_at" TIMESTAMPTZ,
    "enrolled_branch_id" UUID,
    "enrolled_by_id" UUID,
    "physical_migrated_at" TIMESTAMPTZ,
    "physical_migrated_stamps" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "password_hash" VARCHAR(255),
    "password_changed_at" TIMESTAMPTZ,
    "wallet_auth_token" VARCHAR(64),
    "wallet_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "google_wallet_object_at" TIMESTAMPTZ,
    "app_first_opened_at" TIMESTAMPTZ,
    "app_last_opened_at" TIMESTAMPTZ,
    "campaign_opt_out_at" TIMESTAMPTZ,
    "email_undeliverable_at" TIMESTAMPTZ,
    "personal_link_token" VARCHAR(64),
    "personal_link_created_at" TIMESTAMPTZ,
    "wallet_message" VARCHAR(200),
    "wallet_message_at" TIMESTAMPTZ,
    "wallet_message_id" UUID,

    CONSTRAINT "loyalty_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accrual" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "status" "LoyaltyAccrualStatus" NOT NULL,
    "purchase_date" DATE NOT NULL,
    "ticket_folio" VARCHAR(40) NOT NULL,
    "ticket_register" VARCHAR(10) NOT NULL,
    "ticket_key" VARCHAR(120) NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "eligible_cents" INTEGER NOT NULL,
    "stamps_awarded" INTEGER NOT NULL DEFAULT 0,
    "program_version" VARCHAR(20) NOT NULL,
    "capture_source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "photo_url" VARCHAR(500),
    "note" VARCHAR(300),
    "created_by_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_accrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_reward" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(80),
    "milestone" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL,
    "status" "LoyaltyRewardStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "accrual_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMPTZ,
    "redeemed_branch_id" UUID,
    "redeemed_by_id" UUID,

    CONSTRAINT "loyalty_reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_session" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "token_hash" VARCHAR(64) NOT NULL,
    "card_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(255),

    CONSTRAINT "loyalty_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_code" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "purpose" "LoyaltyCodePurpose" NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "sent_to_phone" VARCHAR(20),
    "resets_password" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_login_attempt" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID,
    "identifier_hash" VARCHAR(64) NOT NULL,
    "ip_address" VARCHAR(45),
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_access_request" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "card_id" UUID NOT NULL,
    "branch_id" UUID,
    "status" VARCHAR(12) NOT NULL DEFAULT 'ABIERTA',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_id" UUID,
    "code_id" UUID,

    CONSTRAINT "loyalty_access_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_program" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "version" VARCHAR(20) NOT NULL,
    "positions" INTEGER NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "milestones" JSONB NOT NULL,
    "tiers" JSONB NOT NULL,
    "contingency_window_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(300),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ,

    CONSTRAINT "loyalty_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_device" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "device_library_id" VARCHAR(64) NOT NULL,
    "push_token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallet_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_registration" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "device_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "branch_tenant_id_slug_key" ON "branch"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "user_account_role_idx" ON "user_account"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_tenant_id_email_key" ON "user_account"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_session_token_hash_key" ON "admin_session"("token_hash");

-- CreateIndex
CREATE INDEX "admin_session_user_id_idx" ON "admin_session"("user_id");

-- CreateIndex
CREATE INDEX "admin_session_expires_at_idx" ON "admin_session"("expires_at");

-- CreateIndex
CREATE INDEX "admin_session_tenant_id_idx" ON "admin_session"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_token_token_hash_key" ON "admin_password_token"("token_hash");

-- CreateIndex
CREATE INDEX "admin_password_token_user_id_created_at_idx" ON "admin_password_token"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_password_token_tenant_id_idx" ON "admin_password_token"("tenant_id");

-- CreateIndex
CREATE INDEX "login_attempt_email_created_at_idx" ON "login_attempt"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempt_ip_address_created_at_idx" ON "login_attempt"("ip_address", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempt_tenant_id_idx" ON "login_attempt"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_wallet_auth_token_key" ON "loyalty_card"("wallet_auth_token");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_personal_link_token_key" ON "loyalty_card"("personal_link_token");

-- CreateIndex
CREATE INDEX "loyalty_card_enrolled_branch_id_idx" ON "loyalty_card"("enrolled_branch_id");

-- CreateIndex
CREATE INDEX "loyalty_card_created_at_idx" ON "loyalty_card"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_tenant_id_public_code_key" ON "loyalty_card"("tenant_id", "public_code");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_tenant_id_phone_key" ON "loyalty_card"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_tenant_id_email_key" ON "loyalty_card"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "loyalty_accrual_card_id_branch_id_purchase_date_idx" ON "loyalty_accrual"("card_id", "branch_id", "purchase_date");

-- CreateIndex
CREATE INDEX "loyalty_accrual_branch_id_created_at_idx" ON "loyalty_accrual"("branch_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_accrual_status_created_at_idx" ON "loyalty_accrual"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accrual_tenant_id_ticket_key_key" ON "loyalty_accrual"("tenant_id", "ticket_key");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_reward_card_id_cycle_milestone_key" ON "loyalty_reward"("card_id", "cycle", "milestone");

-- CreateIndex
CREATE INDEX "loyalty_reward_status_created_at_idx" ON "loyalty_reward"("status", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_reward_tenant_id_idx" ON "loyalty_reward"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_session_token_hash_key" ON "loyalty_session"("token_hash");

-- CreateIndex
CREATE INDEX "loyalty_session_card_id_idx" ON "loyalty_session"("card_id");

-- CreateIndex
CREATE INDEX "loyalty_session_expires_at_idx" ON "loyalty_session"("expires_at");

-- CreateIndex
CREATE INDEX "loyalty_session_tenant_id_idx" ON "loyalty_session"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_code_code_hash_key" ON "loyalty_code"("code_hash");

-- CreateIndex
CREATE INDEX "loyalty_code_card_id_purpose_created_at_idx" ON "loyalty_code"("card_id", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_code_tenant_id_idx" ON "loyalty_code"("tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_login_attempt_card_id_created_at_idx" ON "loyalty_login_attempt"("card_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_login_attempt_identifier_hash_created_at_idx" ON "loyalty_login_attempt"("identifier_hash", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_login_attempt_ip_address_created_at_idx" ON "loyalty_login_attempt"("ip_address", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_login_attempt_tenant_id_idx" ON "loyalty_login_attempt"("tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_access_request_branch_id_status_created_at_idx" ON "loyalty_access_request"("branch_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_access_request_status_created_at_idx" ON "loyalty_access_request"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_access_request_ip_address_created_at_idx" ON "loyalty_access_request"("ip_address", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_access_request_tenant_id_idx" ON "loyalty_access_request"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_program_tenant_id_version_key" ON "loyalty_program"("tenant_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_device_tenant_id_device_library_id_key" ON "wallet_device"("tenant_id", "device_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_registration_device_id_card_id_key" ON "wallet_registration"("device_id", "card_id");

-- CreateIndex
CREATE INDEX "wallet_registration_card_id_idx" ON "wallet_registration"("card_id");

-- CreateIndex
CREATE INDEX "wallet_registration_tenant_id_idx" ON "wallet_registration"("tenant_id");

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_password_token" ADD CONSTRAINT "admin_password_token_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_password_token" ADD CONSTRAINT "admin_password_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempt" ADD CONSTRAINT "login_attempt_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_card" ADD CONSTRAINT "loyalty_card_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_card" ADD CONSTRAINT "loyalty_card_enrolled_branch_id_fkey" FOREIGN KEY ("enrolled_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_card" ADD CONSTRAINT "loyalty_card_enrolled_by_id_fkey" FOREIGN KEY ("enrolled_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accrual" ADD CONSTRAINT "loyalty_accrual_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accrual" ADD CONSTRAINT "loyalty_accrual_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accrual" ADD CONSTRAINT "loyalty_accrual_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accrual" ADD CONSTRAINT "loyalty_accrual_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accrual" ADD CONSTRAINT "loyalty_accrual_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_accrual_id_fkey" FOREIGN KEY ("accrual_id") REFERENCES "loyalty_accrual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_redeemed_branch_id_fkey" FOREIGN KEY ("redeemed_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_session" ADD CONSTRAINT "loyalty_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_session" ADD CONSTRAINT "loyalty_session_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_code" ADD CONSTRAINT "loyalty_code_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_code" ADD CONSTRAINT "loyalty_code_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_login_attempt" ADD CONSTRAINT "loyalty_login_attempt_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_login_attempt" ADD CONSTRAINT "loyalty_login_attempt_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "loyalty_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_device" ADD CONSTRAINT "wallet_device_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_registration" ADD CONSTRAINT "wallet_registration_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_registration" ADD CONSTRAINT "wallet_registration_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "wallet_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_registration" ADD CONSTRAINT "wallet_registration_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Restricciones que Prisma no declara
-- ---------------------------------------------------------------------------

ALTER TABLE "tenant" ADD CONSTRAINT "tenant_slug_check"
  CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_code_prefix_check"
  CHECK ("code_prefix" ~ '^[A-Z0-9]{2,4}$');

ALTER TABLE "loyalty_access_request" ADD CONSTRAINT "loyalty_access_request_status_check"
  CHECK ("status" IN ('ABIERTA', 'ENVIADA', 'DESCARTADA', 'VENCIDA'));

-- Una sola versión activa del programa por negocio.
CREATE UNIQUE INDEX "loyalty_program_una_activa" ON "loyalty_program"("tenant_id") WHERE "is_active";

-- Una visita por tarjeta, sucursal y fecha de compra. Las visitas migradas de
-- la tarjeta física no cuentan para ese límite.
CREATE UNIQUE INDEX "loyalty_accrual_una_por_dia"
  ON "loyalty_accrual"("card_id", "branch_id", "purchase_date")
  WHERE "capture_source" <> 'MIGRACION';

-- Una sola solicitud de acceso abierta por tarjeta.
CREATE UNIQUE INDEX "loyalty_access_request_una_abierta"
  ON "loyalty_access_request"("card_id") WHERE "status" = 'ABIERTA';

-- ---------------------------------------------------------------------------
-- Aislamiento por negocio (RLS)
--
-- Cada tabla de negocio solo deja ver y escribir las filas cuyo tenant_id es
-- el fijado en `app.tenant_id` para la transacción. Sin ese ajuste no se ve
-- ni se escribe nada. El dueño de las tablas se salta RLS: por eso la
-- aplicación se conecta con otro rol (ver más abajo).
-- ---------------------------------------------------------------------------

ALTER TABLE "branch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_por_negocio" ON "branch"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "user_account" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_account_por_negocio" ON "user_account"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "admin_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_session_por_negocio" ON "admin_session"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "admin_password_token" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_password_token_por_negocio" ON "admin_password_token"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "login_attempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_attempt_por_negocio" ON "login_attempt"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_por_negocio" ON "audit_log"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_card" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_card_por_negocio" ON "loyalty_card"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_accrual" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_accrual_por_negocio" ON "loyalty_accrual"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_reward" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_reward_por_negocio" ON "loyalty_reward"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_session_por_negocio" ON "loyalty_session"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_code" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_code_por_negocio" ON "loyalty_code"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_login_attempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_login_attempt_por_negocio" ON "loyalty_login_attempt"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_access_request" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_access_request_por_negocio" ON "loyalty_access_request"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "loyalty_program" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_program_por_negocio" ON "loyalty_program"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "wallet_device" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_device_por_negocio" ON "wallet_device"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

ALTER TABLE "wallet_registration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_registration_por_negocio" ON "wallet_registration"
  USING ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)
  WITH CHECK ("tenant_id" = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid);

-- ---------------------------------------------------------------------------
-- Rol de la aplicación
--
-- `wl_app` es un rol sin acceso propio (NOLOGIN) que agrupa los permisos. El
-- usuario con el que se conecta la aplicación (DATABASE_URL) debe ser miembro
-- de este rol y NO ser dueño de las tablas ni tener BYPASSRLS:
--
--   CREATE ROLE wl_web LOGIN PASSWORD '...' IN ROLE wl_app;
--
-- Las migraciones se aplican con el dueño (DIRECT_URL).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wl_app') THEN
    CREATE ROLE wl_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO wl_app;

-- Los negocios se leen para resolver el subdominio. Crearlos, suspenderlos o
-- borrarlos es tarea de plataforma, con el rol dueño.
GRANT SELECT ON "tenant" TO wl_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON "branch" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_account" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "admin_session" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "admin_password_token" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "login_attempt" TO wl_app;
-- Bitácora inmutable: la aplicación solo agrega y lee.
GRANT SELECT, INSERT ON "audit_log" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_card" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_accrual" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_reward" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_session" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_code" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_login_attempt" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_access_request" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_program" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "wallet_device" TO wl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "wallet_registration" TO wl_app;
