"""Tests de jarvis.py sin red: modo local, validación y el proveedor Claude con un cliente simulado."""
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import jarvis  # noqa: E402


@pytest.fixture(autouse=True)
def limpio(monkeypatch):
    for k in ("NEXUS_AI_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"):
        monkeypatch.delenv(k, raising=False)
    jarvis.reset_for_tests()
    yield
    jarvis.reset_for_tests()


def test_sin_credenciales_responde_modo_local():
    code, body = jarvis.handle({"messages": [{"role": "user", "content": "hola"}]})
    assert code == 200 and body["provider"] == "local" and body["content"] == []
    assert jarvis.status()["provider"] == "local"


@pytest.mark.parametrize("messages", [
    None, [], [{"role": "assistant", "content": "x"}], [{"role": "system", "content": "x"}],
    [{"role": "user", "content": 5}], [{"role": "user", "content": "x"}] * (jarvis.MAX_MESSAGES + 1),
])
def test_valida_el_historial(messages):
    with pytest.raises(jarvis.JarvisError) as e:
        jarvis.validate_messages(messages)
    assert e.value.status == 400


def test_herramientas_son_estrictas_y_cerradas():
    nombres = [t["name"] for t in jarvis.TOOLS]
    assert len(nombres) == len(set(nombres))
    for t in jarvis.TOOLS:
        schema = t["input_schema"]
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(schema["properties"])


def test_proveedor_claude_devuelve_bloques_intactos(monkeypatch):
    llamadas = {}

    class FakeMessages:
        def create(self, **kwargs):
            llamadas.update(kwargs)
            data = {"model": kwargs["model"], "stop_reason": "tool_use", "content": [
                {"type": "text", "text": "Lo apunto."},
                {"type": "tool_use", "id": "t1", "name": "soltar_pensamiento", "input": {"texto": "pan", "categoria": "auto"}},
            ]}
            return SimpleNamespace(to_dict=lambda: data)

    prov = jarvis.ClaudeProvider.__new__(jarvis.ClaudeProvider)
    prov._anthropic = pytest.importorskip("anthropic")
    prov.client = SimpleNamespace(beta=SimpleNamespace(messages=FakeMessages()))
    prov.model, prov.effort = "claude-opus-5-5", "low"
    prov.tools = [{**t, "strict": True} for t in jarvis.TOOLS]
    jarvis._provider = prov

    code, body = jarvis.handle({"messages": [{"role": "user", "content": "comprar pan"}]})
    assert code == 200 and body["stop_reason"] == "tool_use"
    assert body["content"][1]["name"] == "soltar_pensamiento"
    assert llamadas["model"] == "claude-opus-5-5"
    assert "thinking" not in llamadas and llamadas["output_config"] == {"effort": "low"}
    assert llamadas["fallbacks"] == "default"
