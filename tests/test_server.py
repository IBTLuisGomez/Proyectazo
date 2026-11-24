"""Backend único (server/): contratos de la API, reglas portadas de Spring, sync, push e importación."""
import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

bcrypt = pytest.importorskip("bcrypt")

from server import auth as auth_mod  # noqa: E402
from server.app import Context, build_server  # noqa: E402
from server.db import Database  # noqa: E402
from server.importar_postgres import Importer  # noqa: E402
from server.push import Push  # noqa: E402


class FakeSender:
    def __init__(self):
        self.sent = []
        self.status = 201

    def send(self, sub, payload):
        self.sent.append((sub["endpoint"], json.loads(payload)))
        return self.status


@pytest.fixture()
def api(tmp_path, monkeypatch):
    monkeypatch.setattr(auth_mod, "BCRYPT_COST", 4)  # rápido en tests
    db = Database(str(tmp_path / "t.db"))
    auth_mod.Auth(db).bootstrap_admin("ana", "contraseña-larga", log=lambda *_: None)
    sender = FakeSender()
    push = Push(db, sender=sender, log=lambda *_: None)
    ctx = Context(db, push, "http://localhost:8080")
    httpd = build_server(ctx, host="127.0.0.1", port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    class Client:
        token = None

        def call(self, method, path, body=None, token="__default__", headers=None):
            data = None if body is None else json.dumps(body).encode()
            req = urllib.request.Request(base + path, data=data, method=method)
            req.add_header("Content-Type", "application/json")
            tok = self.token if token == "__default__" else token
            if tok:
                req.add_header("Authorization", f"Bearer {tok}")
            for k, v in (headers or {}).items():
                req.add_header(k, v)
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    raw = r.read()
                    return r.status, (json.loads(raw) if raw else None), r.headers
            except urllib.error.HTTPError as e:
                raw = e.read()
                return e.code, (json.loads(raw) if raw else None), e.headers

        def login(self, user="ana", pw="contraseña-larga"):
            status, body, _ = self.call("POST", "/api/auth/login", {"username": user, "password": pw}, token=None)
            assert status == 200, body
            self.token = body["token"]
            return body

    c = Client()
    c.db, c.sender, c.ctx = db, sender, ctx
    yield c
    httpd.shutdown()


def test_auth_y_401(api):
    assert api.call("GET", "/api/projects", token=None)[0] == 401
    assert api.call("GET", "/api/health", token=None)[0] == 200
    body = api.login()
    assert body["username"] == "ana" and body["expiresAt"] > 0
    assert api.call("GET", "/api/auth/me")[1] == {"username": "ana"}
    assert api.call("POST", "/api/auth/logout")[0] == 204
    assert api.call("GET", "/api/auth/me")[0] == 401


def test_login_limitado_por_ip(api):
    for _ in range(5):
        assert api.call("POST", "/api/auth/login", {"username": "ana", "password": "mal"}, token=None)[0] == 401
    status, body, headers = api.call("POST", "/api/auth/login", {"username": "ana", "password": "contraseña-larga"}, token=None)
    assert status == 429 and headers["Retry-After"] == "60"


def test_cambiar_credenciales_revoca_sesiones(api):
    api.login()
    old = api.token
    status, body, _ = api.call("POST", "/api/auth/credentials", {"currentPassword": "mal", "newPassword": "otra-larga-1"})
    assert status == 400
    status, body, _ = api.call("POST", "/api/auth/credentials", {"currentPassword": "contraseña-larga", "newUsername": "anita", "newPassword": "otra-larga-1"})
    assert status == 200 and body["username"] == "anita"
    assert api.call("GET", "/api/auth/me", token=old)[0] == 401
    api.login("anita", "otra-larga-1")


def test_proyectos_tareas_y_limite_wip(api):
    api.login()
    status, p, _ = api.call("POST", "/api/projects", {"id": "p1", "name": "Tesis", "inBaul": False, "keywords": "tesis"})
    assert status == 201 and p["id"] == "p1" and p["emoji"] == "⚡" and p["tasks"] == []
    assert p["inBaul"] is False  # campos del cliente se conservan
    for i in range(3):
        assert api.call("POST", "/api/projects/p1/tasks", {"id": f"t{i}", "title": f"T{i}", "column": "enfoco"})[0] == 201
    status, err, _ = api.call("POST", "/api/projects/p1/tasks", {"title": "cuarta", "column": "enfoco"})
    assert status == 400 and "Límite" in err["error"]
    status, t, _ = api.call("POST", "/api/projects/p1/tasks", {"id": "t9", "title": "x", "dueAt": "2030-01-02T09:00:00.000Z"})
    assert t["column"] == "buzon" and t["effort"] == "S" and t["projectId"] == "p1"
    assert t["dueAt"] == "2030-01-02T09:00:00.000Z"  # la zona se conserva (Spring la perdía)
    assert api.call("PATCH", "/api/tasks/t9/move", {"column": "enfoco"})[0] == 400
    assert api.call("PATCH", "/api/tasks/t0/move", {"column": "victorias"})[0] == 200
    assert api.call("PATCH", "/api/tasks/t9/move", {"column": "ENFOCO"})[1]["column"] == "enfoco"
    assert api.call("PUT", "/api/tasks/t9", {"title": "  nuevo  ", "notes": "n"})[1]["title"] == "nuevo"
    assert api.call("PUT", "/api/tasks/nope", {"title": "x"})[0] == 404
    assert api.call("DELETE", "/api/tasks/t9")[0] == 204
    assert len(api.call("GET", "/api/projects/p1/tasks")[1]) == 3
    status, log, _ = api.call("POST", "/api/projects/p1/checkout", {"achievement": "algo", "nextStep": "siguiente", "status": "pausado"})
    assert status == 200 and log["projectName"] == "Tesis"
    p = api.call("GET", "/api/projects/p1")[1]
    assert p["nextAction"] == "siguiente" and p["status"] == "pausado" and len(p["logs"]) == 1
    assert api.call("POST", "/api/projects/p1/checkout", {"achievement": ""})[0] == 400
    assert api.call("PUT", "/api/projects/p1", {"name": "Tesis 2", "color": None})[1]["color"] == "#10b981"
    assert api.call("DELETE", "/api/projects/p1")[0] == 204
    assert api.call("GET", "/api/projects/p1")[0] == 404


def test_datos_separados_por_usuario(api):
    api.login()
    api.call("POST", "/api/projects", {"id": "p1", "name": "Mío"})
    api.db.execute("INSERT INTO users(username, password_hash) VALUES ('bea', ?)", (auth_mod.hash_password("clave-de-bea"),))
    api.login("bea", "clave-de-bea")
    assert api.call("GET", "/api/projects")[1] == []
    assert api.call("GET", "/api/projects/p1")[0] == 404
    status, p, _ = api.call("POST", "/api/projects", {"id": "p1", "name": "De Bea"})
    assert p["id"] != "p1"  # un id ajeno no se pisa
    api.call("POST", "/api/sync", {"projects": [{"id": "p1", "name": "Hackeado", "updatedAt": "2099-01-01T00:00:00Z"}]})
    api.login()
    assert api.call("GET", "/api/projects/p1")[1]["name"] == "Mío"


def test_pensadero_respeta_id_del_cliente(api):
    api.login()
    status, item, _ = api.call("POST", "/api/pensadero", {"id": "local-1", "content": " pan ", "category": "humo_verde", "amount": 3})
    assert status == 201 and item["id"] == "local-1" and item["content"] == "pan" and item["amount"] == "3"
    assert api.call("POST", "/api/pensadero", {"id": "local-1", "content": "pan"})[1]["id"] == "local-1"  # idempotente
    assert api.call("POST", "/api/pensadero", {"content": "  "})[0] == 400
    assert api.call("PATCH", "/api/pensadero/local-1/pin")[1]["isPinned"] is True
    assert api.call("PUT", "/api/pensadero/local-1", {"isResolved": True})[1]["isResolved"] is True
    assert len(api.call("GET", "/api/pensadero")[1]) == 1
    assert api.call("DELETE", "/api/pensadero/local-1")[0] == 204


def test_sync_gana_lo_mas_nuevo_y_conserva_campos(api):
    api.login()
    first = {"projects": [{"id": "p1", "name": "A", "updatedAt": "2026-01-01T10:00:00Z",
                           "tasks": [{"id": "t1", "title": "x", "updatedAt": "2026-01-01T10:00:00Z", "dueAt": "2026-02-01T09:00:00Z"}]}],
             "pensadero": [{"id": "n1", "content": "idea", "category": "humo_dorado", "updatedAt": "2026-01-01T10:00:00Z",
                            "inBaul": True, "hibernatedUntil": 1893456000000},
                           {"id": "demo_1", "content": "demo"}],
             "inbox": [{"id": "i1", "text": "algo"}]}
    data = api.call("POST", "/api/sync", first)[1]
    assert [p["id"] for p in data["projects"]] == ["p1"]
    n1 = data["pensadero"][0]
    assert n1["inBaul"] is True and n1["hibernatedUntil"] == 1893456000000  # Spring los descartaba
    assert len(data["pensadero"]) == 1 and data["inbox"][0]["text"] == "algo"
    # Versión vieja: no pisa
    old = {"projects": [{"id": "p1", "name": "VIEJO", "updatedAt": "2025-01-01T00:00:00Z",
                         "tasks": [{"id": "t1", "title": "viejo", "updatedAt": "2025-01-01T00:00:00Z"}]}],
           "pensadero": [{"id": "n1", "content": "vieja", "updatedAt": "2025-01-01T00:00:00Z"}]}
    data = api.call("POST", "/api/sync", old)[1]
    assert data["projects"][0]["name"] == "A" and data["projects"][0]["tasks"][0]["title"] == "x"
    assert data["pensadero"][0]["content"] == "idea"
    # Versión nueva: pisa y puede quitar la fecha
    new = {"projects": [{"id": "p1", "name": "B", "updatedAt": "2026-03-01T00:00:00Z",
                         "tasks": [{"id": "t1", "title": "y", "updatedAt": "2026-03-01T00:00:00Z", "dueAt": None}]}]}
    data = api.call("POST", "/api/sync", new)[1]
    task = data["projects"][0]["tasks"][0]
    assert data["projects"][0]["name"] == "B" and task["title"] == "y" and task["dueAt"] is None
    assert api.call("POST", "/api/sync", {"wipe": True})[0] == 428  # sin confirmación no se borra nada
    assert api.call("GET", "/api/sync")[1]["projects"]
    status, data, _ = api.call("POST", "/api/sync", {"wipe": True}, headers={"X-Confirm-Wipe": "BORRAR-TODO"})
    assert data == {"projects": [], "inbox": [], "pensadero": [], "notas": []}


def test_push_un_aviso_por_tarea_y_envio(api):
    api.login()
    assert api.call("GET", "/api/push/public-key")[1]["devices"] == 0
    assert api.call("POST", "/api/push/subscribe", {"endpoint": "http://inseguro", "keys": {"p256dh": "a", "auth": "b"}})[0] == 400
    assert api.call("POST", "/api/push/subscribe", {"endpoint": "https://push.example/1", "keys": {"p256dh": "a", "auth": "b"}})[1]["devices"] == 1
    for when in (4102444800000, 4102448400000):  # 2100: demasiado lejos
        assert api.call("POST", "/api/push/reminders", {"title": "x", "taskId": "t1", "sendAt": when})[0] == 400
    from datetime import datetime, timedelta, timezone
    soon = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp() * 1000)
    later = soon + 3600_000
    assert api.call("POST", "/api/push/reminders", {"title": "Banco", "taskId": "t1", "sendAt": soon})[0] == 201
    r = api.call("POST", "/api/push/reminders", {"title": "Banco", "taskId": "t1", "sendAt": later})[1]
    pending = api.call("GET", "/api/push/reminders")[1]
    assert len(pending) == 1 and pending[0]["sendAt"] == later  # se movió, no se duplicó
    past = int((datetime.now(timezone.utc) - timedelta(minutes=1)).timestamp() * 1000)
    api.call("POST", "/api/push/reminders", {"title": "Ya", "sendAt": past})
    assert api.ctx.push.dispatch_due() == 1
    assert api.sender.sent[-1][1]["title"] == "⏰ Ya"
    api.sender.status = 410
    api.call("POST", "/api/push/test")
    assert api.call("GET", "/api/push/public-key")[1]["devices"] == 0  # caducada: borrada
    assert api.call("DELETE", f"/api/push/reminders/{r['id']}")[0] == 204


