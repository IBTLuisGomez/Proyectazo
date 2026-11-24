"""Fases 7–9: copias de seguridad, secretos cifrados en reposo y registro de errores del cliente."""
import json
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

pytest.importorskip("cryptography")

from server.backup import Backups  # noqa: E402
from server.clientlog import KEEP, MAX_PER_HOUR, ClientLog  # noqa: E402
from server.db import Database  # noqa: E402
from server.push import KEY_PRIVATE, KEY_PUBLIC, Push  # noqa: E402
from server.secretbox import PREFIX, SecretBox, SecretError  # noqa: E402


class FakeSender:
    def send(self, sub, payload):
        return 201


def quiet(*_):
    pass


# ---------------- Fase 7: copias de seguridad ----------------
def test_backup_copia_coherente_y_rotacion(tmp_path):
    db = Database(str(tmp_path / "nexus.db"))
    db.set_setting("prueba", "valor")
    backups = Backups(db, keep=3, log=quiet)
    assert backups.enabled and backups.directory == str(tmp_path / "backups")
    for day in ("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"):
        path = backups.run(day)
    assert backups.existing() == ["nexus-2026-01-03.db", "nexus-2026-01-04.db", "nexus-2026-01-05.db"]
    assert not list((tmp_path / "backups").glob("*.tmp"))
    copy = sqlite3.connect(path)
    assert copy.execute("SELECT value FROM settings WHERE key = 'prueba'").fetchone()[0] == "valor"
    copy.close()


def test_backup_una_vez_al_dia_y_desactivable(tmp_path):
    db = Database(str(tmp_path / "nexus.db"))
    backups = Backups(db, str(tmp_path / "otra"), keep=2, log=quiet)
    assert backups.run_if_due("2026-02-01") is not None
    assert backups.run_if_due("2026-02-01") is None  # la de hoy ya existe
    assert backups.run_if_due("2026-02-02") is not None
    # Un archivo ajeno en la carpeta no se toca ni cuenta
    (tmp_path / "otra" / "notas.txt").write_text("x")
    backups.run("2026-02-03")
    assert backups.existing() == ["nexus-2026-02-02.db", "nexus-2026-02-03.db"]
    assert (tmp_path / "otra" / "notas.txt").exists()
    apagado = Backups(db, keep=0, log=quiet)
    assert not apagado.enabled and apagado.run() is None
    assert not Backups(Database(":memory:"), log=quiet).enabled


# ---------------- Fase 8: secretos cifrados ----------------
def test_secretbox_cifra_y_descifra():
    box = SecretBox("una clave cualquiera")
    sealed = box.seal("secreto")
    assert sealed.startswith(PREFIX) and "secreto" not in sealed
    assert box.open(sealed) == "secreto"
    assert box.seal(sealed) == sealed            # no cifra dos veces
    assert box.open("texto plano") == "texto plano"
    assert box.seal("") == ""
    with pytest.raises(SecretError):
        SecretBox("otra clave").open(sealed)
    with pytest.raises(SecretError):
        SecretBox().open(sealed)
    sin_clave = SecretBox()
    assert not sin_clave.enabled and sin_clave.seal("x") == "x"


