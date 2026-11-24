"""Importa a SQLite los datos del backend anterior (Spring + Postgres).

Entrada: una carpeta con un archivo JSONL por tabla, generada por scripts/exportar-postgres.sh
(cada línea es row_to_json de una fila, con las columnas en snake_case de Hibernate).

Uso:
    python -m server.importar_postgres <carpeta_export> [--db data/nexus.db] [--tz UTC] [--force]

- Las fechas de Postgres no tienen zona: se interpretan en --tz (UTC por defecto, la zona de la JVM en Docker).
- Se importan también usuarios (mismo hash BCrypt), sesiones vigentes, suscripciones push, avisos pendientes
  y las claves VAPID: tras migrar no hace falta volver a iniciar sesión ni a activar los avisos.
- Si la base de destino ya tiene datos, no hace nada salvo con --force.
"""
import argparse
import json
import os
import sys
from datetime import timezone
from zoneinfo import ZoneInfo

from .db import Database, dumps, iso, parse_dt

TABLES = ["app_users", "auth_tokens", "projects", "tasks", "session_logs", "pensadero_items", "inbox_items",
          "push_subscriptions", "push_reminders", "app_settings"]

TIMESTAMP_COLUMNS = {"created_at", "updated_at", "last_activity", "due_at", "date", "expires_at", "send_at", "sent_at"}
RENAME = {"column_key": "column"}
DROP = {"owner_id", "project_id"}


def camel(name):
    head, *rest = name.split("_")
    return head + "".join(p.capitalize() for p in rest)


def read_jsonl(folder, table):
    path = os.path.join(folder, f"{table}.jsonl")
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


class Importer:
    def __init__(self, db, tz="UTC", log=print):
        self.db = db
        self.log = log
        self.tz = timezone.utc if tz.upper() == "UTC" else ZoneInfo(tz)
        self.counts = {}

    def ts(self, value):
        """Fecha sin zona de Postgres → ISO UTC."""
        if value is None:
            return None
        dt = parse_dt(value) if str(value).endswith(("Z", "+00:00")) else None
        if dt is None:
            naive = parse_dt(value)
            if naive is None:
                return None
            dt = naive.replace(tzinfo=None).replace(tzinfo=self.tz).astimezone(timezone.utc)
        return iso(dt)

    def to_doc(self, row):
        doc = {}
        for key, value in row.items():
            if key in DROP or value is None:
                continue
            if key in TIMESTAMP_COLUMNS:
                value = self.ts(value)
            doc[RENAME.get(key) or camel(key)] = value
        return doc

    def run(self, folder):
        users = read_jsonl(folder, "app_users")
        first_user = min((u["id"] for u in users), default=None)
        if first_user is None:
            # Esquema antiguo sin usuarios: los datos van al usuario inicial (se crea como al arrancar el servidor)
            from .auth import Auth
            Auth(self.db).bootstrap_admin(os.getenv("NEXUS_ADMIN_USER", "admin"), os.getenv("NEXUS_ADMIN_PASSWORD", ""),
                                          log=self.log)
            first_user = self.db.one("SELECT MIN(id) AS id FROM users")["id"]
        owner = lambda row: row.get("owner_id") or first_user  # noqa: E731 · huérfanos al primer usuario
        with self.db.transaction() as conn:
            for u in users:
                conn.execute("INSERT OR REPLACE INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                             (u["id"], u["username"], u["password_hash"], self.ts(u.get("created_at"))))
            self.counts["usuarios"] = len(users)

            tokens = read_jsonl(folder, "auth_tokens")
            for t in tokens:
                conn.execute("INSERT OR IGNORE INTO tokens(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                             (t["token_hash"], t["user_id"], self.ts(t["expires_at"]), self.ts(t.get("created_at"))))
            self.counts["sesiones"] = len(tokens)

            projects = read_jsonl(folder, "projects")
            for p in projects:
                if owner(p) is None:
                    continue
                conn.execute("INSERT OR REPLACE INTO projects(id, owner_id, doc) VALUES (?, ?, ?)", (p["id"], owner(p), dumps(self.to_doc(p))))
            self.counts["proyectos"] = len(projects)

            known = {p["id"] for p in projects}
            for table, target, prefix in (("tasks", "tasks", "tareas"), ("session_logs", "session_logs", "bitácora")):
                rows = [r for r in read_jsonl(folder, table) if r.get("project_id") in known]
                for r in rows:
                    conn.execute(f"INSERT OR REPLACE INTO {target}(id, project_id, doc) VALUES (?, ?, ?)",
                                 (r["id"], r["project_id"], dumps(self.to_doc(r))))
                self.counts[prefix] = len(rows)

            for table, target, label in (("pensadero_items", "pensadero", "pensamientos"), ("inbox_items", "inbox", "bandeja")):
                rows = [r for r in read_jsonl(folder, table) if owner(r) is not None]
                for r in rows:
                    conn.execute(f"INSERT OR REPLACE INTO {target}(id, owner_id, doc) VALUES (?, ?, ?)",
                                 (r["id"], owner(r), dumps(self.to_doc(r))))
                self.counts[label] = len(rows)

            subs = read_jsonl(folder, "push_subscriptions")
            for s in subs:
                conn.execute("INSERT OR IGNORE INTO push_subscriptions(user_id, endpoint, p256dh, auth, created_at) "
                             "VALUES (?, ?, ?, ?, ?)", (s["user_id"], s["endpoint"], s["p256dh"], s["auth"], self.ts(s.get("created_at"))))
            self.counts["dispositivos push"] = len(subs)

            pending = [r for r in read_jsonl(folder, "push_reminders") if r.get("sent_at") is None]
            for r in pending:
                conn.execute("INSERT INTO push_reminders(user_id, title, body, task_id, send_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                             (r["user_id"], r["title"], r.get("body"), r.get("task_id"), self.ts(r["send_at"]), self.ts(r.get("created_at"))))
            self.counts["avisos pendientes"] = len(pending)

            settings = read_jsonl(folder, "app_settings")
            for s in settings:
                conn.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                             (s["setting_key"], s["setting_value"]))
            self.counts["ajustes"] = len(settings)
        return self.counts


def main(argv=None):
    parser = argparse.ArgumentParser(description="Importa el export de Postgres al backend único (SQLite).")
    parser.add_argument("carpeta")
    parser.add_argument("--db", default=os.getenv("NEXUS_DB_PATH", os.path.join("data", "nexus.db")))
    parser.add_argument("--tz", default="UTC", help="Zona en la que Postgres guardó las fechas (por defecto UTC)")
    parser.add_argument("--force", action="store_true", help="Importar aunque la base de destino ya tenga datos")
    args = parser.parse_args(argv)

    if not os.path.isdir(args.carpeta):
        print(f"No existe la carpeta {args.carpeta}")
        return 2
    db = Database(args.db)
    if not db.is_empty() and not args.force:
        print(f"{args.db} ya tiene datos. No se importa nada (usa --force si estás seguro).")
        return 1
    counts = Importer(db, args.tz).run(args.carpeta)
    print("Importado en", args.db)
    for k, v in counts.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
