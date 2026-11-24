"""Jarvis: puente entre la app y el modelo de IA.

El bucle de herramientas vive en el navegador: allí están los datos (offline-first) y las
funciones que crean tareas, avisos, etc. Este módulo solo hace UNA llamada al modelo por turno:
recibe la conversación, devuelve los bloques de la respuesta (texto y/o tool_use) tal cual,
y el navegador ejecuta las herramientas y vuelve a llamar con los tool_result.

Proveedor configurable con NEXUS_AI_PROVIDER:
  - "claude": API de Anthropic (requiere ANTHROPIC_API_KEY u otra credencial del SDK).
  - "local" (por defecto si no hay credencial): no hay modelo; la app usa su intérprete local.
"""
import os

MAX_MESSAGES = 80          # tope de historial aceptado por petición
MAX_CHARS = 200_000        # tope de tamaño total del historial
USER_BLOCK_TYPES = {"text", "tool_result"}

SYSTEM_PROMPT = """Eres Jarvis, el asistente personal dentro de la app Nexus Orb. La persona que te habla tiene TDAH y lleva varios proyectos a la vez.

Tu trabajo es quitarle carga mental: capturar lo que dice, convertirlo en acciones pequeñas, recordarle cosas y ayudarle a empezar.

Cómo responder:
- En español, frases cortas y concretas. Una sola sugerencia cada vez, nunca listas largas.
- Sin culpa ni presión: nada de "deberías" ni recordatorios de lo atrasado salvo que lo pida.
- Si algo es grande o vago, propón el primer paso de 2 a 15 minutos.
- Cuando diga algo que hay que guardar, recordar o hacer, usa las herramientas en lugar de solo contestar. Después confirma en una frase qué hiciste.
- Usa los nombres de proyecto exactamente como aparecen en el contexto. Si no está claro a qué proyecto va, guárdalo como pensamiento.
- Compras, recados y cosas que se van tachando van a una lista (anadir_a_lista), un elemento por cosa; no al orbe ni a un proyecto.
- Fechas: calcula a partir de la fecha y hora del contexto y envíalas en ISO 8601 con zona horaria.
- Si te cuenta algo estable sobre sí mismo (horarios, preferencias, personas importantes), guárdalo con recordar_dato.
- Si no puedes hacer algo con las herramientas que tienes, dilo en una frase."""


def _obj(props, required):
    return {"type": "object", "properties": props, "required": required, "additionalProperties": False}


# Definiciones neutrales; cada proveedor las adapta a su formato.
TOOLS = [
    {
        "name": "soltar_pensamiento",
        "description": "Guarda un pensamiento, idea o preocupación en el orbe (Soltar). Úsalo para todo lo que no sea claramente una tarea de un proyecto.",
        "input_schema": _obj({
            "texto": {"type": "string", "description": "El pensamiento, redactado breve y claro."},
            "categoria": {"type": "string", "enum": ["auto", "urgente", "proyecto", "vida", "idea", "luego"],
                          "description": "auto deja que la app lo clasifique."},
        }, ["texto", "categoria"]),
    },
    {
        "name": "crear_tarea",
        "description": "Crea una tarea en el Buzón de un proyecto existente.",
        "input_schema": _obj({
            "proyecto": {"type": "string", "description": "Nombre del proyecto tal como aparece en el contexto."},
            "titulo": {"type": "string", "description": "Acción concreta que empieza con un verbo."},
            "tamano": {"type": "string", "enum": ["XS", "S", "M", "L"], "description": "XS ~5 min, S ~15, M ~45, L ~90."},
            "para_cuando": {"type": ["string", "null"], "description": "Fecha ISO 8601 o null si no tiene."},
        }, ["proyecto", "titulo", "tamano", "para_cuando"]),
    },
    {
        "name": "programar_aviso",
        "description": "Programa un aviso (notificación) para un momento concreto.",
        "input_schema": _obj({
            "texto": {"type": "string"},
            "cuando": {"type": "string", "description": "Fecha y hora ISO 8601 con zona horaria."},
        }, ["texto", "cuando"]),
    },
    {
        "name": "ver_tareas",
        "description": "Devuelve las tareas pendientes de un proyecto, o de todos si proyecto es null.",
        "input_schema": _obj({"proyecto": {"type": ["string", "null"]}}, ["proyecto"]),
    },
    {
        "name": "recordar_dato",
        "description": "Guarda un dato duradero sobre la persona para tenerlo en cuenta en futuras conversaciones.",
        "input_schema": _obj({"dato": {"type": "string"}}, ["dato"]),
    },
    {
        "name": "empezar_foco",
        "description": "Arranca el temporizador de foco con la tarea propuesta en Ahora.",
        "input_schema": _obj({"minutos": {"type": "integer", "description": "Entre 1 y 90."}}, ["minutos"]),
    },
    {
        "name": "anadir_a_lista",
        "description": "Añade elementos a una lista de pendientes con casillas (compras, recados, cosas para llevar). "
                       "Si la lista no existe, la crea con ese nombre.",
        "input_schema": _obj({
            "lista": {"type": "string", "description": "Nombre de la lista; usa uno del contexto si encaja."},
            "elementos": {"type": "array", "items": {"type": "string"}, "description": "Un elemento por cosa, breve."},
        }, ["lista", "elementos"]),
    },
    {
        "name": "ver_listas",
        "description": "Con lista null, devuelve las listas y cuántos pendientes tienen. Con un nombre, lo pendiente de esa lista.",
        "input_schema": _obj({"lista": {"type": ["string", "null"]}}, ["lista"]),
    },
    {
        "name": "marcar_en_lista",
        "description": "Marca un elemento de una lista como hecho (o lo devuelve a pendiente con hecho=false).",
        "input_schema": _obj({
            "lista": {"type": "string"},
            "elemento": {"type": "string", "description": "Texto del elemento, o una parte que lo identifique."},
            "hecho": {"type": "boolean"},
        }, ["lista", "elemento", "hecho"]),
    },
    {
        "name": "ir_a",
        "description": "Abre una sección de la app.",
        "input_schema": _obj({"seccion": {"type": "string", "enum": ["soltar", "ahora", "repasar"]}}, ["seccion"]),
    },
]