def test_ia_exige_sesion_y_cors_con_lista_blanca(api):
    assert api.call("POST", "/api/nexus/jarvis", {"messages": []}, token=None)[0] == 401
    assert api.call("GET", "/api/nexus/health", token=None)[0] == 200
    _, _, h = api.call("GET", "/api/health", token=None, headers={"Origin": "https://malo.example"})
    assert h.get("Access-Control-Allow-Origin") is None
    _, _, h = api.call("GET", "/api/health", token=None, headers={"Origin": "http://localhost:8080"})
    assert h["Access-Control-Allow-Origin"] == "http://localhost:8080"
    api.login()
    status, body, _ = api.call("POST", "/api/nexus/jarvis", {"messages": [{"role": "user", "content": "hola"}]})
    assert status == 200 and "provider" in body


def test_importa_export_de_postgres(tmp_path, monkeypatch):
    monkeypatch.setattr(auth_mod, "BCRYPT_COST", 4)
    spring_hash = bcrypt.hashpw(b"clave-antigua", bcrypt.gensalt(4, prefix=b"2a")).decode()
    rows = {
        "app_users": [{"id": 1, "username": "ana", "password_hash": spring_hash, "created_at": "2026-10-01T10:00:00"}],
        "projects": [{"id": "p1", "owner_id": None, "name": "Tesis", "emoji": "📚", "status": "activo",
                      "next_action": "leer", "next_action_type": "hacer", "last_activity": "2026-10-20T08:00:00.123456",
                      "updated_at": "2026-10-20T08:00:00"}],
        "tasks": [{"id": "t1", "project_id": "p1", "title": "Leer", "column_key": "enfoco", "effort": "M",
                   "is_micro_step": True, "due_at": "2026-10-22T09:00:00"},
                  {"id": "t2", "project_id": "huérfano", "title": "x", "column_key": "buzon"}],
        "pensadero_items": [{"id": "n1", "owner_id": 1, "content": "idea", "category": "humo_dorado", "is_pinned": False}],
        "app_settings": [{"setting_key": "vapid.public", "setting_value": "PUB"}, {"setting_key": "vapid.private", "setting_value": "PRIV"}],
    }
    folder = tmp_path / "export"
    folder.mkdir()
    for table, items in rows.items():
        (folder / f"{table}.jsonl").write_text("\n".join(json.dumps(r) for r in items), encoding="utf-8")
    db = Database(str(tmp_path / "n.db"))
    counts = Importer(db).run(str(folder))
    assert counts["proyectos"] == 1 and counts["tareas"] == 1  # la tarea huérfana se omite
    from server.store import Store
    p = Store(db).get_project(1, "p1")  # sin dueño → primer usuario
    assert p["nextActionType"] == "hacer" and p["lastActivity"] == "2026-10-20T08:00:00.123Z"
    t = p["tasks"][0]
    assert t["column"] == "enfoco" and t["isMicroStep"] is True and t["dueAt"] == "2026-10-22T09:00:00.000Z"
    assert auth_mod.Auth(db).login("ana", "clave-antigua")  # el hash de Spring sigue valiendo
    assert db.get_setting("vapid.public") == "PUB"
    db2 = Database(str(tmp_path / "n2.db"))
    Importer(db2, tz="America/Mexico_City").run(str(folder)) if _has_tz("America/Mexico_City") else None


