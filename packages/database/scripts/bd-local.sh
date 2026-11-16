#!/usr/bin/env bash
# Prepara una base local de pruebas sin `prisma migrate` (que necesita el motor
# nativo): aplica el SQL de las migraciones con psql y crea el usuario de la
# aplicación. Uso: DIRECT_URL=postgresql://dueño... scripts/bd-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DIRECT_URL:?Falta DIRECT_URL (rol dueño)}"
# El adaptador pg de Prisma 5.22 solo entiende TIMESTAMPTZ en UTC (Neon ya lo está).
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -q -c "ALTER DATABASE \"$(psql "$DIRECT_URL" -tAc 'select current_database()')\" SET timezone TO 'UTC'"
for m in prisma/migrations/*/migration.sql; do
  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -q -f "$m"
done
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -q -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wl_web') THEN CREATE ROLE wl_web LOGIN PASSWORD 'web' IN ROLE wl_app; END IF; END \$\$;"
echo "Base lista. La aplicación se conecta como wl_web (contraseña «web», solo para pruebas locales)."
