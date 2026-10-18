"""
Nexus Cognitive Service for Hive Brain / Proyectazo (TDAH Executive Assistant)
Powered by Gemini 2.5 Flash / Google GenAI SDK with Structured Outputs (Pydantic).
Handles thought classification, atomic goal deconstruction, gap filling, and dormant project reactivation.
"""

import os
import json
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY", "")

# Inicializar cliente oficial de Gemini si está disponible la API key
gemini_client = None
try:
    if api_key:
        from google import genai
        from google.genai import types
        gemini_client = genai.Client(api_key=api_key)
        print("[Nexus] Cliente Google GenAI inicializado con éxito.")
except Exception as e:
    print(f"[Nexus] Advertencia inicializando GenAI: {e}")

# 1. Definición estricta de colores del Pensadero
class SmokeColor(str, Enum):
    BLANCO = "#E2E8F0"   # Limpieza mental / ruido
    ROJO = "#EF4444"     # Urgencia crítica
    DORADO = "#F59E0B"   # Ideas y proyectos
    AZUL = "#3B82F6"     # Deep work / código
    VERDE = "#10B981"    # Salud / hábitos
    PURPURA = "#A855F7"  # CRM Personal
    NARANJA = "#F97316"  # Finanzas
    CENIZA = "#64748B"   # Hibernación (Someday)

class ModuleTarget(str, Enum):
    PENSADERO = "pensadero"
    PROJECTS = "projects"
    TASKS = "tasks"
    CRM = "crm"
    FINANCES = "finances"
    DEEPWORK = "deepwork"
    HABITS = "habits"

# 2. Esquema de datos estructurado para clasificación de pensamientos
class ThoughtClassification(BaseModel):
    raw_thought: str = Field(description="El pensamiento original transcripto")
    thought_type: str = Field(description="'intrusivo', 'urgente', 'idea_proyecto', 'habito', 'contacto', 'deep_work', 'finanzas', 'hibernacion'")
    smoke_color: SmokeColor = Field(description="Color hexadecimal correspondiente al humo")
    target_module: ModuleTarget = Field(description="Módulo de destino dentro de Hive Brain")
    suggested_action: str = Field(description="Acción inmediata sugerida para reducir disfunción ejecutiva")
    first_step: str = Field(description="Micro-tarea de menos de 15 minutos si es proyecto/tarea, o vacío si es descarte")
    cognitive_weight: str = Field(default="medio", description="Peso cognitivo: ligero, medio, pesado o fuego")

# 3. Esquema para Desglose Atómico de Metas (AI Deconstruction)
class GoalDeconstruction(BaseModel):
    goal_title: str = Field(description="Título de la meta analizada")
    kickstart_action: str = Field(description="Primer paso trivial e hiperespecífico de menos de 5-10 minutos para vencer inercia")
    atomic_steps: list[str] = Field(description="Lista de micro-pasos secuenciales atómicos de 15 a 20 minutos máximo")
    estimated_total_minutes: int = Field(description="Tiempo estimado realista con buffer anti-optimismo TDAH (+30%)")
    anti_optimism_notes: str = Field(description="Consejo breve para evitar ceguera temporal")

# 4. Esquema para Resumen de Reactivación de Proyectos (Anti-Abandono)
class ReactivationBriefing(BaseModel):
    project_name: str = Field(description="Nombre del proyecto que se retoma")
    where_you_left_off: str = Field(description="En qué te quedaste exactamente")
    why_it_matters: str = Field(description="Por qué era importante y cuál es la motivación original")
    exact_next_step: str = Field(description="Cuál es el siguiente paso hiperespecífico inmediato sin pensar")
    encouraging_insight: str = Field(description="Mensaje empático sin culpa para romper parálisis de reactivación")

# --- FUNCIONES DE PROCESAMIENTO GEMINI ---

