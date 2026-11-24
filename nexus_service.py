"""
Nexus Cognitive Service for Hive Brain / Proyectazo (TDAH Executive Assistant)
Powered by Gemini 2.5 Flash / Google GenAI SDK with Structured Outputs (Pydantic).
Handles thought classification, atomic goal deconstruction, gap filling, and dormant project reactivation.
"""

import os
import json
import re
import unicodedata
import smtplib
import ssl
import threading
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import jarvis

# Cargar variables de entorno
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY", "")

DEFAULT_AI_MODELS = "gemini-2.5-flash,gemini-flash-latest"


def ai_models() -> list:
    """Modelos a probar en orden (NEXUS_AI_MODELS en .env, separados por comas)."""
    raw = os.getenv("NEXUS_AI_MODELS", "") or DEFAULT_AI_MODELS
    models = [m.strip() for m in raw.split(",") if m.strip()]
    return models or DEFAULT_AI_MODELS.split(",")


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
    INDIGO = "#6366F1"   # Tarea Pendiente / Tarea en General

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
    matched: bool = Field(default=True, description="False si el clasificador heurístico no reconoció nada y devolvió el valor por defecto")

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

# --- CLASIFICADOR LOCAL COMPARTIDO CON EL NAVEGADOR ---
_RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "clasificador-reglas.js")


def _load_rules() -> dict:
    with open(_RULES_PATH, "r", encoding="utf-8") as f:
        text = f.read()
    start = text.index("/*REGLAS-JSON*/") + len("/*REGLAS-JSON*/")
    end = text.index("/*FIN-REGLAS-JSON*/")
    return json.loads(text[start:end])


CLASSIFIER_RULES = _load_rules()


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", (text or "").lower())
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9$]+", " ", stripped).strip()


def classify_local(text: str):
    """Misma lógica que classifyLocal() en js/captura-parser.js (sin la memoria personal)."""
    padded = " " + _normalize(text) + " "
    best = None
    for order, cat in enumerate(CLASSIFIER_RULES["categories"]):
        reasons = []
        for kw in cat["keywords"]:
            stem = _normalize(kw.rstrip("*"))
            if not stem:
                continue
            hit = (" " + stem) in padded if kw.endswith("*") else (" " + stem + " ") in padded
            if hit:
                reasons.append(kw.rstrip("*"))
        if reasons and (best is None or len(reasons) > len(best[1])):
            best = (cat["category"], reasons)
    return best if best else ("humo_general", [])


# Textos de cada categoría para la respuesta del heurístico
_CATEGORY_PROFILES = {
    "humo_rojo": dict(thought_type="urgente", smoke_color=SmokeColor.ROJO, target_module=ModuleTarget.TASKS,
                      suggested_action="Sincronizar con Google Tasks y fijar alerta persistente",
                      first_step="Abrir portal o preparar documento de trámite en 5 minutos", cognitive_weight="fuego"),
    "humo_blanco": dict(thought_type="intrusivo", smoke_color=SmokeColor.BLANCO, target_module=ModuleTarget.PENSADERO,
                        suggested_action="Soltar sin culpa para vaciar la memoria de trabajo RAM",
                        first_step="", cognitive_weight="ligero"),
    "humo_azul": dict(thought_type="deep_work", smoke_color=SmokeColor.AZUL, target_module=ModuleTarget.DEEPWORK,
                      suggested_action="Agendar bloque de Deep Work de 2h con buffers de 15 min",
                      first_step="Abrir editor de código y silenciar notificaciones", cognitive_weight="pesado"),
    "humo_verde": dict(thought_type="habito", smoke_color=SmokeColor.VERDE, target_module=ModuleTarget.HABITS,
                       suggested_action="Incrementar racha y detonar recompensa de dopamina",
                       first_step="Hacer 2 minutos de la actividad ahora mismo", cognitive_weight="ligero"),
    "humo_purpura": dict(thought_type="contacto", smoke_color=SmokeColor.PURPURA, target_module=ModuleTarget.CRM,
                         suggested_action="Consultar Avatar de Memoria social antes de llamar",
                         first_step="Enviar mensaje de audio corto de 15 segundos", cognitive_weight="medio"),
    "humo_naranja": dict(thought_type="finanzas", smoke_color=SmokeColor.NARANJA, target_module=ModuleTarget.FINANCES,
                         suggested_action="Evaluar fricción sobre dinero libre mensual o congelar 72h",
                         first_step="Calcular porcentaje de impacto sobre el presupuesto libre", cognitive_weight="medio"),
    "humo_ceniza": dict(thought_type="hibernacion", smoke_color=SmokeColor.CENIZA, target_module=ModuleTarget.PENSADERO,
                        suggested_action="Hibernar 14 a 30 días para evitar sobrecarga en pantalla",
                        first_step="", cognitive_weight="ligero"),
    "humo_tarea": dict(thought_type="tarea", smoke_color=SmokeColor.INDIGO, target_module=ModuleTarget.TASKS,
                       suggested_action="Registrar en lista de tareas pendientes y programar aviso",
                       first_step="Despejar 10 minutos o fijar un recordatorio", cognitive_weight="medio"),
    "humo_dorado": dict(thought_type="idea_proyecto", smoke_color=SmokeColor.DORADO, target_module=ModuleTarget.PROJECTS,
                        suggested_action="Masticar en micro-pasos de 15 min y vincular a proyecto",
                        first_step="Escribir título y objetivo en 1 línea", cognitive_weight="medio"),
}

