# Propuesta de mejora integral — Nexus Orb / Proyectazo

Fecha: 2026-11-19 · Rama revisada: `dev`

Objetivo: que la app deje de ser "un sistema con muchas funciones" y pase a ser **un asistente personal (tipo Jarvis) que piensa por ti las partes aburridas**, pensado para un cerebro con TDAH: menos decisiones, menos pantallas, más empuje proactivo.

---

## 0. Diagnóstico rápido

**Lo que ya está bien (conservar):**
- Captura ultrarrápida (orbe, mantener para hablar, Ctrl+Shift+Espacio, compartir desde Android).
- Clasificador local sin nube por defecto, con memoria de correcciones.
- Offline-first con IndexedDB y cola de borrados.
- Ideas TDAH sólidas: límite WIP, "Para hoy" sin culpa, hibernar sin culpa, Deshacer en todo, modo Zen, ruido marrón, reactivación de proyectos.
- Tests (pytest, node --test, integración Spring) y CI con Dependabot.

**Problemas principales:**

| Ámbito | Problema | Impacto |
|---|---|---|
| Utilidad / TDAH | Demasiados conceptos: 9 colores de humo, Pensadero, Baúl, Lienzo, Radar, Bitácora, Zen, Deep Work, Kanban, CRM, fricción financiera… | Carga cognitiva alta: justo lo que la app quiere evitar. Cuesta decidir *dónde* va algo |
| Jarvis | Nexus es un **parser de comandos** + 3 llamadas sueltas a Gemini (clasificar, deconstruir, reactivar). No conversa, no recuerda, no actúa por iniciativa propia | No se siente como asistente, sino como formulario por voz |
| Arquitectura | 4 servicios (Postgres + Spring Boot + Python + nginx) para **una persona**, en un equipo con ~260 MB libres | Pesado de arrancar y mantener; dos lenguajes de backend |
| Frontend | `index.html` de 160 KB, 148 `onclick` inline, objeto global `app` al que 17 archivos añaden métodos, HTML generado con cadenas | Difícil de cambiar sin romper otra cosa; riesgo XSS permanente (depende de `escapeHtml` en cada sitio) |
| Servicio IA | `http.server` a mano, nombres de modelo fijos con cadena de reintentos (`gemini-1.5-flash` ya retirado, `gemini-3.8-flash` en health) | Fallos silenciosos cuando Google retira un modelo |
| Seguridad | Contraseña de aplicación de Gmail en texto plano; VAPID privada en BD | Riesgo si se filtra el disco o un backup |
| Repositorio | `nexus_deploy_v1.tar.gz` 52 MB, `archive/`, `__pycache__`, `android/build`, 6 especificaciones distintas (Claude/GPT/DeepSeek…) | Ruido; no hay una única fuente de verdad del producto |

---

## 1. Producto y utilidad (lo más importante)

### 1.1 Reducir a 3 verbos
Toda la app gira en torno a tres preguntas que una persona con TDAH se hace:

1. **Soltar** — "tengo algo en la cabeza" → captura en 1 segundo, sin elegir nada.
2. **Ahora** — "¿qué hago ya?" → **una sola** acción visible, con tiempo estimado y botón *Empezar*.
3. **Repasar** — "¿cómo voy?" → resumen diario/semanal, proyectos, archivo.

Todo lo demás (Baúl, Lienzo, Radar, Bitácora, CRM, finanzas) se convierte en **filtros o etiquetas dentro de Repasar**, no en pantallas propias. Navegación inferior de 3 botones + el orbe en el centro.

### 1.2 Simplificar la taxonomía de colores
De 9 colores a **4 + "luego"**, y que los asigne siempre Jarvis (el usuario solo corrige):

| Color | Significado |
|---|---|
| 🔴 Urgente | Tiene fecha o consecuencia |
| 🔵 Proyecto | Pertenece a un proyecto (Jarvis elige cuál) |
| 🟢 Rutina / vida | Hábitos, salud, recados, personas, dinero |
| 🟡 Idea | Sin acción todavía |
| ⚪ Luego / soltar | Someday, desahogo, hibernado |

Los subtipos actuales (CRM, finanzas, hábitos…) pasan a ser etiquetas automáticas.

### 1.3 Funciones TDAH nuevas
- **Ceguera temporal**: estimación de duración en cada tarea, temporizador visual (disco que se vacía), y aprendizaje "estimaste 15 min, tardaste 40" para corregir futuras estimaciones.
- **Arranque asistido (anti-parálisis)**: botón "No sé por dónde empezar" → Jarvis propone el primer paso de 2 minutos y arranca un temporizador corto.
- **Body doubling**: modo foco con Jarvis "acompañando": check-in suave cada X minutos por voz/notificación ("¿Sigues con el contrato?") y registro de distracciones con un toque.
- **Cierre del día en 60 s**: 3 preguntas (¿qué hiciste?, ¿qué queda abierto?, ¿qué es lo primero mañana?). Alimenta el briefing de la mañana.
- **Energía antes que prioridad**: al abrir "Ahora", preguntar nivel de energía (🔋 baja/media/alta) y adaptar la sugerencia.
- **Recompensas sin culpa**: racha flexible (no se rompe por un día), "has hecho X esta semana" en vez de "tienes Y pendientes". Nunca mostrar contadores rojos acumulados.
- **Recordatorios por contexto**: "cuando llegue a casa", "cuando abra el ordenador" (geofence en Android, inicio de sesión en Electron).
- **Hiperfoco**: aviso amable tras 90 min seguidos (agua, comer, moverse).

