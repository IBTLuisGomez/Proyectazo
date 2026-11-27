"""Datos de la app: proyectos, tareas, bitácora, pensadero, bandeja y sincronización.

Reglas portadas del backend Spring (SyncService, ProjectService, TaskService, PensaderoService):
- cada cuenta solo ve y toca lo suyo; un id de otra cuenta se ignora o se trata como inexistente;
- máximo 3 tareas «enfoco» por proyecto (límite WIP);
- en la sincronización gana la versión con updatedAt más reciente.
Diferencias a propósito: se conservan todos los campos del documento (no solo los conocidos),
las fechas vuelven con zona (Z) y el id que manda el cliente se respeta.
"""
from .db import dumps, loads, normalize_dates, now, iso, parse_dt, short_id

WIP_LIMIT = 3
WIP_ERROR = "Límite de Foco TDAH alcanzado: No puedes tener más de 3 tareas en 'En Foco'"
DEMO_PROJECT_IDS = {"p-focusflow", "p-cytohelix", "p-cytocore", "proj_focusflow", "proj_cytohelix", "proj_cytocore"}

# Campos que gestiona el servidor y nunca se copian desde el cliente
PROJECT_RESERVED = {"id", "ownerId", "tasks", "logs", "createdAt"}
TASK_RESERVED = {"id", "projectId", "project", "createdAt"}
ITEM_RESERVED = {"id", "ownerId", "createdAt"}

PROJECT_DEFAULTS = {"emoji": "⚡", "color": "#10b981", "status": "activo", "energy": "media", "nextActionType": "hacer"}


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


def _blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def _clean(doc):
    return {k: v for k, v in (doc or {}).items() if not k.startswith("_")}


def _copy_non_null(target, source, reserved):
    for key, value in source.items():
        if key in reserved or value is None:
            continue
        target[key] = value


def _is_newer(incoming, existing):
    a, b = parse_dt(incoming), parse_dt(existing)
    if a is None:
        return False
    if b is None:
        return True
    return a > b


# ---------------- Notas: limpieza y mezcla (la misma regla que js/notas-core.js) ----------------
NOTA_TEXT_MAX = 2000
NOTA_ITEMS_MAX = 500
EPOCH = parse_dt("1970-01-01T00:00:00Z")


def _stamp(value):
    return parse_dt(value) or EPOCH


def _latest(a, b):
    return a if _stamp(a) >= _stamp(b) else b


def _meta_stamp(nota):
    return _stamp(nota.get("metaAt") or nota.get("updatedAt"))


def clean_nota(incoming):
    """Valida y normaliza una nota que llega del cliente. Lanza BadRequest si no es una nota."""
    if not isinstance(incoming, dict):
        raise BadRequest("Nota no válida.")
    doc = normalize_dates(_clean(incoming))
    doc.pop("ownerId", None)
    stamp = iso(now())
    doc["id"] = str(doc["id"]) if not _blank(doc.get("id")) else short_id("n")
    doc["title"] = str(doc.get("title") or "")[:300]
    doc["text"] = str(doc.get("text") or "")[:20000]
    doc["kind"] = "nota" if doc.get("kind") == "nota" else "lista"
    for flag in ("pinned", "archived", "deleted"):
        doc[flag] = doc.get(flag) is True
    doc["updatedAt"] = doc.get("updatedAt") or stamp
    doc["createdAt"] = doc.get("createdAt") or doc["updatedAt"]
    doc["metaAt"] = doc.get("metaAt") or doc["updatedAt"]
    items, seen = [], set()
    for raw in (doc.get("items") if isinstance(doc.get("items"), list) else [])[:NOTA_ITEMS_MAX]:
        if not isinstance(raw, dict) or _blank(raw.get("id")) or raw["id"] in seen:
            continue
        seen.add(raw["id"])
        item = {"id": str(raw["id"]), "text": str(raw.get("text") or "")[:NOTA_TEXT_MAX], "done": raw.get("done") is True,
                "updatedAt": iso(parse_dt(raw.get("updatedAt"))) or doc["updatedAt"]}
        if raw.get("deleted") is True:
            item["deleted"] = True
        items.append(item)
    doc["items"] = [] if doc["deleted"] else items
    return doc


