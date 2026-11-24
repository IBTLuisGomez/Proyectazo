"""Configuración común de los tests.

Los tests nunca deben llamar a una IA real: nexus_service carga el .env del proyecto al importarse
(load_dotenv no pisa variables ya definidas), así que las claves se dejan vacías aquí, antes de cualquier import.
Sin esto, una clave real en .env hacía que los tests llamaran a Gemini por red (lentos, colgados y con coste).
"""
import os

for _key in ("GEMINI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "NEXUS_AI_PROVIDER"):
    os.environ[_key] = ""
