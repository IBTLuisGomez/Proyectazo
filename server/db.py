"""Base de datos SQLite del backend único.

Proyectos, tareas, pensamientos, bandeja y bitácora se guardan como documentos JSON completos
(camelCase, tal como los manda el navegador), con columnas aparte solo para dueño, relación y orden.
Así se conservan campos que el cliente añade (inBaul, hibernatedUntil, …) sin migraciones de esquema.

Fechas: siempre ISO 8601 en UTC con «Z». Un valor sin zona se interpreta como UTC
(es como las guardaba el backend anterior en Postgres).
"""
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE TABLE IF NOT EXISTS session_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pensadero (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pensadero_owner ON pensadero(owner_id);
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  doc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notas (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notas_owner ON notas(owner_id);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS push_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  task_id TEXT,
  send_at TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON push_reminders(sent_at, send_at);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

# Campos de fecha que se normalizan a ISO UTC al guardar
DATE_FIELDS = ("createdAt", "updatedAt", "lastActivity", "dueAt", "date", "metaAt")


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    """datetime → '2026-01-02T03:04:05.678Z' (o None)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.astimezone(timezone.utc).microsecond // 1000:03d}Z"


def parse_dt(value):
    """Texto ISO (con o sin zona) o epoch en ms → datetime con zona UTC. Si no se puede, None."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def normalize_dates(doc):
    """Deja las fechas conocidas en ISO UTC. Un valor no válido se descarta (como hacía Jackson)."""
    for field in DATE_FIELDS:
        if field in doc and doc[field] is not None:
            doc[field] = iso(parse_dt(doc[field]))
    return doc


def short_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class Database:
    """Conexión única protegida por un candado: el volumen de datos es de una persona."""

    def __init__(self, path):
        if path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.conn.execute("PRAGMA foreign_keys = ON")
            if path != ":memory:":
                self.conn.execute("PRAGMA journal_mode = WAL")
            self.conn.executescript(SCHEMA)
            self.conn.execute(
                "INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),)
            )

    def transaction(self):
        return _Transaction(self)

    def query(self, sql, params=()):
        with self.lock:
            return self.conn.execute(sql, params).fetchall()

    def one(self, sql, params=()):
        with self.lock:
            return self.conn.execute(sql, params).fetchone()

    def execute(self, sql, params=()):
        with self.lock:
            return self.conn.execute(sql, params)

    def get_setting(self, key):
        row = self.one("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def set_setting(self, key, value):
        self.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                     (key, value))

    def is_empty(self):
        return not any(self.one(f"SELECT 1 FROM {t} LIMIT 1") for t in ("users", "projects", "pensadero"))


class _Transaction:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        self.db.lock.acquire()
        self.db.conn.execute("BEGIN IMMEDIATE")
        return self.db.conn

    def __exit__(self, exc_type, exc, tb):
        try:
            self.db.conn.execute("ROLLBACK" if exc_type else "COMMIT")
        finally:
            self.db.lock.release()
        return False


def dumps(doc):
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":"))


def loads(text):
    return json.loads(text) if text else {}
