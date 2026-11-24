"""Servidor HTTP único: API de la app (/api/*, antes Spring Boot) + IA y Jarvis (/api/nexus/*, antes Nexus).

Mismos contratos JSON que el backend Spring para que el frontend no cambie. Autenticación por
«Authorization: Bearer <token>»; sin cookies, por eso no aplica CSRF.
"""
import json
import os
import re
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import nexus_service

from .auth import Auth, AuthError, LoginRateLimiter
from .db import Database
from .push import Push
from .store import BadRequest, NotFound, Store

MAX_BODY = 2 * 1024 * 1024
NEXUS_PREFIXES = ("/api/nexus/", "/nexus/")
PUBLIC_NEXUS = {"/api/nexus/health", "/nexus/health", "/health", ""}
WIPE_CONFIRMATION = "BORRAR-TODO"  # cabecera X-Confirm-Wipe obligatoria para el borrado total
DEFAULT_ORIGINS = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://localhost:3000,null"


class HttpError(Exception):
    def __init__(self, status, message=None):
        super().__init__(message)
        self.status = status
        self.message = message


class Context:
    """Estado compartido del servidor (se inyecta en el manejador)."""

    def __init__(self, db, push, allowed_origins):
        self.db = db
        self.store = Store(db)
        self.auth = Auth(db)
        self.push = push
        self.limiter = LoginRateLimiter()
        self.allowed_origins = {o.strip() for o in allowed_origins.split(",") if o.strip()}


ROUTES = []


def route(method, pattern, public=False):
    regex = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "$")

    def deco(fn):
        ROUTES.append((method, regex, fn, public))
        return fn
    return deco


# ---------------- Rutas ----------------
@route("GET", "/actuator/health", public=True)
@route("GET", "/api/health", public=True)
def health(h, **_):
    return 200, {"status": "UP"}


@route("POST", "/api/auth/login", public=True)
def login(h, body, **_):
    ip = h.client_ip()
    if h.ctx.limiter.is_blocked(ip):
        return 429, {"error": "Demasiados intentos. Espera un minuto y vuelve a probar."}, {"Retry-After": "60"}
    issued = h.ctx.auth.login(body.get("username"), body.get("password"), body.get("remember") is not False)
    if not issued:
        h.ctx.limiter.record_failure(ip)
        return 401, {"error": "Usuario o contraseña incorrectos."}
    h.ctx.limiter.reset(ip)
    return 200, issued


@route("GET", "/api/auth/me")
def me(h, user, **_):
    return 200, {"username": user["username"]}


@route("POST", "/api/auth/logout")
def logout(h, **_):
    h.ctx.auth.logout(h.bearer())
    return 204, None


@route("POST", "/api/auth/credentials")
def credentials(h, user, body, **_):
    try:
        return 200, h.ctx.auth.change_credentials(user, body.get("currentPassword"), body.get("newUsername"),
                                                  body.get("newPassword"))
    except AuthError as e:
        return 400, {"error": str(e)}


@route("GET", "/api/sync")
def sync_pull(h, user, **_):
    return 200, h.ctx.store.pull(user["id"])


@route("POST", "/api/sync")
def sync_push(h, user, body, **_):
    if body.get("wipe") is True and h.headers.get("X-Confirm-Wipe") != WIPE_CONFIRMATION:
        return 428, {"error": f"El borrado total requiere la cabecera X-Confirm-Wipe: {WIPE_CONFIRMATION}"}
    return 200, h.ctx.store.push(user["id"], body)


@route("GET", "/api/projects")
def projects_list(h, user, query, **_):
    return 200, h.ctx.store.list_projects(user["id"], (query.get("status") or [None])[0])


@route("GET", "/api/projects/{id}")
def projects_get(h, user, id, **_):
    return 200, h.ctx.store.get_project(user["id"], id)


@route("POST", "/api/projects")
def projects_create(h, user, body, **_):
    return 201, h.ctx.store.save_project(user["id"], body)


@route("PUT", "/api/projects/{id}")
def projects_update(h, user, id, body, **_):
    return 200, h.ctx.store.update_project(user["id"], id, body)


@route("DELETE", "/api/projects/{id}")
def projects_delete(h, user, id, **_):
    h.ctx.store.delete_project(user["id"], id)
    return 204, None


@route("POST", "/api/projects/{id}/skip")
def projects_skip(h, user, id, **_):
    return 200, h.ctx.store.skip_project(user["id"], id)


@route("POST", "/api/projects/{id}/checkout")
def projects_checkout(h, user, id, body, **_):
    return 200, h.ctx.store.checkout(user["id"], id, body)


