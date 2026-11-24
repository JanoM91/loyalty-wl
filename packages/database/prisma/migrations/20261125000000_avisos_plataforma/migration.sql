-- Historial de los avisos que Exkalibur manda por correo a los dueños desde el
-- panel de plataforma. Sin negocio: igual que las demás tablas platform_*, el
-- rol de la aplicación (wl_app) NO recibe permisos; solo la usa el rol dueño.

CREATE TABLE "platform_notice" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "audience" VARCHAR(160) NOT NULL,
    "clubs" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "sent_by" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_notice_created_at_idx" ON "platform_notice"("created_at");