def _has_tz(name):
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(name)
        return True
    except Exception:
        return False


def test_importa_esquema_antiguo_sin_usuarios(tmp_path, monkeypatch):
    monkeypatch.setattr(auth_mod, "BCRYPT_COST", 4)
    monkeypatch.setenv("NEXUS_ADMIN_USER", "fer")
    monkeypatch.setenv("NEXUS_ADMIN_PASSWORD", "una-clave-larga")
    folder = tmp_path / "export"
    folder.mkdir()
    (folder / "pensadero_items.jsonl").write_text(json.dumps(
        {"id": "x1", "content": "idea", "category": "humo_dorado", "is_pinned": False, "created_at": "2026-10-18T08:03:18.682846"}),
        encoding="utf-8")
    db = Database(str(tmp_path / "n.db"))
    counts = Importer(db, log=lambda *_: None).run(str(folder))
    assert counts["pensamientos"] == 1
    from server.store import Store
    owner = db.one("SELECT id FROM users WHERE username = 'fer'")["id"]
    item = Store(db).list_pensadero(owner)[0]
    assert item["createdAt"] == "2026-10-18T08:03:18.682Z" and item["isPinned"] is False

# ---------------- Listas y notas (tipo Keep) ----------------
T1, T2, T3 = "2026-01-01T10:00:00.000Z", "2026-01-01T11:00:00.000Z", "2026-01-01T12:00:00.000Z"