@route("GET", "/api/projects/{id}/tasks")
def tasks_list(h, user, id, **_):
    return 200, h.ctx.store.list_tasks(user["id"], id)


@route("POST", "/api/projects/{id}/tasks")
def tasks_create(h, user, id, body, **_):
    return 201, h.ctx.store.add_task(user["id"], id, body)


@route("PUT", "/api/tasks/{id}")
def tasks_update(h, user, id, body, **_):
    return 200, h.ctx.store.update_task(user["id"], id, body)


@route("PATCH", "/api/tasks/{id}/move")
def tasks_move(h, user, id, body, **_):
    return 200, h.ctx.store.move_task(user["id"], id, body.get("column"))


@route("DELETE", "/api/tasks/{id}")
def tasks_delete(h, user, id, **_):
    h.ctx.store.delete_task(user["id"], id)
    return 204, None


@route("GET", "/api/pensadero")
def pensadero_list(h, user, query, **_):
    return 200, h.ctx.store.list_pensadero(user["id"], (query.get("category") or [None])[0])


@route("POST", "/api/pensadero")
def pensadero_create(h, user, body, **_):
    return 201, h.ctx.store.add_pensadero(user["id"], body)


@route("PUT", "/api/pensadero/{id}")
def pensadero_update(h, user, id, body, **_):
    return 200, h.ctx.store.update_pensadero(user["id"], id, body)


@route("PATCH", "/api/pensadero/{id}/pin")
def pensadero_pin(h, user, id, **_):
    return 200, h.ctx.store.toggle_pin(user["id"], id)


@route("DELETE", "/api/pensadero/{id}")
def pensadero_delete(h, user, id, **_):
    h.ctx.store.delete_pensadero(user["id"], id)
    return 204, None


# Notas y listas de pendientes (tipo Keep). La app web las sincroniza por /api/sync;
# estas rutas las usan los widgets de Android (solo GET, POST y PUT: HttpURLConnection no admite PATCH).
@route("GET", "/api/notas")
def notas_list(h, user, **_):
    return 200, h.ctx.store.list_notas(user["id"])


@route("POST", "/api/notas")
def notas_save(h, user, body, **_):
    return 201, h.ctx.store.save_nota(user["id"], body)


@route("DELETE", "/api/notas/{id}")
def notas_delete(h, user, id, **_):
    h.ctx.store.delete_nota(user["id"], id)
    return 204, None


@route("POST", "/api/notas/{id}/items")
def notas_item_add(h, user, id, body, **_):
    return 201, h.ctx.store.add_nota_item(user["id"], id, body)


@route("PUT", "/api/notas/{id}/items/{item}")
def notas_item_update(h, user, id, item, body, **_):
    return 200, h.ctx.store.update_nota_item(user["id"], id, item, body)


@route("GET", "/api/push/public-key")
def push_key(h, user, **_):
    if not h.ctx.push.enabled:
        return 503, {"error": "Web Push no está disponible en el servidor."}
    return 200, {"publicKey": h.ctx.push.public_key, "devices": h.ctx.push.count(user["id"])}


@route("POST", "/api/push/subscribe")
def push_subscribe(h, user, body, **_):
    keys = body.get("keys") or {}
    try:
        h.ctx.push.subscribe(user["id"], body.get("endpoint"), keys.get("p256dh"), keys.get("auth"))
    except ValueError as e:
        return 400, {"error": str(e)}
    return 200, {"devices": h.ctx.push.count(user["id"])}


@route("POST", "/api/push/unsubscribe")
def push_unsubscribe(h, user, body, **_):
    h.ctx.push.unsubscribe(user["id"], body.get("endpoint"))
    return 200, {"devices": h.ctx.push.count(user["id"])}


@route("POST", "/api/push/test")
def push_test(h, user, **_):
    delivered = h.ctx.push.send_to_user(user["id"], "🔔 Nexus Orb",
                                        "Los avisos con la app cerrada funcionan en este dispositivo.", "./index.html")
    return 200, {"delivered": delivered}


@route("POST", "/api/push/reminders")
def push_schedule(h, user, body, **_):
    try:
        return 201, h.ctx.push.schedule(user["id"], body.get("title"), body.get("body"), body.get("taskId"), body.get("sendAt"))
    except ValueError as e:
        return 400, {"error": str(e)}


@route("GET", "/api/push/reminders")
def push_pending(h, user, **_):
    return 200, h.ctx.push.pending(user["id"])


@route("DELETE", "/api/push/reminders/{id}")
def push_cancel(h, user, id, **_):
    if not id.isdigit():
        return 404, None
    return (204, None) if h.ctx.push.cancel(user["id"], int(id)) else (404, None)


