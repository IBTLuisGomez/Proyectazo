#!/usr/bin/env bash
# Exporta los datos del backend anterior (Postgres del contenedor nexus-postgres) a JSONL, una tabla por archivo.
# Solo lee: no modifica ni borra nada en Postgres. No imprime contraseñas.
#
# Uso:   bash scripts/exportar-postgres.sh [carpeta_salida]
# Luego: python -m server.importar_postgres <carpeta_salida>      (o dentro del contenedor, ver docs/MIGRACION.md)
set -euo pipefail

OUT="${1:-export-postgres-$(date +%Y%m%d-%H%M%S)}"
CONTAINER="${PG_CONTAINER:-nexus-postgres}"

# Usuario y base desde .env sin mostrar el resto del archivo (ni la contraseña)
leer_env() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r"' || true; }
PGUSER="${POSTGRES_USER:-$(leer_env POSTGRES_USER)}"; PGUSER="${PGUSER:-nexus_user}"
PGDB="${POSTGRES_DB:-$(leer_env POSTGRES_DB)}"; PGDB="${PGDB:-nexus_db}"

if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "El contenedor $CONTAINER no está en marcha. Arráncalo con:"
  echo "  docker start $CONTAINER"
  exit 1
fi

mkdir -p "$OUT"
for T in app_users auth_tokens projects tasks session_logs pensadero_items inbox_items \
         push_subscriptions push_reminders app_settings; do
  if docker exec "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -At \
       -c "SELECT row_to_json(t) FROM $T t" > "$OUT/$T.jsonl" 2>/dev/null; then
    echo "  $T: $(grep -c . "$OUT/$T.jsonl" || true) filas"
  else
    rm -f "$OUT/$T.jsonl"
    echo "  $T: no existe (se omite)"
  fi
done
echo "Export listo en $OUT"
echo "Contiene hashes de contraseña y claves VAPID: no lo subas a git ni lo compartas; bórralo tras importar."