def merge_nota(existing, incoming):
    """Mezcla dos versiones de la misma nota sin perder cambios hechos en dispositivos distintos.

    - Título, texto, color, fijada, archivada, borrada y el orden: gana la versión con metaAt más reciente.
    - Cada elemento de la lista: gana su versión con updatedAt más reciente (marcar uno en el widget
      no pisa otro que se editó a la vez en la web).
    Con fechas iguales gana la versión guardada.
    """
    win, lose = (incoming, existing) if _meta_stamp(incoming) > _meta_stamp(existing) else (existing, incoming)
    out = {**lose, **win}
    for flag in ("pinned", "archived", "deleted"):
        out[flag] = win.get(flag) is True
    by_id, order = {}, []
    for item in list(win.get("items") or []) + list(lose.get("items") or []):
        current = by_id.get(item.get("id"))
        if current is None:
            by_id[item["id"]] = item
            order.append(item["id"])
        elif _stamp(item.get("updatedAt")) > _stamp(current.get("updatedAt")):
            by_id[item["id"]] = item
    out["items"] = [] if out["deleted"] else [by_id[i] for i in order][:NOTA_ITEMS_MAX]
    out["id"] = existing["id"]
    created = [c for c in (existing.get("createdAt"), incoming.get("createdAt")) if c]
    out["createdAt"] = min(created, key=_stamp) if created else None
    out["updatedAt"] = _latest(existing.get("updatedAt"), incoming.get("updatedAt"))
    out["metaAt"] = win.get("metaAt") or win.get("updatedAt")
    return out


# ---------------- Módulos opcionales (la misma regla que js/modulos-core.js) ----------------
# Hábitos, personas, gastos y energía del día: documentos JSON por colección. El servidor no
# interpreta su contenido; solo los guarda por cuenta y los mezcla entre dispositivos.
MODULO_KINDS = ("habits", "people", "expenses", "energy")
MODULO_DOC_MAX = 40_000       # caracteres del documento serializado
MODULO_DOCS_MAX = 5000        # documentos por colección y cuenta


def clean_modulo_doc(incoming):
    """Valida un documento de módulo. Devuelve None si no se puede guardar."""
    if not isinstance(incoming, dict) or _blank(incoming.get("id")):
        return None
    doc = _clean(incoming)
    doc.pop("ownerId", None)
    doc["id"] = str(doc["id"])[:80]
    doc["updatedAt"] = iso(parse_dt(doc.get("updatedAt"))) or iso(now())
    if doc.get("createdAt") is not None:
        doc["createdAt"] = iso(parse_dt(doc["createdAt"]))
    if doc.get("deleted") is True:
        doc = {"id": doc["id"], "deleted": True, "createdAt": doc.get("createdAt"), "updatedAt": doc["updatedAt"]}
    if "marks" in doc and not isinstance(doc["marks"], dict):
        doc.pop("marks")
    return doc if len(dumps(doc)) <= MODULO_DOC_MAX else None


def merge_marks(a, b):
    """Marcas por día ({fecha: {done, at}}): gana, día a día, la de «at» más reciente."""
    out = dict(a or {})
    for key, mark in (b or {}).items():
        if not isinstance(mark, dict):
            continue
        current = out.get(key)
        if not isinstance(current, dict) or _stamp(mark.get("at")) > _stamp(current.get("at")):
            out[key] = mark
    return out


def merge_modulo_doc(existing, incoming):
    """Gana el documento con updatedAt más reciente (con fechas iguales, el guardado); las marcas se mezclan."""
    win = incoming if _stamp(incoming.get("updatedAt")) > _stamp(existing.get("updatedAt")) else existing
    out = dict(win)
    if "marks" in existing or "marks" in incoming:
        out["marks"] = {} if win.get("deleted") else merge_marks(existing.get("marks"), incoming.get("marks"))
        if win.get("deleted"):
            out.pop("marks")
    return out


def nota_public(doc):
    out = dict(doc)
    out["items"] = [i for i in doc.get("items") or [] if not i.get("deleted")]
    return out