---

## 2. Jarvis: de parser a asistente real

### 2.1 Arquitectura del agente
```
Voz / texto / atajo / notificación
            │
            ▼
   Jarvis (LLM con herramientas)
   ├─ Memoria: perfil, preferencias, historial resumido
   ├─ Contexto: tareas, proyectos, calendario, energía, hora
   └─ Herramientas (llaman a la API propia):
        crear_tarea · mover_tarea · programar_aviso · buscar
        deconstruir_meta · agendar_bloque · leer_calendario
        resumir_dia · enviar_correo (con confirmación)
```
- Un único endpoint `POST /api/jarvis` con conversación + **tool calling**, en lugar de N endpoints de IA especializados.
- **Proveedor intercambiable** (Claude, Gemini o un modelo local vía Ollama) detrás de una interfaz; el modelo se configura en `.env`, no se codifica en el código. Recomendación por defecto: Claude Sonnet 5.5 para conversación y Haiku 5.5 para clasificación barata.
- **Modo local primero**: el clasificador por reglas sigue siendo la primera capa (gratis, offline, privado); el LLM solo entra cuando hace falta o el usuario lo activa.
- **Acciones destructivas o externas** (enviar correo, borrar, mover muchas tareas) siempre con confirmación y botón Deshacer.

### 2.2 Jarvis proactivo
- **Briefing de mañana** (hora configurable): agenda del día, 1–3 cosas importantes, algo que lleva días parado. Por voz al abrir la app o como notificación.
- **Recordatorio de transición**: 10 min antes de cada evento del calendario ("En 10 min tienes la llamada; cierra lo que estás haciendo").
- **Rescate de proyectos dormidos**: semanal, "CytoHelix lleva 12 días sin tocar: ¿lo reactivo con un paso pequeño o lo hiberno?".
- **Revisión semanal guiada** (10 min, viernes).

### 2.3 Voz
- Entrada: Web Speech donde exista; **Whisper en servidor** (o `whisper.cpp` pequeño) como alternativa para iOS/Firefox (ya listado en pendientes).
- **Salida por voz** (TTS) opcional, con frases cortas. Palabra de activación opcional en escritorio ("Oye Nexus").

### 2.4 Integraciones (por prioridad)
1. **Google Calendar (OAuth)** — leer y crear bloques. Sustituye también la contraseña de Gmail.
2. **Gmail (OAuth)** — "¿tengo algo urgente?" y convertir correos en tareas.
3. Recordatorios del móvil / notificaciones push (ya existe la base).
4. Más adelante: Notion/Drive, WhatsApp vía compartir.

---

## 3. Software y arquitectura

### 3.1 Backend: un solo servicio
Recomendación: **unificar en un único backend Python (FastAPI) + SQLite** (Postgres opcional).
- Motivo: la IA ya está en Python; un usuario no necesita Postgres; consumo de RAM de ~1,5 GB a ~150 MB; un solo lenguaje.
- Migración: portar los controladores de Spring (auth, proyectos, tareas, pensadero, inbox, push, sync) uno a uno manteniendo **los mismos contratos JSON**, con los tests de integración actuales como referencia.
- Alternativa si se prefiere mantener Java: dejar Spring y absorber el servicio IA en él (Spring AI). Lo importante es **pasar de 4 a 2 contenedores** (app + proxy).
- Migraciones de esquema con Alembic (o Flyway si se queda Java), pendiente ya identificado.
- Tareas programadas (briefings, avisos) en el propio backend con un planificador (APScheduler).

### 3.2 Frontend: modularizar sin reescribir de golpe
1. Introducir **Vite** (ya hay npm para Tailwind) y pasar los `<script>` a **módulos ES** (`import`/`export`).
2. Sustituir los 148 `onclick` por delegación de eventos (`data-action="..."`).
3. Migrar vista a vista a **componentes** (recomendado: Svelte o Preact, ligeros) empezando por "Ahora", que es la más usada. HTML con plantillas que escapan por defecto → adiós al riesgo XSS por olvido.
4. **TypeScript** progresivo (JSDoc + `checkJs` primero).
5. Estado en un store central con eventos, en lugar de un objeto `app` gigante.
6. El orbe WebGL se mantiene como componente aislado; pausarlo cuando no se ve (ahorra batería).

