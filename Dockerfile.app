# Backend único de Nexus Orb: API de la app + IA/Jarvis en un solo proceso Python (~60 MB de RAM)
FROM python:3.11-slim

WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

RUN useradd -m -u 1000 appuser && mkdir -p /app/data && chown -R appuser:appuser /app
COPY --chown=appuser:appuser nexus_service.py jarvis.py ./
COPY --chown=appuser:appuser server/ ./server/
# Reglas del clasificador compartidas con el navegador
COPY --chown=appuser:appuser js/clasificador-reglas.js ./js/

USER appuser
ENV PORT=8081 PYTHONUNBUFFERED=1 NEXUS_DB_PATH=/app/data/nexus.db
EXPOSE 8081
# Datos (SQLite, config de correo): volumen en /app/data
CMD ["python", "-m", "server"]
