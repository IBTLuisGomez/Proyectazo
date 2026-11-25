#!/bin/sh
# Restaura una copia de seguridad diaria de la base de datos (ver server/backup.py).
#
#   scripts/restaurar-copia.sh               lista las copias disponibles
#   scripts/restaurar-copia.sh 2026-11-24    restaura la de ese día
#
# Para la app, guarda la base actual como nexus.db.antes-de-restaurar (por si hay que volver atrás),
# copia la elegida y arranca de nuevo. Lo guardado después de esa copia se pierde en el servidor;
# cada dispositivo conserva sus datos y los vuelve a subir al sincronizar.
set -eu

DATOS=/app/data
en_contenedor() {
    docker compose run --rm --no-deps -T --entrypoint sh app -c "$1"
}

if [ $# -eq 0 ]; then
    echo "Copias disponibles (la más reciente al final):"
    en_contenedor "ls -1 $DATOS/backups 2>/dev/null | grep -E '^nexus-[0-9]{4}-[0-9]{2}-[0-9]{2}\.db$' || echo '  (ninguna todavía)'"
    echo "Uso: $0 AAAA-MM-DD"
    exit 0
fi

DIA="$1"
case "$DIA" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
    *) echo "Fecha no válida: usa AAAA-MM-DD" >&2; exit 1 ;;
esac
COPIA="$DATOS/backups/nexus-$DIA.db"

en_contenedor "test -f $COPIA" || { echo "No existe la copia del $DIA." >&2; exit 1; }

echo "Parando la app…"
docker compose stop app
# Los archivos -wal y -shm son de la base antigua: si se quedan, SQLite los aplicaría sobre la restaurada
en_contenedor "cd $DATOS && { [ ! -f nexus.db ] || cp nexus.db nexus.db.antes-de-restaurar; } && cp $COPIA nexus.db && rm -f nexus.db-wal nexus.db-shm"
echo "Arrancando la app…"
docker compose start app
echo "Restaurada la copia del $DIA. La base anterior quedó en nexus.db.antes-de-restaurar (dentro del volumen de datos)."