# ---------------- Manejador ----------------
class AppHandler(nexus_service.NexusRequestHandler):
    ctx = None  # Context, asignado al crear el servidor
    server_version = "NexusOrb"
    sys_version = ""

    # CORS: lista blanca (antes, Nexus respondía «*»)
    def _send_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin and origin in self.ctx.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Confirm-Wipe")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store")

    def log_message(self, fmt, *args):  # sin tokens ni cuerpos en el log
        pass

    def bearer(self):
        header = self.headers.get("Authorization") or ""
        return header[7:].strip() if header.startswith("Bearer ") else None

    def client_ip(self):
        # nginx pone X-Real-IP; sin proxy, la dirección del socket
        return self.headers.get("X-Real-IP") or self.client_address[0]

    def _send_json(self, status, body, extra_headers=None):
        self.send_response(status)
        self._send_cors_headers()
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        if body is None:
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _is_nexus(self, path):
        return path.startswith(NEXUS_PREFIXES) or path in ("/health", "")

    def _dispatch(self, method):
        parts = urlsplit(self.path)
        path = parts.path.rstrip("/") if parts.path != "/" else ""
        if self._is_nexus(path):
            # IA y Jarvis: ahora exigen sesión también sin nginx (antes el puerto 8002 quedaba abierto)
            if path not in PUBLIC_NEXUS and method != "OPTIONS" and not self.ctx.auth.resolve(self.bearer()):
                return self._send_json(401, None)
            handler = getattr(nexus_service.NexusRequestHandler, f"do_{method}", None)
            return handler(self) if handler else self._send_json(405, {"error": "Método no permitido."})
        if method == "OPTIONS":
            self.send_response(204)
            self._send_cors_headers()
            self.send_header("Content-Length", "0")
            return self.end_headers()
        try:
            self._handle_api(method, path, parse_qs(parts.query))
        except HttpError as e:
            self._send_json(e.status, {"error": e.message} if e.message else None)
        except NotFound as e:
            self._send_json(404, {"error": str(e)})
        except BadRequest as e:
            self._send_json(400, {"error": str(e)})
        except Exception as e:  # nunca filtrar trazas al cliente
            print(f"[API] Error en {method} {path}: {type(e).__name__}: {e}")
            self._send_json(500, {"error": "Error interno del servidor."})

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > MAX_BODY:
            raise HttpError(413, "Petición demasiado grande (máx. 2 MB).")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise HttpError(400, "JSON no válido.")
        return body if isinstance(body, dict) else {}

    def _handle_api(self, method, path, query):
        for m, regex, fn, public in ROUTES:
            if m != method:
                continue
            match = regex.match(path)
            if not match:
                continue
            user = None
            if not public:
                user = self.ctx.auth.resolve(self.bearer())
                if not user:
                    raise HttpError(401)
            body = self._read_json() if method in ("POST", "PUT", "PATCH") else {}
            result = fn(self, user=user, body=body, query=query, **match.groupdict())
            status, payload = result[0], result[1]
            return self._send_json(status, payload, result[2] if len(result) > 2 else None)
        raise HttpError(404, "Ruta no encontrada.")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_PATCH(self):
        self._dispatch("PATCH")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_OPTIONS(self):
        self._dispatch("OPTIONS")

    def do_HEAD(self):
        self._dispatch("HEAD") if self._is_nexus(urlsplit(self.path).path.rstrip("/")) else self._send_json(200, None)


def build_server(ctx, host="", port=8081):
    handler = type("BoundAppHandler", (AppHandler,), {"ctx": ctx})
    return ThreadingHTTPServer((host, port), handler)


def create_context_from_env():
    db = Database(os.getenv("NEXUS_DB_PATH", os.path.join("data", "nexus.db")))
    Auth(db).bootstrap_admin(os.getenv("NEXUS_ADMIN_USER", "admin"), os.getenv("NEXUS_ADMIN_PASSWORD", ""))
    push = Push(db, os.getenv("NEXUS_VAPID_PUBLIC_KEY") or None, os.getenv("NEXUS_VAPID_PRIVATE_KEY") or None,
                os.getenv("NEXUS_PUSH_SUBJECT", "mailto:admin@localhost"))
    return Context(db, push, os.getenv("CORS_ALLOWED_ORIGINS", DEFAULT_ORIGINS))


def main():
    ctx = create_context_from_env()
    if ctx.push.enabled:
        ctx.push.start_scheduler()
    port = int(os.getenv("PORT", "8081"))
    httpd = build_server(ctx, port=port)
    print(f"[Nexus Orb] Servidor único escuchando en http://0.0.0.0:{port} (API + IA)")
    httpd.serve_forever()