### 3.3 Plataformas
- Mantener **PWA** como base. Android con Capacitor (ya hay `capacitor.config.json`) en vez de WebView manual: da acceso a notificaciones locales, geofence y widget.
- **Widget Android / acceso rápido** en pantalla de bloqueo: "Soltar" y "Ahora".
- Electron: mantener solo para el atajo global y la bandeja del sistema.

### 3.4 Calidad
- Tests E2E con Playwright **en CI** (no en local, por la RAM del equipo).
- Lint/format (ESLint + Prettier, Ruff) en CI.
- Registro de errores del cliente hacia el backend (sin datos personales).

---

## 4. Diseño (UI/UX)

- **Una pantalla, una decisión.** "Ahora" muestra una tarjeta grande: título, tiempo estimado, botón *Empezar*, enlaces pequeños *Otra* / *Partir en pasos* / *Luego*.
- **Modo calma**: tipografía grande, mucho espacio, animaciones reducidas (respetar `prefers-reduced-motion`), sin badges rojos.
- **Orbe como estado de Jarvis**: escucha (pulsa), piensa (gira), habla (onda), en foco (tenue). Que comunique, no solo decore.
- **Feedback inmediato**: sonido/vibración corta al completar; animación de 300 ms, no más.
- Tema claro revisado con el script de contraste existente; tema "nocturno cálido" para la noche.
- **Onboarding de 3 pasos** (no un tour): nombre, hora del briefing, permiso de notificaciones. El resto se descubre con sugerencias contextuales.
- Accesibilidad: objetivos táctiles ≥ 44 px (ya), foco visible, todo usable con teclado y lector de pantalla.

---

## 5. Estructura del repositorio

```
Proyectazo/
├── apps/
│   ├── web/          # Vite + componentes (lo que hoy es index.html + js/)
│   ├── desktop/      # Electron (atajo global)
│   └── android/      # Capacitor
├── server/           # backend único (API + Jarvis + planificador)
│   ├── api/  jarvis/  tools/  scheduler/  tests/
├── shared/           # reglas del clasificador, tipos/contratos JSON
├── docs/
│   ├── PRODUCTO.md   # ÚNICA especificación vigente
│   └── archivo/      # PDFs de Claude/GPT/DeepSeek, versiones viejas
├── docker-compose.yml  # app + proxy HTTPS (Caddy)
└── .github/
```
Limpieza inmediata: borrar `nexus_deploy_v1.tar.gz`, `__pycache__/`, `android/build/`, mover `archive/` y los PDFs a `docs/archivo/` (o fuera del repo).

---

## 6. Seguridad y privacidad
- OAuth para Google (elimina la contraseña de Gmail en texto plano).
- Secretos (VAPID, claves de IA) cifrados en reposo con una clave de `.env`.
- **HTTPS por defecto** con Caddy en el compose (necesario para voz y push en el móvil).
- Backup automático diario de la base de datos (un archivo SQLite es trivial de copiar).
- Jarvis: enviar al LLM solo el contexto necesario; el Baúl nunca sale del dispositivo.
- Rotar `GEMINI_API_KEY` si el `.env` se compartió.

---

## 7. Hoja de ruta propuesta

| Fase | Duración aprox. | Contenido | Resultado visible |
|---|---|---|---|
| **0. Limpieza** | 1–2 días | Repo ordenado, especificación única, quitar binarios, modelo IA configurable | Nada roto, base clara |
| **1. Simplificar UX** | 1–2 semanas | 3 verbos, 4 colores, pantalla "Ahora" de una tarjeta, cierre del día | App más ligera de usar |
| **2. Jarvis v1** | 2–3 semanas | Endpoint con tool calling, memoria básica, briefing de mañana, arranque asistido | Se siente como asistente |
| **3. Backend único** | 2–3 semanas | FastAPI + SQLite, mismos contratos, HTTPS con Caddy | Arranca con poca RAM |
| **4. Frontend modular** | continuo | Vite, módulos, componentes vista a vista, E2E en CI | Cambios seguros y rápidos |
| **5. Integraciones** | 2 semanas | Google Calendar/Gmail OAuth, avisos de transición, Whisper | Jarvis conoce tu agenda |
| **6. Móvil nativo** | 1–2 semanas | Capacitor, widget, recordatorios por lugar | Captura y "Ahora" desde la pantalla de bloqueo |

Cada fase se entrega por separado y deja la app funcionando.

---

## 8. Decisiones que necesito de ti
1. **Backend**: ¿unificar en Python (recomendado) o mantener Java?
2. **Proveedor de IA** de Jarvis: Claude, Gemini, local (Ollama) o intercambiable.
3. **Framework de frontend**: Svelte (recomendado), Preact, o seguir vanilla con módulos.
4. ¿Estás de acuerdo con reducir a 3 secciones y 4 colores, o hay alguna pantalla actual que uses mucho y quieras conservar tal cual?
5. ¿Por dónde empezamos? Sugerencia: **Fase 0 + Fase 1** (impacto inmediato, poco riesgo).