def _lista(**extra):
    nota = {"id": "n1", "kind": "lista", "title": "Compras", "createdAt": T1, "updatedAt": T1, "metaAt": T1,
            "items": [{"id": "a", "text": "Pan", "done": False, "updatedAt": T1},
                      {"id": "b", "text": "Leche", "done": False, "updatedAt": T1}]}
    nota.update(extra)
    return nota


def test_notas_sync_y_mezcla_por_elemento(api):
    api.login()
    status, data, _ = api.call("POST", "/api/sync", {"notas": [_lista()]})
    assert status == 200 and [n["id"] for n in data["notas"]] == ["n1"]
    # Otro dispositivo marca «Leche» (más nuevo) con el título viejo; la web había cambiado título y «Pan»
    web = _lista(title="Compras del sábado", metaAt=T2, updatedAt=T2)
    web["items"][0] = {"id": "a", "text": "Pan integral", "done": False, "updatedAt": T2}
    api.call("POST", "/api/sync", {"notas": [web]})
    widget = _lista(updatedAt=T3)
    widget["items"][1] = {"id": "b", "text": "Leche", "done": True, "updatedAt": T3}
    nota = api.call("POST", "/api/sync", {"notas": [widget]})[1]["notas"][0]
    assert nota["title"] == "Compras del sábado" and nota["updatedAt"] == T3
    assert [(i["text"], i["done"]) for i in nota["items"]] == [("Pan integral", False), ("Leche", True)]
    # Una copia vieja no deshace nada
    nota = api.call("POST", "/api/sync", {"notas": [_lista()]})[1]["notas"][0]
    assert nota["title"] == "Compras del sábado" and nota["items"][1]["done"] is True


