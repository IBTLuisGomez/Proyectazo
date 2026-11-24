"""Registro de errores del navegador (Fase 9).

La app es de una sola página y casi todo ocurre en el cliente: sin esto, un botón que falla en el
móvil no deja rastro. El navegador envía el mensaje del error y dónde ocurrió (archivo, línea, vista
y versión); nunca el contenido de pensamientos, tareas o listas.

Límites: textos recortados, 30 errores por usuario y hora, y solo se conservan los últimos 300.
"""
from datetime import timedelta

from .db import dumps, iso, loads, now

MAX_PER_HOUR = 30
KEEP = 300
LIMITS = {"message": 500, "stack": 3000, "source": 300, "view": 40, "version": 40, "userAgent": 300, "kind": 30}


class ClientLog:
    def __init__(self, db, log=print):
        self.db = db
        self.log = log

    def add(self, user_id, payload):
        """Guarda un error. Devuelve False si se descarta (vacío o por encima del límite)."""
        if not isinstance(payload, dict):
            return False
        doc = {k: str(payload[k])[:n] for k, n in LIMITS.items() if payload.get(k) not in (None, "")}
        if not doc.get("message"):
            return False
        for key in ("line", "column"):
            if isinstance(payload.get(key), int) and not isinstance(payload.get(key), bool):
                doc[key] = payload[key]
        since = iso(now() - timedelta(hours=1))
        recent = self.db.one("SELECT COUNT(*) AS n FROM client_errors WHERE user_id = ? AND at >= ?", (user_id, since))["n"]
        if recent >= MAX_PER_HOUR:
            return False
        self.db.execute("INSERT INTO client_errors(user_id, at, doc) VALUES (?, ?, ?)", (user_id, iso(now()), dumps(doc)))
        self.db.execute("DELETE FROM client_errors WHERE id <= (SELECT MAX(id) FROM client_errors) - ?", (KEEP,))
        self.log(f"[cliente] {doc['message']} ({doc.get('source', '?')}:{doc.get('line', '?')}, vista {doc.get('view', '?')})")
        return True

    def recent(self, user_id, limit=50):
        rows = self.db.query("SELECT id, at, doc FROM client_errors WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                             (user_id, limit))
        return [{"id": r["id"], "at": r["at"], **loads(r["doc"])} for r in rows]
