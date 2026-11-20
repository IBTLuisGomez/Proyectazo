"""Usuarios y sesiones. Compatible con lo que guardaba Spring:
contraseñas BCrypt ($2a$/$2b$, coste 12) y tokens opacos guardados como SHA-256.
"""
import hashlib
import secrets
import threading
import time
from collections import deque
from datetime import timedelta

import bcrypt

from .db import iso, now, parse_dt

MIN_PASSWORD_LENGTH = 8
BCRYPT_COST = 12


def sha256(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_COST)).decode("ascii")


def check_password(password, password_hash):
    if not password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


class AuthError(Exception):
    pass


class Auth:
    def __init__(self, db):
        self.db = db

    def bootstrap_admin(self, username, password, log=print):
        """Crea el usuario inicial si no hay ninguno. Sin contraseña válida genera una temporal y la muestra en el log."""
        if self.db.one("SELECT 1 FROM users LIMIT 1"):
            return
        user = (username or "").strip() or "admin"
        generated = not password or len(password) < MIN_PASSWORD_LENGTH
        if generated:
            password = secrets.token_urlsafe(12)
        self.db.execute("INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
                        (user, hash_password(password), iso(now())))
        if generated:
            log("=" * 58)
            log(f" Usuario inicial creado: '{user}'  contraseña temporal: {password}")
            log(" Cámbiala desde Ajustes o define NEXUS_ADMIN_PASSWORD.")
            log("=" * 58)
        else:
            log(f"Usuario inicial '{user}' creado desde NEXUS_ADMIN_PASSWORD.")

    def login(self, username, password, remember=True):
        if not username or not password:
            return None
        row = self.db.one("SELECT id, username, password_hash FROM users WHERE username = ?", (username.strip(),))
        if not row or not check_password(password, row["password_hash"]):
            return None
        self.db.execute("DELETE FROM tokens WHERE expires_at < ?", (iso(now()),))
        return self._issue(row["id"], row["username"], 30 if remember else 7)

    def _issue(self, user_id, username, days):
        raw = secrets.token_urlsafe(32)
        expires = now() + timedelta(days=days)
        self.db.execute("INSERT INTO tokens(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                        (sha256(raw), user_id, iso(expires), iso(now())))
        return {"token": raw, "username": username, "expiresAt": int(expires.timestamp() * 1000)}

    def resolve(self, raw_token):
        """Devuelve {'id', 'username'} del dueño de un token vigente, o None."""
        if not raw_token:
            return None
        row = self.db.one("SELECT u.id, u.username, t.expires_at FROM tokens t JOIN users u ON u.id = t.user_id "
                          "WHERE t.token_hash = ?", (sha256(raw_token),))
        if not row:
            return None
        expires = parse_dt(row["expires_at"])
        if expires is None or expires <= now():
            return None
        return {"id": row["id"], "username": row["username"]}

    def logout(self, raw_token):
        if raw_token:
            self.db.execute("DELETE FROM tokens WHERE token_hash = ?", (sha256(raw_token),))

    def change_credentials(self, user, current_password, new_username, new_password):
        row = self.db.one("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
        if not row or not check_password(current_password or "", row["password_hash"]):
            raise AuthError("La contraseña actual no coincide.")
        username = user["username"]
        if new_username and new_username.strip():
            username = new_username.strip()
            if len(username) < 2:
                raise AuthError("El usuario debe tener al menos 2 caracteres.")
            other = self.db.one("SELECT id FROM users WHERE username = ?", (username,))
            if other and other["id"] != user["id"]:
                raise AuthError("Ese nombre de usuario ya existe.")
        password_hash = row["password_hash"]
        if new_password:
            if len(new_password) < MIN_PASSWORD_LENGTH:
                raise AuthError(f"La nueva contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
            password_hash = hash_password(new_password)
        with self.db.transaction() as conn:
            conn.execute("UPDATE users SET username = ?, password_hash = ? WHERE id = ?", (username, password_hash, user["id"]))
            conn.execute("DELETE FROM tokens WHERE user_id = ?", (user["id"],))  # revoca todas las sesiones
        return self._issue(user["id"], username, 30)


class LoginRateLimiter:
    """Como máximo 5 intentos fallidos por minuto y por IP."""
    MAX_FAILURES = 5
    WINDOW_S = 60

    def __init__(self):
        self._failures = {}
        self._lock = threading.Lock()

    def _prune(self, q, t):
        while q and t - q[0] > self.WINDOW_S:
            q.popleft()

    def is_blocked(self, key):
        with self._lock:
            q = self._failures.get(key)
            if not q:
                return False
            self._prune(q, time.monotonic())
            return len(q) >= self.MAX_FAILURES

    def record_failure(self, key):
        with self._lock:
            q = self._failures.setdefault(key, deque())
            t = time.monotonic()
            self._prune(q, t)
            q.append(t)
            if len(self._failures) > 10_000:
                for k in [k for k, v in self._failures.items() if not v]:
                    del self._failures[k]

    def reset(self, key):
        with self._lock:
            self._failures.pop(key, None)