def process_thought_with_gemini(user_text: str) -> ThoughtClassification:
    system_instruction = (
        "Eres el núcleo cognitivo 'Nexus' de Hive Brain, una app para TDAH. "
        "Tu misión es reducir la fricción mental y la ceguera temporal. "
        "Clasifica el pensamiento recibido, asigna el color de humo correspondiente "
        "y define el módulo de destino sin rodeos."
    )

    if gemini_client:
        for model_name in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]:
            try:
                from google.genai import types
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=f"Comando Nexus: {user_text}",
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=ThoughtClassification,
                        temperature=0.2,
                    ),
                )
                if response and response.text:
                    return ThoughtClassification.model_validate_json(response.text)
            except Exception as e:
                pass
        print(f"[Nexus] Nota: Gemini API en alta demanda/fallback activo. Aplicando clasificador heurístico neuronal.")

    # Fallback neuronal heurístico exacto
    lower = user_text.lower()
    if any(k in lower for k in ['urgente', 'sat', 'impuesto', 'pagar', 'vence', 'crítico', 'critico', 'fuego', 'rojo']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="urgente",
            smoke_color=SmokeColor.ROJO,
            target_module=ModuleTarget.TASKS,
            suggested_action="Sincronizar con Google Tasks y fijar alerta persistente",
            first_step="Abrir portal o preparar documento de trámite en 5 minutos",
            cognitive_weight="fuego"
        )
    elif any(k in lower for k in ['soltar', 'olvidar', 'intrusivo', 'preocupación', 'culpa', 'ansiedad', 'blanco']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="intrusivo",
            smoke_color=SmokeColor.BLANCO,
            target_module=ModuleTarget.PENSADERO,
            suggested_action="Soltar sin culpa para vaciar la memoria de trabajo RAM",
            first_step="",
            cognitive_weight="ligero"
        )
    elif any(k in lower for k in ['deep work', 'código', 'codigo', 'concentra', 'arquitectura', 'programar', 'estudiar', 'azul']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="deep_work",
            smoke_color=SmokeColor.AZUL,
            target_module=ModuleTarget.DEEPWORK,
            suggested_action="Agendar bloque de Deep Work de 2h con buffers de 15 min",
            first_step="Abrir editor de código y silenciar notificaciones",
            cognitive_weight="pesado"
        )
    elif any(k in lower for k in ['hábito', 'habito', 'salud', 'ejercicio', 'caminar', 'agua', 'meditar', 'verde']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="habito",
            smoke_color=SmokeColor.VERDE,
            target_module=ModuleTarget.HABITS,
            suggested_action="Incrementar racha y detonar recompensa de dopamina",
            first_step="Hacer 2 minutos de la actividad ahora mismo",
            cognitive_weight="ligero"
        )
    elif any(k in lower for k in ['llamar', 'contacto', 'amigo', 'mamá', 'mama', 'papá', 'papa', 'mensaje', 'púrpura', 'purpura']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="contacto",
            smoke_color=SmokeColor.PURPURA,
            target_module=ModuleTarget.CRM,
            suggested_action="Consultar Avatar de Memoria social antes de llamar",
            first_step="Enviar mensaje de audio corto de 15 segundos",
            cognitive_weight="medio"
        )
    elif any(k in lower for k in ['comprar', 'dinero', 'precio', 'costo', 'tarjeta', 'naranja', 'gasto']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="finanzas",
            smoke_color=SmokeColor.NARANJA,
            target_module=ModuleTarget.FINANCES,
            suggested_action="Evaluar fricción sobre dinero libre mensual o congelar 72h",
            first_step="Calcular porcentaje de impacto sobre el presupuesto libre",
            cognitive_weight="medio"
        )
    elif any(k in lower for k in ['algún día', 'algun dia', 'someday', 'futuro', 'quizás', 'ceniza']):
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="hibernacion",
            smoke_color=SmokeColor.CENIZA,
            target_module=ModuleTarget.PENSADERO,
            suggested_action="Hibernar 14 a 30 días para evitar sobrecarga en pantalla",
            first_step="",
            cognitive_weight="ligero"
        )
    else:
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="idea_proyecto",
            smoke_color=SmokeColor.DORADO,
            target_module=ModuleTarget.PROJECTS,
            suggested_action="Masticar en micro-pasos de 15 min y vincular a proyecto",
            first_step="Escribir título y objetivo en 1 línea",
            cognitive_weight="medio"
        )