def test_notas_api_del_widget(api):
    api.login()
    assert api.call("GET", "/api/notas", token=None)[0] == 401
    status, nota, _ = api.call("POST", "/api/notas", {"id": "n1", "title": "Pendientes", "items": [{"id": "a", "text": "Pan"}]})
    assert status == 201 and nota["kind"] == "lista" and nota["items"][0]["done"] is False and nota["createdAt"]
    status, nota, _ = api.call("POST", "/api/notas/n1/items", {"id": "b", "text": "  Leche  "})
    assert status == 201 and [i["text"] for i in nota["items"]] == ["Pan", "Leche"]
    # Reintento del mismo envío (el widget sin cobertura): no duplica
    assert len(api.call("POST", "/api/notas/n1/items", {"id": "b", "text": "Leche"})[1]["items"]) == 2
    assert api.call("POST", "/api/notas/n1/items", {"text": "  "})[0] == 400
    assert api.call("POST", "/api/notas/nope/items", {"text": "x"})[0] == 404
    status, nota, _ = api.call("PUT", "/api/notas/n1/items/a", {"done": True})
    assert status == 200 and nota["items"][0]["done"] is True
    # Un cambio con fecha anterior a la guardada no pisa
    assert api.call("PUT", "/api/notas/n1/items/a", {"done": False, "updatedAt": T1})[1]["items"][0]["done"] is True
    assert api.call("PUT", "/api/notas/n1/items/zzz", {"done": True})[0] == 404
    # Quitar un elemento: desaparece de la API pero queda la marca para la sincronización
    assert [i["id"] for i in api.call("PUT", "/api/notas/n1/items/b", {"deleted": True})[1]["items"]] == ["a"]
    synced = api.call("GET", "/api/sync")[1]["notas"][0]
    assert [(i["id"], i.get("deleted", False)) for i in synced["items"]] == [("a", False), ("b", True)]
    # Fijadas primero
    api.call("POST", "/api/notas", {"id": "n2", "title": "Fijada", "pinned": True, "createdAt": T1})
    assert [n["id"] for n in api.call("GET", "/api/notas")[1]] == ["n2", "n1"]


