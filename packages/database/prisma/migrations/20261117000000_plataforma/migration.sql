-- Cuentas y sesiones del panel de plataforma (Exkalibur).
--
-- No llevan negocio y el rol de la aplicación (wl_app) NO recibe ningún
-- permiso sobre ellas: solo las lee y escribe el rol dueño.

CREATE TABLE "platform_user" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_user_email_key" ON "platform_user"("email");
CREATE UNIQUE INDEX "platform_session_token_hash_key" ON "platform_session"("token_hash");
CREATE INDEX "platform_session_expires_at_idx" ON "platform_session"("expires_at");

ALTER TABLE "platform_session" ADD CONSTRAINT "platform_session_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
