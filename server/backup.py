"""Copias de seguridad automáticas de la base de datos (Fase 7).

Una copia al día en `<carpeta de la BD>/backups/nexus-AAAA-MM-DD.db`, conservando las últimas N.
Se hace con la API de copia en caliente de SQLite: la app sigue funcionando y la copia es coherente
aunque haya escrituras a medias (copiar el archivo a mano con la app en marcha puede salir corrupto).

Configuración (.env):
  NEXUS_BACKUP_KEEP  cuántas copias diarias conservar (por defecto 14; 0 = desactivado)
  NEXUS_BACKUP_DIR   carpeta de destino (por defecto `backups/` junto a la base de datos)

Restaurar: parar la app y copiar la copia elegida sobre nexus.db (ver docs/GUIA_PENDIENTES.md).
"""
import os
import re
import sqlite3
import threading
from datetime import datetime, timezone

NAME = re.compile(r"^nexus-\d{4}-\d{2}-\d{2}\.db$")


class Backups:
    def __init__(self, db, directory=None, keep=14, log=print):
        self.db = db
        self.keep = max(0, int(keep))
        self.log = log
        if directory is None and db.path != ":memory:":
            directory = os.path.join(os.path.dirname(os.path.abspath(db.path)), "backups")
        self.directory = directory
        self.enabled = bool(self.keep and self.directory)

    def _path(self, day):
        return os.path.join(self.directory, f"nexus-{day}.db")

    def existing(self):
        """Copias guardadas, de la más antigua a la más reciente (el nombre ordena por fecha)."""
        if not self.directory or not os.path.isdir(self.directory):
            return []
        return sorted(f for f in os.listdir(self.directory) if NAME.match(f))

    def run(self, today=None):
        """Hace la copia de hoy (sustituye la que hubiera) y borra las que sobran. Devuelve su ruta."""
        if not self.enabled:
            return None
        os.makedirs(self.directory, exist_ok=True)
        day = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        final = self._path(day)
        partial = final + ".tmp"
        if os.path.exists(partial):
            os.remove(partial)
        target = sqlite3.connect(partial)
        try:
            with self.db.lock:
                self.db.conn.backup(target)
            ok = target.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            target.close()
        if ok != "ok":
            os.remove(partial)
            raise RuntimeError(f"La copia no pasó la comprobación de integridad: {ok}")
        os.replace(partial, final)  # nunca queda una copia a medias con el nombre definitivo
        for old in self.existing()[:-self.keep]:
            os.remove(os.path.join(self.directory, old))
        return final

    def run_if_due(self, today=None):
        day = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if not self.enabled or os.path.exists(self._path(day)):
            return None
        path = self.run(day)
        self.log(f"Copia de seguridad guardada: {path} (se conservan {self.keep})")
        return path

    def start_scheduler(self, interval_s=3600, initial_delay_s=60):
        """Comprueba cada hora si falta la copia de hoy; así un servidor que se apaga de noche no se queda sin ella."""
        stop = threading.Event()
        if not self.enabled:
            return stop

        def loop():
            if stop.wait(initial_delay_s):
                return
            while True:
                try:
                    self.run_if_due()
                except Exception as e:
                    self.log(f"No se pudo hacer la copia de seguridad: {type(e).__name__}: {e}")
                if stop.wait(interval_s):
                    return

        threading.Thread(target=loop, name="backup-scheduler", daemon=True).start()
        return stop