class JarvisError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def validate_messages(messages):
    if not isinstance(messages, list) or not messages:
        raise JarvisError("messages debe ser una lista no vacía", 400)
    if len(messages) > MAX_MESSAGES:
        raise JarvisError(f"Historial demasiado largo (máx. {MAX_MESSAGES} mensajes)", 400)
    total = 0
    for m in messages:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant"):
            raise JarvisError("Cada mensaje necesita role user o assistant", 400)
        content = m.get("content")
        if not isinstance(content, (str, list)):
            raise JarvisError("content debe ser texto o lista de bloques", 400)
        if isinstance(content, list) and m["role"] == "user":
            # El usuario solo manda texto y resultados de herramientas: nada de imágenes ni documentos
            for block in content:
                if not isinstance(block, dict) or block.get("type") not in USER_BLOCK_TYPES:
                    raise JarvisError("Tipo de bloque no permitido en un mensaje de usuario", 400)
        total += len(str(content))
    if total > MAX_CHARS:
        raise JarvisError("Historial demasiado grande", 400)
    if messages[0]["role"] != "user":
        raise JarvisError("El primer mensaje debe ser del usuario", 400)


class ClaudeProvider:
    name = "claude"

    def __init__(self):
        import anthropic  # import diferido: el servicio arranca aunque no esté instalado
        self._anthropic = anthropic
        self.client = anthropic.Anthropic()
        self.model = os.getenv("JARVIS_MODEL", "claude-opus-5-5")
        self.effort = os.getenv("JARVIS_EFFORT", "low")  # conversación corta: low basta
        self.tools = [{**t, "strict": True} for t in TOOLS]

    def run_turn(self, messages):
        a = self._anthropic
        try:
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                tools=self.tools,
                messages=messages,
                output_config={"effort": self.effort},
                # Si el modelo rechaza la petición, la API la reintenta en otro modelo
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except a.AuthenticationError:
            raise JarvisError("Credencial de Anthropic no válida", 502)
        except a.BadRequestError as e:
            raise JarvisError(f"Petición rechazada por la API: {e.message}", 400)
        except a.RateLimitError:
            raise JarvisError("Límite de uso de la API alcanzado; prueba en un minuto", 429)
        except a.APIStatusError as e:
            raise JarvisError(f"Error de la API ({e.status_code})", 502)
        except a.APIConnectionError:
            raise JarvisError("Sin conexión con la API de Anthropic", 503)
        except Exception as e:  # p. ej. SDK sin algún parámetro: responder JSON, no un 500 vacío
            raise JarvisError(f"Error inesperado del proveedor: {type(e).__name__}", 502)

        # Los bloques se devuelven intactos: el navegador los reenvía tal cual en el siguiente turno
        data = response.to_dict()
        return {
            "provider": self.name,
            "model": data.get("model"),
            "stop_reason": data.get("stop_reason"),
            "content": data.get("content", []),
        }


def _has_anthropic_credentials():
    return any(os.getenv(k) for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"))


_provider = None
_provider_error = None


def get_provider():
    """Devuelve el proveedor configurado o None si Jarvis está en modo local."""
    global _provider, _provider_error
    if _provider is not None or _provider_error is not None:
        return _provider
    wanted = (os.getenv("NEXUS_AI_PROVIDER") or ("claude" if _has_anthropic_credentials() else "local")).lower()
    try:
        if wanted == "claude":
            _provider = ClaudeProvider()
        else:
            _provider_error = "local"
    except Exception as e:  # SDK no instalado o mal configurado
        _provider_error = f"{wanted}: {e}"
        print(f"[Jarvis] Proveedor no disponible ({_provider_error}); modo local.")
    return _provider


def status():
    p = get_provider()
    return {"provider": p.name if p else "local", "model": getattr(p, "model", None)}


def handle(payload):
    """Procesa POST /jarvis. Devuelve (status_http, cuerpo)."""
    provider = get_provider()
    if provider is None:
        return 200, {"provider": "local", "content": [], "stop_reason": None}
    try:
        messages = payload.get("messages") if isinstance(payload, dict) else None
        validate_messages(messages)
        return 200, provider.run_turn(messages)
    except JarvisError as e:
        return e.status, {"error": str(e)}


def reset_for_tests():
    global _provider, _provider_error
    _provider = None
    _provider_error = None