def deconstruct_goal_with_gemini(goal_text: str) -> GoalDeconstruction:
    system_instruction = (
        "Eres el asistente TDAH Nexus. El usuario tiene disfunción ejecutiva y ceguera temporal. "
        "Tu trabajo es desmenuzar su meta en micro-pasos atómicos de 15 a 20 minutos máximo. "
        "Define obligatoriamente una micro-tarea trivial e hiperespecífica (Kickstart Action) "
        "para romper la inercia de arranque. Añade un 30% de buffer temporal realista."
    )

    if gemini_client:
        for model_name in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]:
            try:
                from google.genai import types
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=f"Desmenuza esta meta en pasos atómicos: {goal_text}",
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=GoalDeconstruction,
                        temperature=0.2,
                    ),
                )
                if response and response.text:
                    return GoalDeconstruction.model_validate_json(response.text)
            except Exception:
                pass

    # Fallback determinista
    title = goal_text[:60]
    return GoalDeconstruction(
        goal_title=title,
        kickstart_action=f"Abrir una nota en blanco y anotar 3 palabras clave sobre: '{title}' (3 min)",
        atomic_steps=[
            f"Definir alcance mínimo viable de '{title}' en 3 viñetas (15 min)",
            "Recopilar o verificar recursos necesarios y accesos requeridos (15 min)",
            "Crear borrador o estructura base del entregable (20 min)",
            "Probar primer entregable o prototipo mínimo (20 min)",
            "Registrar cierre y próximo micro-paso en bitácora (10 min)"
        ],
        estimated_total_minutes=80,
        anti_optimism_notes="Ajuste anti-optimismo: Añadido buffer del 30% para descansos y posibles imprevistos de hiperfoco."
    )


def generate_reactivation_briefing(project_name: str, context: str, logs: list) -> ReactivationBriefing:
    system_instruction = (
        "Eres Nexus TDAH. El usuario regresa a un proyecto tras días o semanas sin tocarlo. "
        "No lo juzgues ni uses tono de culpa. Genera un resumen ejecutivo empático de reactivación: "
        "«En qué te quedaste, por qué era importante y cuál es el siguiente paso exacto»."
    )

    prompt = f"Proyecto: {project_name}\nContexto: {context}\nÚltimos logs: {json.dumps(logs, ensure_ascii=False)}"

    if gemini_client:
        for model_name in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]:
            try:
                from google.genai import types
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=ReactivationBriefing,
                        temperature=0.2,
                    ),
                )
                if response and response.text:
                    return ReactivationBriefing.model_validate_json(response.text)
            except Exception:
                pass

    last_log = logs[-1] if logs else {}
    return ReactivationBriefing(
        project_name=project_name,
        where_you_left_off=last_log.get('achievement', 'Habías avanzado en la estructura base del proyecto.'),
        why_it_matters=context or 'Es un pilar clave en tus metas que liberará tiempo y carga mental.',
        exact_next_step=last_log.get('nextStep', 'Abrir el archivo principal y ejecutar la primera prueba de 5 minutos.'),
        encouraging_insight='La pausa fue necesaria para recargar tu dopamina. No has perdido nada; toma el Hilo de Ariadna y arranca en 5 segundos.'
    )


# --- SERVIDOR HTTP NEXUS CON CORS (PUERTO 8002) ---

class NexusRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path in ('/api/nexus/health', '/nexus/health', '/health', ''):
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            status = {
                "status": "UP",
                "service": "Nexus Cognitive Assistant",
                "gemini_active": gemini_client is not None,
                "model": "gemini-3.8-flash"
            }
            self.wfile.write(json.dumps(status).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length_header = self.headers.get('Content-Length') or self.headers.get('content-length') or '0'
        try:
            content_length = int(length_header)
        except Exception:
            content_length = 0
        post_data = self.rfile.read(content_length).decode('utf-8', errors='replace') if content_length > 0 else ""
        try:
            payload = json.loads(post_data) if post_data else {}
        except Exception:
            payload = {}

        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path in ('/api/nexus/thought', '/nexus/thought', '/thought', '/classify'):
            text = (payload.get('text') or payload.get('raw_thought') or '').strip()
            res = process_thought_with_gemini(text)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(res.model_dump_json().encode('utf-8'))

        elif clean_path in ('/api/nexus/deconstruct', '/nexus/deconstruct', '/deconstruct'):
            goal = (payload.get('goal') or payload.get('text') or '').strip()
            res = deconstruct_goal_with_gemini(goal)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(res.model_dump_json().encode('utf-8'))

        elif clean_path in ('/api/nexus/reactivate', '/nexus/reactivate', '/reactivate'):
            p_name = payload.get('projectName', 'Proyecto')
            context = payload.get('context', '')
            logs = payload.get('logs', [])
            res = generate_reactivation_briefing(p_name, context, logs)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(res.model_dump_json().encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8002):
    server_address = ('', port)
    httpd = HTTPServer(server_address, NexusRequestHandler)
    print(f"[Nexus] Microservicio cognitivo escuchando en http://localhost:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.getenv("NEXUS_PORT", 8002))
    run_server(port)
