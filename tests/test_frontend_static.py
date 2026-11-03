"""Comprobaciones estáticas del frontend: botones sin función y modales mal cerrados."""
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
# La clase está repartida entre js/app.js y los módulos de js/app/
APP_JS = "\n".join(p.read_text(encoding="utf-8") for p in [ROOT / "js" / "app.js", *sorted((ROOT / "js" / "app").rglob("*.js"))])

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


def test_free_text_in_onclick_is_escaped():
    # Texto libre (títulos, acciones, pasos de la IA) metido tal cual en onclick="app.x('...')"
    # rompe el botón si lleva comillas o saltos de línea: debe pasar por this.jsStr() o encodeURIComponent
    text_fields = re.compile(r"\.(nextAction|title|content|name|kickstart_action|exact_next_step|objective)\b")
    offenders = []
    for m in re.finditer(r'on[a-z]+="([^"]*)"', APP_JS):
        for arg in re.findall(r"'\$\{([^}]*)\}'", m.group(1)):
            if text_fields.search(arg) and "jsStr(" not in arg and "uriArg(" not in arg:
                offenders.append(f"js/app.js:{APP_JS.count(chr(10), 0, m.start()) + 1} → {arg}")
        # encodeURIComponent no escapa el apóstrofo: usar this.uriArg()
        if "encodeURIComponent(" in m.group(1):
            offenders.append(f"js/app.js:{APP_JS.count(chr(10), 0, m.start()) + 1} → encodeURIComponent en onclick")
    assert not offenders, "Texto sin escapar en onclick: " + "; ".join(offenders)


def test_every_capture_goes_through_the_funnel():
    # Solo captureThought (js/app/features/captura.js) puede guardar pensamientos con quickDumpToOrbe:
    # así todas las vías comparten separación de ideas, deduplicado y clasificación
    offenders = []
    for path in [ROOT / "js" / "app.js", *sorted((ROOT / "js" / "app").rglob("*.js"))]:
        if path.name == "captura.js":
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "this.quickDumpToOrbe(" in line:
                offenders.append(f"{path.relative_to(ROOT)}:{n}")
    assert not offenders, "Capturas que no pasan por captureThought: " + ", ".join(offenders)


def test_deletes_go_through_the_offline_queue():
    # Borrar en el servidor siempre con deleteOnServer(): si no hay red se encola y no "resucita" al sincronizar
    offenders = []
    for path in sorted((ROOT / "js" / "app").rglob("*.js")):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "method: 'DELETE'" in line:
                offenders.append(f"{path.relative_to(ROOT)}:{n}")
    assert not offenders, "DELETE directo (usar this.deleteOnServer): " + ", ".join(offenders)