# --- FUNCIONES DE PROCESAMIENTO GEMINI ---

def process_thought_with_gemini(user_text: str) -> ThoughtClassification:
    system_instruction = (
        "Eres el núcleo cognitivo 'Nexus' de Hive Brain, una app para TDAH. "
        "Tu misión es reducir la fricción mental y la ceguera temporal. "
        "Clasifica el pensamiento recibido, asigna el color de humo correspondiente "
        "y define el módulo de destino sin rodeos."
    )

    if gemini_client:
        for model_name in ai_models():
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

    # Fallback local: las mismas reglas que el navegador (js/clasificador-reglas.js)
    category, reasons = classify_local(user_text)
    profile = _CATEGORY_PROFILES.get(category)
    if profile is None:
        return ThoughtClassification(
            raw_thought=user_text,
            thought_type="idea_proyecto",
            smoke_color=SmokeColor.DORADO,
            target_module=ModuleTarget.PROJECTS,
            suggested_action="Masticar en micro-pasos de 15 min y vincular a proyecto",
            first_step="Escribir título y objetivo en 1 línea",
            cognitive_weight="medio",
            matched=False
        )
    return ThoughtClassification(raw_thought=user_text, matched=True, **profile)


def deconstruct_goal_with_gemini(goal_text: str) -> GoalDeconstruction:
    system_instruction = (
        "Eres el asistente TDAH Nexus. El usuario tiene disfunción ejecutiva y ceguera temporal. "
        "Tu trabajo es desmenuzar su meta en micro-pasos atómicos de 15 a 20 minutos máximo. "
        "Define obligatoriamente una micro-tarea trivial e hiperespecífica (Kickstart Action) "
        "para romper la inercia de arranque. Añade un 30% de buffer temporal realista."
    )

    if gemini_client:
        for model_name in ai_models():
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
        for model_name in ai_models():
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


# --- GESTOR DE CONEXIÓN CON CORREO GOOGLE (GMAIL SMTP & RECORDATORIOS) ---