def test_notas_borradas_no_resucitan(api):
    api.login()
    api.call("POST", "/api/sync", {"notas": [_lista()]})
    assert api.call("DELETE", "/api/notas/n1")[0] == 204
    assert api.call("GET", "/api/notas")[1] == []
    assert api.call("POST", "/api/notas/n1/items", {"text": "x"})[0] == 404
    # Un dispositivo que aún la tiene la reenvía: sigue borrada, y recibe la marca para borrarla también
    notas = api.call("POST", "/api/sync", {"notas": [_lista(updatedAt=T3)]})[1]["notas"]
    assert notas[0]["deleted"] is True and notas[0]["items"] == []
    # Deshacer el borrado (versión más nueva que la marca) sí la devuelve
    futuro = "2999-01-01T00:00:00.000Z"
    api.call("POST", "/api/sync", {"notas": [_lista(updatedAt=futuro, metaAt=futuro)]})
    assert [n["title"] for n in api.call("GET", "/api/notas")[1]] == ["Compras"]


def test_notas_separadas_por_usuario_y_borrado_total(api):
    api.login()
    api.call("POST", "/api/sync", {"notas": [_lista()]})
    api.db.execute("INSERT INTO users(username, password_hash) VALUES ('bea', ?)", (auth_mod.hash_password("clave-de-bea"),))
    ana = api.token
    api.login("bea", "clave-de-bea")
    assert api.call("GET", "/api/notas")[1] == []
    assert api.call("PUT", "/api/notas/n1/items/a", {"done": True})[0] == 404
    # El mismo id desde otra cuenta no pisa la nota ajena: se guarda aparte
    mine = api.call("POST", "/api/notas", _lista(title="De Bea"))[1]
    assert mine["id"] != "n1"
    api.token = ana
    assert [n["title"] for n in api.call("GET", "/api/notas")[1]] == ["Compras"]
    api.call("POST", "/api/sync", {"wipe": True}, headers={"X-Confirm-Wipe": "BORRAR-TODO"})
    assert api.call("GET", "/api/sync")[1]["notas"] == []


def test_errores_del_cliente(api):
    assert api.call("POST", "/api/client-errors", {"message": "x"}, token=None)[0] == 401
    api.login()
    status, body, _ = api.call("POST", "/api/client-errors", {"message": "Cannot read properties of null", "source": "js/app.js",
                                                              "line": 12, "view": "notas", "version": "v3.16"})
    assert status == 202 and body == {"stored": True}
    assert api.call("POST", "/api/client-errors", {"stack": "sin mensaje"})[1] == {"stored": False}
    rows = api.call("GET", "/api/client-errors")[1]
    assert len(rows) == 1 and rows[0]["message"].startswith("Cannot read") and rows[0]["view"] == "notas"
