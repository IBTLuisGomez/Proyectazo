"""Secretos cifrados en reposo (Fase 8).

Con NEXUS_SECRET_KEY en .env, la clave privada VAPID (tabla settings) y la contraseña de aplicación
de Gmail (data/google_mail_config.json) se guardan cifradas: quien consiga una copia de la base de
datos o del disco no obtiene los secretos sin esa clave. Sin la variable, todo sigue como antes
(texto plano) y la app funciona igual.

- Lo que ya estaba en texto plano se cifra solo la primera vez que se lee con la clave puesta.
- Si falta o cambia NEXUS_SECRET_KEY, lo cifrado no se puede leer: los avisos push y el correo quedan
  desactivados (el resto de la app funciona) hasta que se restaure la clave. Si se perdió del todo:
  borrar las filas vapid.* de la tabla settings (cada dispositivo reactivará los avisos) y volver a
  poner la contraseña de Gmail en Ajustes.

Cifrado: Fernet (AES-128-CBC + HMAC-SHA256) de la librería cryptography, que ya instala pywebpush.
"""
import base64
import hashlib
import os

PREFIX = "enc:v1:"


class SecretError(Exception):
    pass


class SecretBox:
    def __init__(self, key=None):
        self._fernet = None
        key = (key or "").strip()
        if key:
            from cryptography.fernet import Fernet
            # La clave del .env puede ser cualquier texto: se deriva una de 32 bytes
            self._fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode("utf-8")).digest()))

    @property
    def enabled(self):
        return self._fernet is not None

    @staticmethod
    def is_sealed(value):
        return isinstance(value, str) and value.startswith(PREFIX)

    def seal(self, value):
        """Cifra si hay clave; si no, devuelve el valor tal cual. Lo vacío y lo ya cifrado no se tocan."""
        if not value or not self.enabled or self.is_sealed(value):
            return value
        return PREFIX + self._fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def open(self, value):
        """Descifra un valor cifrado; uno en texto plano se devuelve tal cual."""
        if not self.is_sealed(value):
            return value
        if not self.enabled:
            raise SecretError("El valor está cifrado y falta NEXUS_SECRET_KEY.")
        from cryptography.fernet import InvalidToken
        try:
            return self._fernet.decrypt(value[len(PREFIX):].encode("ascii")).decode("utf-8")
        except InvalidToken:
            raise SecretError("NEXUS_SECRET_KEY no es la clave con la que se cifró este valor.")


def from_env():
    return SecretBox(os.getenv("NEXUS_SECRET_KEY"))