class GoogleMailManager:
    """
    Gestor de integración con Google Mail (Gmail SMTP / Google Workspace)
    para recordatorios automáticos de tareas y notificaciones programadas.
    """
    def __init__(self, storage_dir: str = "data"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self.config_file = os.path.join(self.storage_dir, "google_mail_config.json")
        self.reminders_file = os.path.join(self.storage_dir, "scheduled_emails.json")
        self.lock = threading.Lock()
        self.config = self._load_config()
        self.reminders = self._load_reminders()
        self._start_scheduler()

    def _load_config(self) -> dict:
        cfg = {
            "smtp_server": "smtp.gmail.com",
            "smtp_port": 587,
            "gmail_user": os.getenv("GMAIL_USER", ""),
            "gmail_app_password": os.getenv("GMAIL_APP_PASSWORD", ""),
            "default_recipient": os.getenv("GMAIL_RECIPIENT", ""),
            "sender_name": "Nexus Assistant"
        }
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    cfg.update(saved)
            except Exception as e:
                print(f"[GoogleMailManager] Error cargando config: {e}")
        return cfg

    def save_config(self, new_cfg: dict) -> dict:
        with self.lock:
            for k in ["smtp_server", "smtp_port", "gmail_user", "gmail_app_password", "default_recipient", "sender_name"]:
                if k in new_cfg and new_cfg[k] is not None:
                    self.config[k] = new_cfg[k]
            try:
                with open(self.config_file, "w", encoding="utf-8") as f:
                    json.dump(self.config, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"[GoogleMailManager] Error guardando config: {e}")
        return self.get_status()

    def _load_reminders(self) -> list:
        if os.path.exists(self.reminders_file):
            try:
                with open(self.reminders_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[GoogleMailManager] Error cargando recordatorios: {e}")
        return []

    def _save_reminders(self):
        try:
            with open(self.reminders_file, "w", encoding="utf-8") as f:
                json.dump(self.reminders, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[GoogleMailManager] Error guardando recordatorios: {e}")

    def get_status(self) -> dict:
        user = self.config.get("gmail_user", "").strip()
        pwd = self.config.get("gmail_app_password", "").strip()
        configured = bool(user and pwd)
        masked_user = (user[:3] + "***@" + user.split("@")[-1]) if ("@" in user and len(user) > 6) else user
        pending_count = sum(1 for r in self.reminders if r.get("status") == "pending")
        return {
            "configured": configured,
            "smtp_server": self.config.get("smtp_server", "smtp.gmail.com"),
            "smtp_port": self.config.get("smtp_port", 587),
            "gmail_user": user,
            "gmail_user_masked": masked_user,
            "default_recipient": self.config.get("default_recipient", user),
            "sender_name": self.config.get("sender_name", "Nexus Assistant"),
            "pending_reminders": pending_count,
            "total_reminders": len(self.reminders)
        }

    def test_connection(self, user=None, app_password=None, to_email=None) -> dict:
        gmail_user = (user or self.config.get("gmail_user", "")).strip()
        pwd = (app_password or self.config.get("gmail_app_password", "")).strip().replace(" ", "")
        recipient = (to_email or self.config.get("default_recipient") or gmail_user).strip()

        if not gmail_user or not pwd:
            return {
                "success": False,
                "error": "Faltan credenciales: Correo Gmail y Contraseña de Aplicación de 16 caracteres son requeridos."
            }

        server_host = "smtp.gmail.com"
        connected = False
        server = None
        last_error = ""

        # Intento 1: Puerto 587 (STARTTLS)
        try:
            server = smtplib.SMTP(server_host, 587, timeout=8)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user, pwd)
            connected = True
            self.config["smtp_port"] = 587
        except (smtplib.SMTPAuthenticationError, smtplib.SMTPServerDisconnected) as auth_err:
            return {
                "success": False,
                "error": f"Google Mail rechazó las credenciales. Causa habitual: La contraseña de aplicación de 16 caracteres no coincide con la cuenta '{gmail_user}', o tu cuenta Google no tiene la 'Verificación en dos pasos' (2FA) activada. Genera una contraseña de app en https://myaccount.google.com/apppasswords seleccionando 'Otra (nombre personalizado)'."
            }
        except Exception as e587:
            last_error = str(e587)

        # Intento 2: Puerto 465 (SSL Directo) como alternativa
        if not connected:
            try:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(server_host, 465, timeout=8, context=context)
                server.ehlo()
                server.login(gmail_user, pwd)
                connected = True
                self.config["smtp_port"] = 465
            except (smtplib.SMTPAuthenticationError, smtplib.SMTPServerDisconnected) as auth_err:
                return {
                    "success": False,
                    "error": f"Google Mail rechazó las credenciales. Causa habitual: La contraseña de aplicación de 16 caracteres no coincide con la cuenta '{gmail_user}', o tu cuenta Google no tiene la 'Verificación en dos pasos' (2FA) activada. Genera una contraseña de app en https://myaccount.google.com/apppasswords seleccionando 'Otra (nombre personalizado)'."
                }
            except Exception as e465:
                last_error = f"Puerto 587 ({last_error}) y Puerto 465 ({str(e465)})"

        if not connected or not server:
            return {
                "success": False,
                "error": f"No se pudo conectar a los servidores de Google Mail (smtp.gmail.com:587/465): {last_error}"
            }

        # Guardar credenciales validadas
        self.save_config({
            "gmail_user": gmail_user,
            "gmail_app_password": pwd,
            "default_recipient": recipient or gmail_user,
            "smtp_port": self.config.get("smtp_port", 587)
        })

        try:
            if recipient:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "✨ [Nexus AI] Conexión de Correo Google Verificada con Éxito"
                msg["From"] = f"{self.config.get('sender_name', 'Nexus Assistant')} <{gmail_user}>"
                msg["To"] = recipient

                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 24px; border-radius: 16px; max-width: 580px; margin: auto; border: 1px solid #312e81;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 20px;">⚡</div>
                    <div>
                      <h2 style="margin: 0; font-size: 18px; color: #ffffff; letter-spacing: -0.02em;">Nexus Cognitive Assistant</h2>
                      <span style="font-size: 12px; color: #818cf8;">Hive Brain &bull; TDAH Executive System</span>
                    </div>
                  </div>
                  <div style="background-color: #1e1b4b; border: 1px solid #4338ca; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                    <div style="color: #a5b4fc; font-size: 13px; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">🟢 Conexión Google Mail Activa</div>
                    <p style="margin: 0; font-size: 15px; color: #e0e7ff; line-height: 1.5;">
                      Tu cuenta <strong>{gmail_user}</strong> está correctamente conectada a Nexus mediante el protocolo seguro de Google Mail.
                    </p>
                  </div>
                  <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px;">
                    A partir de ahora, cada vez que programes una tarea con <strong>Humo Índigo</strong> o solicites un aviso diferido, Nexus te enviará un recordatorio atómico con los micro-pasos de 15 minutos para vencer la inercia y disfunción ejecutiva.
                  </p>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="http://localhost:8000" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                      Abrir Hive Brain
                    </a>
                  </div>
                  <div style="border-top: 1px solid #1e293b; margin-top: 24px; padding-top: 14px; text-align: center; font-size: 11px; color: #64748b;">
                    Enviado automáticamente por el servicio de recordatorios de Proyectazo / Nexus.
                  </div>
                </div>
                """
                msg.attach(MIMEText(html_body, "html"))
                server.sendmail(gmail_user, [recipient], msg.as_string())

            server.quit()
            return {
                "success": True,
                "message": f"Conexión exitosa con Google Mail ({gmail_user}). Correo de verificación enviado a {recipient}."
            }
        except Exception as send_err:
            try:
                server.quit()
            except Exception:
                pass
            return {
                "success": True,
                "message": f"Conexión y autenticación con Google Mail exitosa ({gmail_user}). Nota sobre el envío de prueba: {str(send_err)}"
            }

    def schedule_task_reminder(self, task_id: str, task_title: str, scheduled_time, recipient: str = "", steps: list = None, notes: str = "") -> dict:
        with self.lock:
            try:
                if isinstance(scheduled_time, (int, float)):
                    dt = datetime.fromtimestamp(scheduled_time / 1000.0, tz=timezone.utc)
                elif isinstance(scheduled_time, str):
                    # Manejar formatos ISO o '2026-10-20T10:00'
                    clean_ts = scheduled_time.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(clean_ts)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = datetime.now(timezone.utc)
            except Exception as parse_e:
                print(f"[GoogleMailManager] Error parseando fecha {scheduled_time}: {parse_e}")
                dt = datetime.now(timezone.utc)

            recip = (recipient or self.config.get("default_recipient") or self.config.get("gmail_user", "")).strip()

            reminder_id = f"rem_{int(time.time()*1000)}"
            item = {
                "id": reminder_id,
                "task_id": str(task_id),
                "task_title": task_title or "Tarea Pendiente",
                "scheduled_time": dt.isoformat(),
                "scheduled_epoch": dt.timestamp(),
                "recipient": recip,
                "steps": steps or [],
                "notes": notes or "",
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.reminders.append(item)
            self._save_reminders()

            return {
                "success": True,
                "reminder": item,
                "message": f"Recordatorio programado para {dt.strftime('%d/%m/%Y %H:%M UTC')} hacia {recip}."
            }

    def cancel_reminder(self, reminder_id: str) -> dict:
        with self.lock:
            for r in self.reminders:
                if r.get("id") == reminder_id or r.get("task_id") == str(reminder_id):
                    r["status"] = "cancelled"
                    self._save_reminders()
                    return {"success": True, "message": "Recordatorio cancelado"}
            return {"success": False, "error": "Recordatorio no encontrado"}

    def get_reminders(self) -> list:
        return self.reminders

    def _start_scheduler(self):
        t = threading.Thread(target=self._scheduler_loop, daemon=True)
        t.start()

    def _scheduler_loop(self):
        while True:
            try:
                time.sleep(20)
                now_epoch = time.time()
                to_send = []
                with self.lock:
                    for r in self.reminders:
                        if r.get("status") == "pending" and r.get("scheduled_epoch", 0) <= now_epoch:
                            to_send.append(r)

                for r in to_send:
                    self._send_scheduled_email(r)
            except Exception as e:
                print(f"[GoogleMailManager] Error en bucle del planificador: {e}")

    def _send_scheduled_email(self, reminder: dict):
        gmail_user = self.config.get("gmail_user", "").strip()
        pwd = self.config.get("gmail_app_password", "").strip().replace(" ", "")
        recipient = (reminder.get("recipient") or self.config.get("default_recipient") or gmail_user).strip()

        if not gmail_user or not pwd or not recipient:
            with self.lock:
                reminder["status"] = "failed"
                reminder["error"] = "Credenciales Google Mail no configuradas"
                self._save_reminders()
            return

        try:
            server = smtplib.SMTP(self.config.get("smtp_server", "smtp.gmail.com"), int(self.config.get("smtp_port", 587)), timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user, pwd)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"☑️ Recordatorio Nexus: {reminder.get('task_title', 'Tarea Pendiente')}"
            msg["From"] = f"{self.config.get('sender_name', 'Nexus Assistant')} <{gmail_user}>"
            msg["To"] = recipient

            steps_html = ""
            if reminder.get("steps"):
                steps_html = "<div style='margin-top: 14px;'><strong style='font-size:12px; color:#818cf8; text-transform:uppercase;'>Micro-pasos de 15 min recomendados:</strong><ul style='margin-top: 8px; padding-left: 20px; color:#cbd5e1; font-size:14px;'>"
                for s in reminder["steps"]:
                    steps_html += f"<li style='margin-bottom: 6px;'>{s}</li>"
                steps_html += "</ul></div>"

            notes_html = f"<p style='color:#94a3b8; font-size:13px; font-style:italic;'>{reminder.get('notes')}</p>" if reminder.get('notes') else ""

            html_body = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 24px; border-radius: 16px; max-width: 580px; margin: auto; border: 1px solid #4338ca;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 24px;">☑️</span>
                  <div>
                    <h3 style="margin: 0; font-size: 16px; color: #e0e7ff;">Tarea Programada Activada</h3>
                    <span style="font-size: 11px; color: #6366f1; font-weight: 600;">HUMO ÍNDIGO &bull; VENCIMIENTO / ACCIÓN</span>
                  </div>
                </div>
              </div>
              <div style="background-color: #1e1b4b; border: 1px solid #6366f1; border-radius: 12px; padding: 18px; margin-bottom: 16px;">
                <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #ffffff;">{reminder.get('task_title')}</h2>
                {notes_html}
                {steps_html}
              </div>
              <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
                No necesitas terminarlo todo ahora mismo. Tu único objetivo en este momento es realizar los primeros <strong>2 a 5 minutos</strong> para romper la inercia.
              </p>
              <div style="text-align: center; margin-top: 22px;">
                <a href="http://localhost:8000" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                  Abrir Hive Brain y Marcar Hecho
                </a>
              </div>
            </div>
            """
            msg.attach(MIMEText(html_body, "html"))
            server.sendmail(gmail_user, [recipient], msg.as_string())
            server.quit()

            with self.lock:
                reminder["status"] = "sent"
                reminder["sent_at"] = datetime.now(timezone.utc).isoformat()
                self._save_reminders()
                print(f"[GoogleMailManager] Recordatorio '{reminder.get('task_title')}' enviado a {recipient}")
        except Exception as e:
            print(f"[GoogleMailManager] Error enviando correo programado: {e}")
            with self.lock:
                reminder["status"] = "failed"
                reminder["error"] = str(e)
                self._save_reminders()

# Instancia global del gestor de correo Google
mail_manager = GoogleMailManager()

# --- SERVIDOR HTTP NEXUS CON CORS (PUERTO 8002) ---

class NexusRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_HEAD(self):
        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path in ('/api/nexus/health', '/nexus/health', '/health', '',
                           '/api/nexus/mail/status', '/nexus/mail/status', '/mail/status',
                           '/api/nexus/mail/scheduled', '/nexus/mail/scheduled', '/mail/scheduled'):
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
        else:
            self.send_response(404)
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
                "model": ai_models()[0],
                "jarvis": jarvis.status()
            }
            self.wfile.write(json.dumps(status).encode('utf-8'))
        elif clean_path in ('/api/nexus/mail/status', '/nexus/mail/status', '/mail/status'):
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            res = mail_manager.get_status()
            self.wfile.write(json.dumps(res).encode('utf-8'))
        elif clean_path in ('/api/nexus/mail/scheduled', '/nexus/mail/scheduled', '/mail/scheduled'):
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            res = mail_manager.get_reminders()
            self.wfile.write(json.dumps(res).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length_header = self.headers.get('Content-Length') or self.headers.get('content-length') or '0'
        try:
            content_length = int(length_header)
        except Exception:
            content_length = 0

        # Blindaje de seguridad: Límite estricto de carga útil (2MB) para prevenir ataques de saturación de memoria
        if content_length > 2 * 1024 * 1024:
            self.send_response(413)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "Payload too large (max 2MB)"}')
            return

        post_data = self.rfile.read(content_length).decode('utf-8', errors='replace') if content_length > 0 else ""
        try:
            payload = json.loads(post_data) if post_data else {}
        except Exception:
            payload = {}

        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path in ('/api/nexus/jarvis', '/nexus/jarvis', '/jarvis'):
            code, body = jarvis.handle(payload)
            self.send_response(code)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(body, ensure_ascii=False).encode('utf-8'))
            return
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

        elif clean_path in ('/api/nexus/mail/config', '/nexus/mail/config', '/mail/config'):
            status = mail_manager.save_config(payload)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(status).encode('utf-8'))

        elif clean_path in ('/api/nexus/mail/test', '/nexus/mail/test', '/mail/test'):
            user = payload.get('user') or payload.get('gmail_user')
            app_pwd = payload.get('app_password') or payload.get('gmail_app_password')
            to_email = payload.get('to_email') or payload.get('recipient')
            res = mail_manager.test_connection(user=user, app_password=app_pwd, to_email=to_email)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))

        elif clean_path in ('/api/nexus/mail/schedule', '/nexus/mail/schedule', '/mail/schedule'):
            task_id = payload.get('taskId') or payload.get('task_id') or payload.get('id')
            task_title = payload.get('taskTitle') or payload.get('title') or payload.get('text', 'Tarea Pendiente')
            scheduled_time = payload.get('scheduledTime') or payload.get('scheduled_time') or payload.get('dueDate') or payload.get('due_date')
            recipient = payload.get('recipient') or payload.get('to_email', '')
            steps = payload.get('steps') or payload.get('subtasks') or []
            notes = payload.get('notes') or payload.get('desc', '')
            res = mail_manager.schedule_task_reminder(
                task_id=task_id,
                task_title=task_title,
                scheduled_time=scheduled_time,
                recipient=recipient,
                steps=steps,
                notes=notes
            )
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))

        elif clean_path in ('/api/nexus/mail/cancel', '/nexus/mail/cancel', '/mail/cancel'):
            rem_id = payload.get('reminderId') or payload.get('reminder_id') or payload.get('taskId') or payload.get('task_id')
            res = mail_manager.cancel_reminder(str(rem_id))
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def run_server(port=8002):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, NexusRequestHandler)
    print(f"[Nexus] Microservicio cognitivo multihilo escuchando en http://localhost:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.getenv("NEXUS_PORT", 8002))
    run_server(port)
