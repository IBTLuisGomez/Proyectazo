"""Avisos Web Push: suscripciones, recordatorios programados y envío.

Las claves VAPID se leen de NEXUS_VAPID_* o de la tabla settings (vapid.public / vapid.private, el mismo
formato que guardaba Spring), así los dispositivos ya suscritos siguen funcionando tras la migración.
"""
import base64
import json
import threading
from datetime import datetime, timedelta, timezone

from .db import iso, now, parse_dt

KEY_PUBLIC = "vapid.public"
KEY_PRIVATE = "vapid.private"


def _b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_vapid_keys():
    """Par P-256: pública como punto sin comprimir (65 bytes) y privada como escalar de 32 bytes, en base64url."""
    from cryptography.hazmat.primitives.asymmetric import ec
    key = ec.generate_private_key(ec.SECP256R1())
    numbers = key.public_key().public_numbers()
    point = b"\x04" + numbers.x.to_bytes(32, "big") + numbers.y.to_bytes(32, "big")
    private = key.private_numbers().private_value.to_bytes(32, "big")
    return _b64url(point), _b64url(private)


class WebPushSender:
    """Envío real con pywebpush. Devuelve el código HTTP del servicio de push."""

    def __init__(self, private_key, subject):
        from py_vapid import Vapid01
        self.subject = subject
        # La privada viene como escalar crudo en base64url (formato de Spring)
        raw = base64.urlsafe_b64decode(private_key + "=" * (-len(private_key) % 4))
        self.vapid = Vapid01.from_raw(raw)

    def send(self, sub, payload):
        from pywebpush import WebPushException, webpush
        info = {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}}
        try:
            response = webpush(info, data=payload, vapid_private_key=self.vapid,
                               vapid_claims={"sub": self.subject}, ttl=86400, timeout=15)
            return response.status_code
        except WebPushException as e:
            if e.response is not None:
                return e.response.status_code
            raise


class Push:
    def __init__(self, db, public_key=None, private_key=None, subject="mailto:admin@localhost", sender=None, log=print):
        self.db = db
        self.log = log
        self.enabled = False
        self.public_key = None
        self.sender = sender
        try:
            if not public_key or not private_key:
                public_key, private_key = db.get_setting(KEY_PUBLIC), db.get_setting(KEY_PRIVATE)
                if not public_key or not private_key:
                    public_key, private_key = generate_vapid_keys()
                    db.set_setting(KEY_PUBLIC, public_key)
                    db.set_setting(KEY_PRIVATE, private_key)
                    log("Claves VAPID generadas y guardadas en la base de datos.")
            if self.sender is None:
                self.sender = WebPushSender(private_key, subject)
            self.public_key = public_key
            self.enabled = True
        except Exception as e:  # sin cryptography/pywebpush o claves inválidas: la app funciona sin push
            log(f"Web Push desactivado: no se pudieron preparar las claves VAPID ({e})")

    # ---- suscripciones ----
    def subscribe(self, user_id, endpoint, p256dh, auth):
        if not endpoint or not p256dh or not auth:
            raise ValueError("Suscripción incompleta: faltan endpoint o claves.")
        if not endpoint.startswith("https://"):
            raise ValueError("El endpoint de push debe ser https.")
        self.db.execute(
            "INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth",
            (user_id, endpoint, p256dh, auth, iso(now())))

    def unsubscribe(self, user_id, endpoint):
        if endpoint:
            self.db.execute("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", (endpoint, user_id))

    def count(self, user_id):
        return self.db.one("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?", (user_id,))["n"]

    def send_to_user(self, user_id, title, body, url="./index.html"):
        """Envía a todos los dispositivos del usuario; borra las suscripciones caducadas (404/410)."""
        if not self.enabled:
            return 0
        payload = json.dumps({"title": title, "body": body or "", "data": {"url": url or "./index.html"}}, ensure_ascii=False)
        delivered = 0
        for sub in self.db.query("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", (user_id,)):
            try:
                status = self.sender.send(dict(sub), payload)
            except Exception as e:
                self.log(f"Fallo enviando push a la suscripción {sub['id']}: {e}")
                continue
            if status in (404, 410):
                self.db.execute("DELETE FROM push_subscriptions WHERE id = ?", (sub["id"],))
            elif 200 <= status < 300:
                delivered += 1
            else:
                self.log(f"Push rechazado con estado {status} para la suscripción {sub['id']}")
        return delivered

    # ---- recordatorios ----
    def schedule(self, user_id, title, body, task_id, send_at_ms):
        if not title or not str(title).strip():
            raise ValueError("El recordatorio necesita un título.")
        if send_at_ms is None:
            raise ValueError("Falta la fecha del recordatorio.")
        send_at = parse_dt(send_at_ms)
        if send_at is None:
            raise ValueError("Fecha del recordatorio no válida.")
        if send_at > now() + timedelta(days=366):
            raise ValueError("La fecha del recordatorio es demasiado lejana.")
        title = str(title)[:255]
        with self.db.transaction() as conn:
            # Un aviso pendiente por tarea: cambiar la fecha lo mueve en vez de duplicarlo
            if task_id:
                conn.execute("DELETE FROM push_reminders WHERE user_id = ? AND task_id = ? AND sent_at IS NULL",
                             (user_id, task_id))
            cur = conn.execute("INSERT INTO push_reminders(user_id, title, body, task_id, send_at, created_at) "
                               "VALUES (?, ?, ?, ?, ?, ?)", (user_id, title, body, task_id or None, iso(send_at), iso(now())))
            rid = cur.lastrowid
        return self._reminder_out(self.db.one("SELECT * FROM push_reminders WHERE id = ?", (rid,)))

    @staticmethod
    def _reminder_out(row):
        return {"id": row["id"], "title": row["title"], "taskId": row["task_id"] or "",
                "sendAt": int(parse_dt(row["send_at"]).timestamp() * 1000)}

    def pending(self, user_id):
        rows = self.db.query("SELECT * FROM push_reminders WHERE user_id = ? AND sent_at IS NULL ORDER BY send_at", (user_id,))
        return [self._reminder_out(r) for r in rows]

    def cancel(self, user_id, reminder_id):
        cur = self.db.execute("DELETE FROM push_reminders WHERE id = ? AND user_id = ? AND sent_at IS NULL",
                              (reminder_id, user_id))
        return cur.rowcount > 0

    def dispatch_due(self):
        """Envía los recordatorios vencidos. Se marcan como enviados aunque no haya dispositivos, para no repetir."""
        due = self.db.query("SELECT * FROM push_reminders WHERE sent_at IS NULL AND send_at <= ?", (iso(now()),))
        for r in due:
            body = r["body"] if r["body"] and r["body"].strip() else "Es el momento de tu micro-paso."
            self.send_to_user(r["user_id"], "⏰ " + r["title"], body, "./index.html#hacer")
            self.db.execute("UPDATE push_reminders SET sent_at = ? WHERE id = ?", (iso(now()), r["id"]))
        return len(due)

    def start_scheduler(self, interval_s=30, initial_delay_s=15):
        stop = threading.Event()

        def loop():
            if stop.wait(initial_delay_s):
                return
            while True:
                try:
                    self.dispatch_due()
                except Exception as e:
                    self.log(f"Error enviando recordatorios: {e}")
                if stop.wait(interval_s):
                    return

        threading.Thread(target=loop, name="push-scheduler", daemon=True).start()
        return stop
