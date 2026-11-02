"""Tests del microservicio Nexus en modo sin GEMINI_API_KEY (clasificador heurístico)."""
import importlib
import json
import os
import sys
import threading
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def nexus(tmp_path_factory):
    # El módulo crea ./data al importarse: aislarlo en un directorio temporal y sin API key
    workdir = tmp_path_factory.mktemp("nexus")
    old_cwd = os.getcwd()
    os.chdir(workdir)
    os.environ["GEMINI_API_KEY"] = ""
    sys.path.insert(0, str(ROOT))
    try:
        module = importlib.import_module("nexus_service")
        yield module
    finally:
        sys.path.remove(str(ROOT))
        os.chdir(old_cwd)


@pytest.fixture(scope="module")
def server(nexus):
    httpd = nexus.ThreadingHTTPServer(("127.0.0.1", 0), nexus.NexusRequestHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


def test_runs_without_gemini(nexus):
    assert nexus.gemini_client is None


@pytest.mark.parametrize("text,expected", [
    ("Pagar el impuesto que vence mañana", "ROJO"),
    ("Quiero soltar esta culpa", "BLANCO"),
])
def test_heuristic_classification(nexus, text, expected):
    result = nexus.process_thought_with_gemini(text)
    assert result.raw_thought == text
    assert result.smoke_color == nexus.SmokeColor[expected]


def test_deconstruct_returns_steps(nexus):
    result = nexus.deconstruct_goal_with_gemini("Lanzar la landing del proyecto")
    assert result.atomic_steps
    assert result.estimated_total_minutes > 0


def test_health_endpoint(server):
    with urllib.request.urlopen(f"{server}/health") as res:
        body = json.loads(res.read())
    assert body["status"] == "UP"
    assert body["gemini_active"] is False


def test_thought_endpoint(server):
    body = post(f"{server}/api/nexus/thought", {"text": "Algo urgente y crítico"})
    assert body["thought_type"] == "urgente"


def test_mail_status_never_exposes_password(nexus, server):
    nexus.mail_manager.config["gmail_app_password"] = "abcd efgh ijkl mnop"
    with urllib.request.urlopen(f"{server}/api/nexus/mail/status") as res:
        raw = res.read().decode()
    assert "abcd" not in raw
    assert "gmail_app_password" not in raw


def test_unmatched_thought_is_flagged(nexus):
    # El catch-all heurístico no debe hacerse pasar por una clasificación real
    result = nexus.process_thought_with_gemini("xyz qwerty")
    assert result.matched is False


def test_matched_thought_is_flagged(nexus):
    assert nexus.process_thought_with_gemini("Pagar la tarjeta que vence").matched is True
