-- Ajustes de toda la plataforma (por ejemplo, el borrado automático de clubes
-- pausados). Sin negocio: igual que platform_user, el rol de la aplicación
-- (wl_app) NO recibe permisos; solo la lee y escribe el rol dueño.

CREATE TABLE "platform_setting" (
    "key" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" VARCHAR(160),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("key")
);
