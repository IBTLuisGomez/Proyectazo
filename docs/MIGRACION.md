# Migración al backend único (Fase 3)

Antes: 4 contenedores (Postgres, Spring Boot, Nexus IA, nginx), unos 1–1,5 GB de RAM.
Ahora: 2 contenedores (`nexus-app` en Python con SQLite y `nexus-frontend` con nginx), unos 100 MB.

El frontend no cambia: la API mantiene las mismas rutas y el mismo formato JSON.

Lo que mejora además:
- las fechas vuelven con su zona horaria (antes un aviso podía desplazarse varias horas);
- se conservan todos los campos que guarda la app (antes se perdían `inBaul`, `hibernatedUntil`…);
- la IA y Jarvis exigen sesión también fuera de nginx.

**Tus datos actuales no se borran.** El volumen `proyectazo_postgres_data` sigue ahí y la nueva `docker-compose.yml` lo declara en el perfil `legacy` solo para poder leerlo.

---

## Paso a paso (en tu equipo o en el droplet)

Todo se hace desde la carpeta del proyecto, con la rama nueva ya descargada.

### 1. Exportar los datos de Postgres (solo lectura)

```bash
docker start nexus-postgres                  # si estaba parado
bash scripts/exportar-postgres.sh mi-export  # una carpeta con un .jsonl por tabla
docker stop nexus-postgres
```

El export contiene hashes de contraseña y claves de push. Está en `.gitignore`; bórralo cuando termines.

### 2. Construir y arrancar la versión nueva sin datos todavía

```bash
docker compose build app frontend
docker compose up -d app
```

### 3. Importar el export dentro del contenedor

```bash
docker cp mi-export nexus-app:/app/data/mi-export
docker compose exec app python -m server.importar_postgres /app/data/mi-export --force
docker compose exec app rm -rf /app/data/mi-export
docker compose restart app
```

- `--force` hace falta porque al arrancar el paso 2 ya se creó el usuario inicial. Sin `--force` no se importa nada.
- Si tu export trae usuarios (versión reciente), se importan con su misma contraseña, sus sesiones y sus dispositivos de avisos: no hace falta volver a entrar.
- Si no trae usuarios (versión antigua, como la de este equipo), los datos se asignan al usuario de `NEXUS_ADMIN_USER`.
- Las fechas de Postgres se interpretan en UTC (la zona por defecto de la JVM en Docker). Si tu backend corría con otra zona, añade `--tz Europe/Madrid` o la que sea.

### 4. Arrancar todo y comprobar

```bash
docker compose up -d --remove-orphans   # quita los contenedores viejos nexus-backend y nexus-ai-microservice (no los volúmenes)
docker compose ps                        # nexus-app y nexus-frontend en "healthy"
```

Abre la app, inicia sesión y comprueba que están tus proyectos y pensamientos.

### 5. Cuando lo hayas comprobado (días después)

- La carpeta `backend/` (Spring) y el perfil `legacy` se retiraron el 2026-11-27; para volver a leer el Postgres antiguo, recupéralos del historial de git. Queda borrar el volumen viejo: `docker volume rm proyectazo_postgres_data`. **Esto borra los datos antiguos para siempre: hazlo solo cuando estés seguro.**
- Copia de seguridad de la nueva base: es un solo archivo.
  `docker compose exec app python -c "import sqlite3; s=sqlite3.connect('/app/data/nexus.db'); d=sqlite3.connect('/app/data/copia.db'); s.backup(d)"` y luego `docker cp nexus-app:/app/data/copia.db .`

## Volver atrás

Si algo falla, la versión anterior sigue disponible en la rama `dev` y el volumen de Postgres está intacto:

```bash
git switch dev
docker compose up -d --build
```

## Desarrollo sin Docker

```bash
pip install -r server/requirements.txt
python -m server            # API + IA en http://localhost:8081 (base en data/nexus.db)
```

`iniciar_escritorio.bat` y la app de escritorio lo arrancan solos.