class Store:
    def __init__(self, db):
        self.db = db

    # ---------------- Proyectos ----------------
    def _project_row(self, project_id):
        return self.db.one("SELECT id, owner_id, doc FROM projects WHERE id = ?", (project_id,))

    def _require_project(self, owner, project_id):
        row = self._project_row(project_id)
        if not row or row["owner_id"] != owner:
            raise NotFound(f"Proyecto no encontrado: {project_id}")
        return loads(row["doc"])

    def _project_out(self, doc):
        out = dict(doc)
        out.pop("ownerId", None)
        tasks = [self._task_out(loads(r["doc"]), doc["id"]) for r in
                 self.db.query("SELECT doc FROM tasks WHERE project_id = ? ORDER BY rowid", (doc["id"],))]
        logs = [self._log_out(loads(r["doc"]), doc) for r in
                self.db.query("SELECT doc FROM session_logs WHERE project_id = ? ORDER BY rowid", (doc["id"],))]
        out["tasks"] = tasks
        out["logs"] = logs
        return out

    @staticmethod
    def _task_out(doc, project_id):
        out = dict(doc)
        out["projectId"] = project_id
        return out

    @staticmethod
    def _log_out(doc, project):
        out = dict(doc)
        out.update({"projectId": project["id"], "projectName": project.get("name"),
                    "projectEmoji": project.get("emoji"), "projectColor": project.get("color")})
        return out

    def list_projects(self, owner, status=None):
        docs = [loads(r["doc"]) for r in self.db.query("SELECT doc FROM projects WHERE owner_id = ?", (owner,))]
        if status:
            docs = [d for d in docs if d.get("status") == status]
        docs.sort(key=lambda d: parse_dt(d.get("lastActivity")) or parse_dt("1970-01-01T00:00:00Z"), reverse=True)
        return [self._project_out(d) for d in docs]

    def get_project(self, owner, project_id):
        return self._project_out(self._require_project(owner, project_id))

    def save_project(self, owner, incoming, from_sync=False):
        """Crea (o reemplaza si es del mismo dueño) un proyecto con sus tareas y bitácora.

        Desde la sincronización se respeta el updatedAt del cliente: es la versión con la que se compara después.
        """
        incoming = _clean(incoming)
        project_id = incoming.get("id")
        if _blank(project_id):
            project_id = short_id("p")
        else:
            row = self._project_row(project_id)
            if row and row["owner_id"] != owner:
                project_id = short_id("p")  # id de otra cuenta: no se pisa
        stamp = iso(now())
        with self.db.transaction() as conn:
            row = conn.execute("SELECT doc FROM projects WHERE id = ?", (project_id,)).fetchone()
            doc = loads(row["doc"]) if row else dict(PROJECT_DEFAULTS)
            _copy_non_null(doc, incoming, PROJECT_RESERVED)
            if _blank(doc.get("name")):
                raise BadRequest("El proyecto necesita un nombre.")
            doc["id"] = project_id
            doc.setdefault("createdAt", incoming.get("createdAt") or stamp)
            doc.setdefault("lastActivity", incoming.get("lastActivity") or stamp)
            doc["updatedAt"] = (incoming.get("updatedAt") if from_sync else None) or stamp
            normalize_dates(doc)
            conn.execute("INSERT INTO projects(id, owner_id, doc) VALUES (?, ?, ?) "
                         "ON CONFLICT(id) DO UPDATE SET doc = excluded.doc", (project_id, owner, dumps(doc)))
            for task in incoming.get("tasks") or []:
                if isinstance(task, dict) and not _blank(task.get("title")):
                    self._upsert_task(conn, owner, project_id, task, keep_dates=True)
            for log in incoming.get("logs") or []:
                if isinstance(log, dict):
                    log = normalize_dates(_clean(log))
                    log["id"] = log.get("id") or short_id("l")
                    for k in ("projectId", "projectName", "projectEmoji", "projectColor"):
                        log.pop(k, None)
                    conn.execute("INSERT OR IGNORE INTO session_logs(id, project_id, doc) VALUES (?, ?, ?)",
                                 (log["id"], project_id, dumps(log)))
        return self.get_project(owner, project_id)

    def update_project(self, owner, project_id, data):
        doc = self._require_project(owner, project_id)
        _copy_non_null(doc, _clean(data), PROJECT_RESERVED)
        doc["updatedAt"] = iso(now())
        normalize_dates(doc)
        self.db.execute("UPDATE projects SET doc = ? WHERE id = ?", (dumps(doc), project_id))
        return self.get_project(owner, project_id)

    def delete_project(self, owner, project_id):
        self.db.execute("DELETE FROM projects WHERE id = ? AND owner_id = ?", (project_id, owner))

    def skip_project(self, owner, project_id):
        doc = self._require_project(owner, project_id)
        doc["lastActivity"] = doc["updatedAt"] = iso(now())
        self.db.execute("UPDATE projects SET doc = ? WHERE id = ?", (dumps(doc), project_id))
        return self.get_project(owner, project_id)

    def checkout(self, owner, project_id, req):
        req = req or {}
        if _blank(req.get("achievement")) or _blank(req.get("nextStep")):
            raise BadRequest("Falta lo logrado o el siguiente paso.")
        doc = self._require_project(owner, project_id)
        stamp = iso(now())
        log = {"id": short_id("log"), "date": stamp, "achievement": req["achievement"], "nextStep": req["nextStep"],
               "energy": req.get("energy") or "media", "duration": req.get("duration") or 25}
        doc["nextAction"] = req["nextStep"]
        for key in ("nextActionType", "status", "energy"):
            if req.get(key):
                doc[key] = req[key]
        doc["lastActivity"] = doc["updatedAt"] = stamp
        with self.db.transaction() as conn:
            conn.execute("UPDATE projects SET doc = ? WHERE id = ?", (dumps(doc), project_id))
            conn.execute("INSERT INTO session_logs(id, project_id, doc) VALUES (?, ?, ?)",
                         (log["id"], project_id, dumps(log)))
        return self._log_out(log, doc)

    # ---------------- Tareas ----------------
    def _task_row(self, task_id):
        return self.db.one("SELECT t.id, t.project_id, t.doc, p.owner_id FROM tasks t "
                           "JOIN projects p ON p.id = t.project_id WHERE t.id = ?", (task_id,))

    def _require_task(self, owner, task_id):
        row = self._task_row(task_id)
        if not row or row["owner_id"] != owner:
            raise NotFound(f"Tarea no encontrada: {task_id}")
        return row["project_id"], loads(row["doc"])

    def _count_focus(self, project_id, exclude_id=None):
        count = 0
        for r in self.db.query("SELECT id, doc FROM tasks WHERE project_id = ?", (project_id,)):
            if r["id"] != exclude_id and loads(r["doc"]).get("column") == "enfoco":
                count += 1
        return count

    def _upsert_task(self, conn, owner, project_id, incoming, keep_dates=False):
        incoming = _clean(incoming)
        task_id = incoming.get("id")
        if _blank(task_id):
            task_id = short_id("t")
        row = conn.execute("SELECT t.doc, p.owner_id FROM tasks t JOIN projects p ON p.id = t.project_id "
                           "WHERE t.id = ?", (task_id,)).fetchone()
        if row and row["owner_id"] != owner:
            task_id = short_id("t")
            row = None
        doc = loads(row["doc"]) if row else {"column": "buzon", "effort": "S"}
        _copy_non_null(doc, incoming, TASK_RESERVED)
        doc["id"] = task_id
        stamp = iso(now())
        doc["createdAt"] = doc.get("createdAt") or (incoming.get("createdAt") if keep_dates else None) or stamp
        if not keep_dates or not doc.get("updatedAt"):
            doc["updatedAt"] = stamp
        normalize_dates(doc)
        conn.execute("INSERT INTO tasks(id, project_id, doc) VALUES (?, ?, ?) "
                     "ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, doc = excluded.doc",
                     (task_id, project_id, dumps(doc)))
        return doc

    def list_tasks(self, owner, project_id):
        self._require_project(owner, project_id)
        return [self._task_out(loads(r["doc"]), project_id)
                for r in self.db.query("SELECT doc FROM tasks WHERE project_id = ? ORDER BY rowid", (project_id,))]

    def add_task(self, owner, project_id, task):
        self._require_project(owner, project_id)
        task = _clean(task)
        if _blank(task.get("title")):
            raise BadRequest("La tarea necesita un título.")
        if str(task.get("column") or "").lower() == "enfoco" and self._count_focus(project_id) >= WIP_LIMIT:
            raise BadRequest(WIP_ERROR)
        if task.get("column"):
            task["column"] = str(task["column"]).lower()
        with self.db.transaction() as conn:
            doc = self._upsert_task(conn, owner, project_id, task)
        return self._task_out(doc, project_id)

    def update_task(self, owner, task_id, data):
        project_id, doc = self._require_task(owner, task_id)
        data = _clean(data)
        if not _blank(data.get("title")):
            data["title"] = data["title"].strip()
        else:
            data.pop("title", None)
        if not _blank(data.get("column")):
            target = str(data["column"]).lower()
            if target == "enfoco" and doc.get("column") != "enfoco" and self._count_focus(project_id, task_id) >= WIP_LIMIT:
                raise BadRequest(WIP_ERROR)
            data["column"] = target
        else:
            data.pop("column", None)
        _copy_non_null(doc, data, TASK_RESERVED)
        doc["updatedAt"] = iso(now())
        normalize_dates(doc)
        self.db.execute("UPDATE tasks SET doc = ? WHERE id = ?", (dumps(doc), task_id))
        return self._task_out(doc, project_id)

    def move_task(self, owner, task_id, column):
        if _blank(column):
            raise BadRequest("Falta la columna destino.")
        return self.update_task(owner, task_id, {"column": column})

    def delete_task(self, owner, task_id):
        row = self._task_row(task_id)
        if row and row["owner_id"] == owner:
            self.db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

    # ---------------- Pensadero ----------------
    def _item_row(self, table, item_id):
        return self.db.one(f"SELECT owner_id, doc FROM {table} WHERE id = ?", (item_id,))

    def list_pensadero(self, owner, category=None):
        docs = [loads(r["doc"]) for r in self.db.query("SELECT doc FROM pensadero WHERE owner_id = ?", (owner,))]
        if category:
            docs = [d for d in docs if d.get("category") == category]
        epoch = parse_dt("1970-01-01T00:00:00Z")
        docs.sort(key=lambda d: parse_dt(d.get("createdAt")) or epoch, reverse=True)
        if not category:
            docs.sort(key=lambda d: bool(d.get("isPinned")), reverse=True)
        for d in docs:
            d.pop("ownerId", None)
        return docs

    def add_pensadero(self, owner, payload):
        payload = _clean(payload)
        content = payload.get("content")
        if _blank(content):
            raise BadRequest("El pensamiento está vacío.")
        item_id = payload.get("id")
        if not _blank(item_id):
            row = self._item_row("pensadero", item_id)
            if row and row["owner_id"] == owner:
                return loads(row["doc"])  # reintento del mismo envío: idempotente
            if row:
                item_id = None
        stamp = iso(now())
        doc = {"id": item_id if not _blank(item_id) else short_id("pen"), "content": content.strip(),
               "category": payload.get("category") or "humo_general", "cognitiveWeight": "medio",
               "isPinned": False, "isResolved": False, "createdAt": stamp, "updatedAt": stamp}
        for key in ("amount", "contactName"):
            if not _blank(payload.get(key)):
                doc[key] = str(payload[key])
        self.db.execute("INSERT INTO pensadero(id, owner_id, doc) VALUES (?, ?, ?)", (doc["id"], owner, dumps(doc)))
        return doc

    def update_pensadero(self, owner, item_id, data):
        row = self._item_row("pensadero", item_id)
        if not row or row["owner_id"] != owner:
            raise NotFound(f"Pensamiento no encontrado: {item_id}")
        doc = loads(row["doc"])
        _copy_non_null(doc, _clean(data), ITEM_RESERVED)
        doc["updatedAt"] = iso(now())
        normalize_dates(doc)
        self.db.execute("UPDATE pensadero SET doc = ? WHERE id = ?", (dumps(doc), item_id))
        return doc

    def toggle_pin(self, owner, item_id):
        row = self._item_row("pensadero", item_id)
        if not row or row["owner_id"] != owner:
            raise NotFound(f"Pensamiento no encontrado: {item_id}")
        doc = loads(row["doc"])
        return self.update_pensadero(owner, item_id, {"isPinned": not doc.get("isPinned")})

    def delete_pensadero(self, owner, item_id):
        self.db.execute("DELETE FROM pensadero WHERE id = ? AND owner_id = ?", (item_id, owner))

    # ---------------- Notas y listas de pendientes (tipo Keep) ----------------
    # Una nota borrada se queda como marca (deleted) para que otro dispositivo no la resucite al sincronizar.
    def _nota_doc(self, owner, nota_id):
        row = self._item_row("notas", nota_id)
        if not row or row["owner_id"] != owner:
            raise NotFound(f"Lista no encontrada: {nota_id}")
        doc = loads(row["doc"])
        if doc.get("deleted"):
            raise NotFound(f"Lista no encontrada: {nota_id}")
        return doc

    def _write_nota(self, owner, doc):
        self.db.execute("INSERT INTO notas(id, owner_id, doc) VALUES (?, ?, ?) "
                        "ON CONFLICT(id) DO UPDATE SET doc = excluded.doc", (doc["id"], owner, dumps(doc)))

    def list_notas(self, owner, include_deleted=False):
        """Sin include_deleted: solo notas y elementos vivos, fijadas primero (lo que pintan los widgets)."""
        docs = [loads(r["doc"]) for r in self.db.query("SELECT doc FROM notas WHERE owner_id = ?", (owner,))]
        if include_deleted:
            return docs
        docs = [nota_public(d) for d in docs if not d.get("deleted")]
        docs.sort(key=lambda d: _stamp(d.get("createdAt")), reverse=True)
        docs.sort(key=lambda d: bool(d.get("pinned")), reverse=True)
        return docs

    def save_nota(self, owner, incoming):
        """Crea la nota o la mezcla con la guardada (ver merge_nota). De otra cuenta: se guarda con id nuevo."""
        incoming = clean_nota(incoming)
        with self.db.transaction() as conn:
            row = conn.execute("SELECT owner_id, doc FROM notas WHERE id = ?", (incoming["id"],)).fetchone()
            if row and row["owner_id"] != owner:
                incoming["id"] = short_id("n")
                row = None
            doc = merge_nota(loads(row["doc"]), incoming) if row else incoming
            conn.execute("INSERT INTO notas(id, owner_id, doc) VALUES (?, ?, ?) "
                         "ON CONFLICT(id) DO UPDATE SET doc = excluded.doc", (doc["id"], owner, dumps(doc)))
        return nota_public(doc)

    def delete_nota(self, owner, nota_id):
        row = self._item_row("notas", nota_id)
        if not row or row["owner_id"] != owner:
            return
        doc = loads(row["doc"])
        stamp = iso(now())
        self._write_nota(owner, {"id": nota_id, "deleted": True, "title": "", "items": [],
                                 "createdAt": doc.get("createdAt"), "updatedAt": stamp, "metaAt": stamp})

    def add_nota_item(self, owner, nota_id, body):
        body = body or {}
        text = str(body.get("text") or "").strip()
        if not text:
            raise BadRequest("El pendiente está vacío.")
        with self.db.transaction():
            doc = self._nota_doc(owner, nota_id)
            items = doc.setdefault("items", [])
            item_id = body.get("id") if not _blank(body.get("id")) else short_id("i")
            if not any(i.get("id") == item_id for i in items):  # reintento del mismo envío: idempotente
                stamp = iso(parse_dt(body.get("updatedAt"))) or iso(now())
                items.append({"id": str(item_id), "text": text[:NOTA_TEXT_MAX], "done": False, "updatedAt": stamp})
                doc["kind"] = "lista"
                doc["updatedAt"] = _latest(doc.get("updatedAt"), stamp)
                self._write_nota(owner, doc)
        return nota_public(doc)

    def update_nota_item(self, owner, nota_id, item_id, body):
        body = body or {}
        with self.db.transaction():
            doc = self._nota_doc(owner, nota_id)
            item = next((i for i in doc.get("items") or [] if i.get("id") == item_id and not i.get("deleted")), None)
            if item is None:
                raise NotFound(f"Pendiente no encontrado: {item_id}")
            stamp = iso(parse_dt(body.get("updatedAt"))) or iso(now())
            if _stamp(stamp) >= _stamp(item.get("updatedAt")):  # un cambio más viejo que el guardado no pisa
                if isinstance(body.get("done"), bool):
                    item["done"] = body["done"]
                if not _blank(body.get("text")):
                    item["text"] = str(body["text"]).strip()[:NOTA_TEXT_MAX]
                if body.get("deleted") is True:
                    item["deleted"] = True
                item["updatedAt"] = stamp
                doc["updatedAt"] = _latest(doc.get("updatedAt"), stamp)
                self._write_nota(owner, doc)
        return nota_public(doc)

    # ---------------- Módulos opcionales ----------------
    def list_modulos(self, owner):
        """{colección: [documentos]} con todas las colecciones, incluidas las marcas de borrado."""
        out = {kind: [] for kind in MODULO_KINDS}
        for r in self.db.query("SELECT kind, doc FROM modulos WHERE owner_id = ? ORDER BY rowid", (owner,)):
            if r["kind"] in out:
                out[r["kind"]].append(loads(r["doc"]))
        return out

    def save_modulos(self, owner, incoming):
        """Mezcla lo que manda un dispositivo. Colecciones desconocidas y documentos no válidos se ignoran."""
        if not isinstance(incoming, dict):
            return
        with self.db.transaction() as conn:
            for kind in MODULO_KINDS:
                docs = incoming.get(kind)
                if not isinstance(docs, list):
                    continue
                count = conn.execute("SELECT COUNT(*) AS n FROM modulos WHERE owner_id = ? AND kind = ?", (owner, kind)).fetchone()["n"]
                for raw in docs[:MODULO_DOCS_MAX]:
                    doc = clean_modulo_doc(raw)
                    if doc is None:
                        continue
                    row = conn.execute("SELECT doc FROM modulos WHERE owner_id = ? AND kind = ? AND id = ?",
                                       (owner, kind, doc["id"])).fetchone()
                    if row:
                        doc = merge_modulo_doc(loads(row["doc"]), doc)
                    elif count >= MODULO_DOCS_MAX:
                        continue
                    else:
                        count += 1
                    conn.execute("INSERT INTO modulos(owner_id, kind, id, doc) VALUES (?, ?, ?, ?) "
                                 "ON CONFLICT(owner_id, kind, id) DO UPDATE SET doc = excluded.doc",
                                 (owner, kind, doc["id"], dumps(doc)))

    # ---------------- Sincronización ----------------
    def pull(self, owner):
        inbox = [loads(r["doc"]) for r in self.db.query("SELECT doc FROM inbox WHERE owner_id = ?", (owner,))]
        epoch = parse_dt("1970-01-01T00:00:00Z")
        inbox.sort(key=lambda d: parse_dt(d.get("createdAt")) or epoch, reverse=True)
        return {"projects": self.list_projects(owner), "inbox": inbox, "pensadero": self.list_pensadero(owner),
                "notas": self.list_notas(owner, include_deleted=True), "modulos": self.list_modulos(owner)}

    def push(self, owner, incoming):
        if not isinstance(incoming, dict):
            return self.pull(owner)
        if incoming.get("wipe") is True:
            with self.db.transaction() as conn:
                for table in ("projects", "inbox", "pensadero", "notas", "modulos"):
                    conn.execute(f"DELETE FROM {table} WHERE owner_id = ?", (owner,))
            return self.pull(owner)
        for project in incoming.get("projects") or []:
            if isinstance(project, dict) and project.get("id") not in DEMO_PROJECT_IDS:
                self._merge_project(owner, project)
        for item in incoming.get("inbox") or []:
            if isinstance(item, dict) and not _blank(item.get("id")) and not _blank(item.get("text")):
                doc = normalize_dates(_clean(item))
                doc.pop("ownerId", None)
                self.db.execute("INSERT OR IGNORE INTO inbox(id, owner_id, doc) VALUES (?, ?, ?)",
                                (doc["id"], owner, dumps(doc)))
        for item in incoming.get("pensadero") or []:
            if isinstance(item, dict):
                self._merge_pensadero(owner, item)
        for nota in incoming.get("notas") or []:
            if isinstance(nota, dict) and not _blank(nota.get("id")):
                self.save_nota(owner, nota)
        self.save_modulos(owner, incoming.get("modulos"))
        return self.pull(owner)

    def _merge_project(self, owner, incoming):
        incoming = _clean(incoming)
        project_id = incoming.get("id")
        row = None if _blank(project_id) else self._project_row(project_id)
        if row is None:
            if not _blank(incoming.get("name")):
                self.save_project(owner, incoming, from_sync=True)
            return
        if row["owner_id"] != owner:
            return  # de otra cuenta: no se toca
        existing = loads(row["doc"])
        incoming_stamp = incoming.get("updatedAt") or incoming.get("lastActivity")
        existing_stamp = existing.get("updatedAt") or existing.get("lastActivity")
        newer = _is_newer(incoming_stamp, existing_stamp)
        with self.db.transaction() as conn:
            if newer:
                name = incoming.get("name")
                _copy_non_null(existing, incoming, PROJECT_RESERVED | {"name"})
                if not _blank(name):
                    existing["name"] = name
                normalize_dates(existing)
                conn.execute("UPDATE projects SET doc = ? WHERE id = ?", (dumps(existing), project_id))
            for task in incoming.get("tasks") or []:
                if isinstance(task, dict) and not _blank(task.get("title")):
                    self._merge_task(conn, owner, project_id, task, newer)

    def _merge_task(self, conn, owner, project_id, incoming, project_newer):
        incoming = _clean(incoming)
        task_id = incoming.get("id")
        row = None
        if not _blank(task_id):
            row = conn.execute("SELECT t.doc, t.project_id, p.owner_id FROM tasks t JOIN projects p "
                               "ON p.id = t.project_id WHERE t.id = ?", (task_id,)).fetchone()
        if row is None:
            self._upsert_task(conn, owner, project_id, incoming, keep_dates=True)
            return
        if row["owner_id"] != owner:
            return
        current = loads(row["doc"])
        if not (_is_newer(incoming.get("updatedAt"), current.get("updatedAt"))
                or (incoming.get("updatedAt") is None and project_newer)):
            return
        _copy_non_null(current, incoming, TASK_RESERVED)
        current["dueAt"] = incoming.get("dueAt")  # la versión más nueva manda también para quitar la fecha
        normalize_dates(current)
        # Una tarea movida a otro proyecto del mismo dueño se lleva con ella
        conn.execute("UPDATE tasks SET project_id = ?, doc = ? WHERE id = ?", (project_id, dumps(current), task_id))

    def _merge_pensadero(self, owner, incoming):
        incoming = _clean(incoming)
        if _blank(incoming.get("content")):
            return
        item_id = incoming.get("id")
        if not _blank(item_id) and (item_id.startswith("pens_init_") or item_id.startswith("demo_")):
            return
        row = None if _blank(item_id) else self._item_row("pensadero", item_id)
        if row is None:
            doc = normalize_dates(dict(incoming))
            doc.pop("ownerId", None)
            doc["id"] = item_id if not _blank(item_id) else short_id("pen")
            doc.setdefault("category", "humo_general")
            self.db.execute("INSERT INTO pensadero(id, owner_id, doc) VALUES (?, ?, ?)", (doc["id"], owner, dumps(doc)))
            return
        if row["owner_id"] != owner:
            return
        existing = loads(row["doc"])
        if incoming.get("updatedAt") is None:
            if existing.get("updatedAt") is not None:
                return
        elif not _is_newer(incoming["updatedAt"], existing.get("updatedAt")):
            return
        _copy_non_null(existing, incoming, ITEM_RESERVED)
        normalize_dates(existing)
        self.db.execute("UPDATE pensadero SET doc = ? WHERE id = ?", (dumps(existing), item_id))
