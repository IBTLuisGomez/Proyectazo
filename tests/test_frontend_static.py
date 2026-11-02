"""Comprobaciones estáticas del frontend: botones sin función y modales mal cerrados."""
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
APP_JS = (ROOT / "js" / "app.js").read_text(encoding="utf-8")

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def defined_methods():
    return set(re.findall(r"^  (?:async\s+|static\s+(?:get\s+)?)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{", APP_JS, re.M))


def test_every_button_calls_an_existing_method():
    defined = defined_methods()
    missing = {}
    for name, src in (("index.html", HTML), ("js/app.js", APP_JS)):
        for m in re.finditer(r'on[a-z]+="([^"]*)"', src):
            for fn in re.findall(r"\bapp\.([A-Za-z_]\w*)\s*\(", m.group(1)):
                if fn not in defined:
                    line = src.count("\n", 0, m.start()) + 1
                    missing.setdefault(fn, []).append(f"{name}:{line}")
    assert not missing, f"Botones que llaman a métodos inexistentes: {missing}"


class _ModalNesting(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.nested = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        el_id = dict(attrs).get("id") or ""
        if tag == "div" and el_id.startswith("modal-"):
            parents = [p for p in self.stack if p.startswith("modal-")]
            if parents:
                self.nested.append((el_id, parents[-1], self.getpos()[0]))
        self.stack.append(el_id if tag == "div" else "")

    def handle_endtag(self, tag):
        if tag not in VOID and self.stack:
            self.stack.pop()


def test_no_modal_is_nested_inside_another():
    # Un </div> que falta mete los modales siguientes dentro de uno oculto: se "abren" pero no se ven
    parser = _ModalNesting()
    parser.feed(HTML)
    assert not parser.nested, f"Modales anidados (falta un </div>): {parser.nested}"


def test_generated_ids_do_not_use_modal_prefix():
    # closeAllModals() oculta todo [id^="modal-"]; un id generado con ese prefijo se ocultaría también
    for m in re.finditer(r"\.id\s*=\s*`modal-", APP_JS):
        line = APP_JS.count("\n", 0, m.start()) + 1
        raise AssertionError(f"js/app.js:{line} genera un id con prefijo modal-")