def test_vapid_privada_cifrada_en_la_base(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    box = SecretBox("clave-del-env")
    push = Push(db, sender=FakeSender(), log=quiet, box=box)
    assert push.enabled
    stored = db.get_setting(KEY_PRIVATE)
    assert stored.startswith(PREFIX)
    public = db.get_setting(KEY_PUBLIC)
    # Reinicio con la misma clave: mismas claves VAPID (los dispositivos siguen suscritos)
    again = Push(db, sender=FakeSender(), log=quiet, box=SecretBox("clave-del-env"))
    assert again.enabled and again.public_key == public and db.get_setting(KEY_PRIVATE) == stored
    # Sin la clave (o con otra): push desactivado y las claves guardadas no se pisan
    logs = []
    roto = Push(db, sender=FakeSender(), log=logs.append, box=SecretBox())
    assert not roto.enabled and "NEXUS_SECRET_KEY" in logs[0]
    assert db.get_setting(KEY_PRIVATE) == stored and db.get_setting(KEY_PUBLIC) == public


def test_vapid_en_texto_plano_se_cifra_al_poner_la_clave(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    Push(db, sender=FakeSender(), log=quiet)  # sin clave: como hasta ahora
    plain = db.get_setting(KEY_PRIVATE)
    assert not plain.startswith(PREFIX)
    box = SecretBox("nueva")
    assert Push(db, sender=FakeSender(), log=quiet, box=box).enabled
    assert db.get_setting(KEY_PRIVATE).startswith(PREFIX)
    assert box.open(db.get_setting(KEY_PRIVATE)) == plain


def test_contrasena_de_gmail_cifrada_en_disco(tmp_path, monkeypatch):
    import nexus_service
    monkeypatch.setattr(nexus_service.GoogleMailManager, "_start_scheduler", lambda self: None)
    for key in ("GMAIL_USER", "GMAIL_APP_PASSWORD", "GMAIL_RECIPIENT"):
        monkeypatch.delenv(key, raising=False)
    config = tmp_path / "google_mail_config.json"

    # Sin clave: texto plano, como antes
    monkeypatch.delenv("NEXUS_SECRET_KEY", raising=False)
    nexus_service.GoogleMailManager(str(tmp_path)).save_config({"gmail_user": "a@b.c", "gmail_app_password": "abcd efgh"})
    assert json.loads(config.read_text(encoding="utf-8"))["gmail_app_password"] == "abcd efgh"

    # Con clave: al arrancar se cifra lo que había y en memoria sigue disponible
    monkeypatch.setenv("NEXUS_SECRET_KEY", "clave")
    manager = nexus_service.GoogleMailManager(str(tmp_path))
    assert manager.config["gmail_app_password"] == "abcd efgh"
    assert json.loads(config.read_text(encoding="utf-8"))["gmail_app_password"].startswith(PREFIX)
    manager.save_config({"gmail_app_password": "nueva pass"})
    on_disk = json.loads(config.read_text(encoding="utf-8"))["gmail_app_password"]
    assert on_disk.startswith(PREFIX) and "nueva" not in on_disk
    assert nexus_service.GoogleMailManager(str(tmp_path)).config["gmail_app_password"] == "nueva pass"

    # Con otra clave: el correo queda sin configurar y el archivo no se toca
    monkeypatch.setenv("NEXUS_SECRET_KEY", "otra")
    assert nexus_service.GoogleMailManager(str(tmp_path)).config["gmail_app_password"] == ""
    assert json.loads(config.read_text(encoding="utf-8"))["gmail_app_password"] == on_disk


# ---------------- Fase 9: errores del cliente ----------------
def test_clientlog_recorta_limita_y_separa_por_usuario(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    lines = []
    log = ClientLog(db, log=lines.append)
    assert log.add(1, {"message": "x is not defined", "source": "js/app.js", "line": 10, "column": 2,
                       "stack": "s" * 9000, "view": "notas", "contenido": "texto privado", "line2": 5})
    saved = log.recent(1)[0]
    assert saved["message"] == "x is not defined" and saved["line"] == 10 and len(saved["stack"]) == 3000
    assert "contenido" not in saved and "line2" not in saved  # solo los campos conocidos
    assert "x is not defined" in lines[0]
    assert not log.add(1, {"stack": "sin mensaje"}) and not log.add(1, "texto") and not log.add(1, {"message": ""})
    assert log.recent(2) == []
    for i in range(MAX_PER_HOUR + 5):
        log.add(2, {"message": f"e{i}"})
    assert len(log.recent(2, 100)) == MAX_PER_HOUR  # el exceso se descarta
    assert log.recent(2)[0]["message"] == f"e{MAX_PER_HOUR - 1}"
    assert KEEP >= MAX_PER_HOUR
