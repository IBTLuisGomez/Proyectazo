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

## 7. Hoja de ruta y estado

**Actualizado: 2026-11-27.** Se desarrolla en la rama `development` y, cuando está probado, se fusiona a `main`.

Leyenda: ✅ hecho y probado con tests · 🟡 hecho, falta una comprobación que no se puede hacer en el equipo de desarrollo · ⏳ pendiente · 🔒 bloqueado por algo externo.

### 7.1 Fases de la propuesta original

| Fase | Estado | Qué hay | Qué falta |
|---|---|---|---|
| **0. Limpieza** | ✅ | Repo ordenado, especificación única ([PRODUCTO.md](PRODUCTO.md)), modelo de IA configurable | Borrar del disco `data/` y `backend/data/` (bases H2 antiguas, fuera de git) |
| **1. Simplificar UX** | ✅ | 3 secciones, 4 colores + Luego, tarjeta «Ahora», energía, «No sé por dónde empezar» | Recordatorios por lugar (necesita app nativa con geolocalización) |
| **2. Jarvis v1** | ✅ | Herramientas, memoria, resumen del día, voz de entrada y salida | Activarlo con `ANTHROPIC_API_KEY`; avisos de transición antes de un evento (depende del calendario, Fase 5) |
| **3. Backend único** | ✅ | Python + SQLite, mismos contratos; HTTPS con Caddy (perfil `https`) | Retirar la carpeta `backend/` (Spring) cuando confirmes que la migración está cerrada |
| **4. Frontend modular** | 🟡 | Acciones `data-on-*`, plantillas que escapan, ESLint y comprobación de tipos | Módulos ES con un bundle, componentes, store central y E2E con Playwright. A propósito: solo se puede validar en un navegador, con CI |
| **5. Integraciones** | 🔒 | Nada todavía | Google Calendar y Gmail con OAuth (hace falta tu *Client ID* de Google Cloud); Whisper en servidor para voz en iOS/Firefox |
| **6. Móvil nativo** | 🟡 | Tres widgets Android (lista de pendientes, añadir pendiente, soltar) | Compilar y probar en un teléfono; Capacitor; widget de «Ahora» |

### 7.2 Fases añadidas (7 a 16)

| Fase | Estado | Qué hace | Dónde |
|---|---|---|---|
| **Listas tipo Keep** | ✅ | Listas con casillas y notas, color, fijar, archivar; mezcla entre dispositivos pendiente a pendiente | `js/notas-core.js`, `js/app/views/notas.js`, `server/store.py` |
| **7. Copias de seguridad** | ✅ | Copia diaria de la base en caliente, con comprobación de integridad y rotación | `server/backup.py` |
| **8. Secretos cifrados** | ✅ | Con `NEXUS_SECRET_KEY`, la clave VAPID y la contraseña de Gmail se guardan cifradas | `server/secretbox.py` |
| **9. Errores del navegador** | ✅ | Los fallos de JavaScript llegan al servidor (mensaje, archivo, línea y vista; nunca contenido) | `js/errores.js`, `server/clientlog.py` |
| **10. Jarvis y las listas** | ✅ | Jarvis añade, consulta y marca en las listas | `js/app/features/jarvis.js`, `jarvis.py` |
| **11. Acompañamiento** | 🟡 | Pregunta cada 10, 15 o 25 min si sigues con ello; aviso a los 90 min seguidos | `js/foco-core.js`, `js/app/features/acompanamiento.js` |
| **12. Estimaciones aprendidas** | 🟡 | Compara lo estimado con el foco real y muestra «sueles tardar» | los mismos |
| **13. Cierre del día** | 🟡 | Tres preguntas en un minuto; «lo primero mañana» abre el resumen de la mañana | los mismos |
| **14. Revisión semanal** | 🟡 | Lo hecho, pensamientos sin ordenar, proyectos quietos y foco de la semana | los mismos |
| **15. Android: Soltar y HTTPS local** | 🟡 | Widget «Soltar»; la app acepta certificados instalados por el usuario | `android/app/src/main/java/com/nexus/orb/notas/` |
| **16. Despliegue** | 🟡 | `deploy.sh` genera la clave de cifrado y conoce el perfil HTTPS; script para restaurar una copia | `deploy.sh`, `scripts/restaurar-copia.sh` |

Qué significa 🟡 en cada caso:
- **11 a 14**: la lógica y la interfaz pasan sus tests sin navegador; falta verlas en uno real.
- **15**: sin compilar, porque el equipo de desarrollo no tiene Android SDK.
- **16**: el script de restauración tiene la sintaxis comprobada, pero no se ha ejecutado contra un servidor en marcha.

### 7.3 Fases 17 a 26: energía y módulos

Siguen la hoja de ruta de [ECOSISTEMA_HIVEBRAIN.md](ECOSISTEMA_HIVEBRAIN.md) (una sola app con módulos que se encienden). Todas tienen tests de su lógica y de su interfaz sobre un DOM simulado; **ninguna se ha visto todavía en un navegador real**, por eso van en 🟡.

| Fase | Estado | Qué hace | Dónde |
|---|---|---|---|
| **17. Medidor de energía** | 🟡 | La energía del día da una capacidad (3, 6 o 9 puntos); lo de hoy la gasta. Al pasarse: ámbar y «¿mover algo a mañana?». Se guarda por día y se sincroniza | `js/energia-core.js`, `js/app/features/energia.js` |
| **18. ¿Qué cabe ahora?** | 🟡 | «Ahora» propone primero lo que cabe en la energía que queda y avisa si la propuesta es grande | los mismos |
| **19. Incubadora** | 🟡 | Lo que lleva 14 días sin tocarse pasa a «Más tarde», con Deshacer; la revisión semanal gana un paso para decidir | `js/foco-core.js`, `js/app/features/energia.js` |
| **20. Pasos en Jarvis** | 🟡 | Herramientas `partir_en_pasos` y `marcar_paso` | `js/app/features/jarvis.js`, `jarvis.py` |
| **21. Registro de módulos** | 🟡 | `ModulosCore.registrar`, interruptores en Ajustes, fichas en Repasar y sincronización con el servidor (tabla `modulos`) | `js/modulos-core.js`, `js/app/features/modulos.js`, `server/store.py` |
| **22. Hábitos** | 🟡 | Racha flexible, días de la semana, sugerencia en Ahora | `js/app/modulos/habitos.js` |
| **23. Personas** | 🟡 | Cumpleaños y «hace N días que no hablas con…» | `js/app/modulos/personas.js` |
| **24. Finanzas rápidas** | 🟡 | «café 65» en dos toques, también desde Soltar; totales por semana, mes y categoría | `js/app/modulos/finanzas.js` |
| **25. Limpieza** | 🟡 | Fuera «Masticar»; una sola energía (adiós «Batería mental»); «Esta semana: N avances» en vez de 28 puntos; etiqueta duplicada arreglada | `js/app/views/ahora-hoy.js`, `js/app.js` |
| **26. Jarvis y los módulos** | 🟡 | `marcar_habito`, `apuntar_gasto`, `registrar_contacto`; línea de cada módulo en el resumen de la mañana | `js/app/features/jarvis.js`, `jarvis.py` |

Además hay un test nuevo (`tests/js/carga.test.mjs`) que carga todos los scripts de `index.html` en orden: caza un método repetido o un script sin registrar en el service worker, que antes solo se veían al abrir la app.

Lo que quedó fuera a propósito:
- **Medicación con aviso que pide confirmación** (Hábitos): necesita avisos programados por hábito.
- **Notas por persona** y edición de una persona o un hábito ya creados (hoy se quita y se vuelve a añadir).
- **Un solo nombre** en la interfaz (Hive Brain / Nexus / Pensadero): toca decenas de textos y conviene verlo en pantalla.
- **Menos botones sobre el orbe** y **Radar dentro de Proyectos**: cambios de diseño que no se pueden validar sin navegador.
- Las herramientas nuevas de Jarvis no se han probado contra la API real, solo sobre datos simulados.

### 7.4 Lo que falta, por orden recomendado

1. **Probar en un navegador y en un teléfono** lo marcado 🟡. Es lo único que separa buena parte de lo hecho de estar terminado. La lista está en [GUIA_PENDIENTES.md](GUIA_PENDIENTES.md).
2. **Compilar la app Android** en Android Studio e instalar los widgets.
3. **Activar HTTPS** en el servidor (`COMPOSE_PROFILES=https`): sin él, el móvil no permite push ni micrófono.
4. **Recuperar el CI**: el workflow de GitHub Actions está retirado por el límite de facturación de la cuenta. Sin CI no hay E2E, y sin E2E no conviene terminar la Fase 4.
5. **Fase 5** cuando tengas el *Client ID* de Google: OAuth sustituye a la contraseña de aplicación de Gmail y trae el calendario.
6. **Retirar `backend/`** (Spring) y el perfil `legacy` del compose cuando des la migración por cerrada.
7. **Lo que quedó fuera de las fases 17 a 26** (lista en 7.3): medicación, editar hábitos y personas, un solo nombre, menos botones sobre el orbe.
8. Más adelante: Whisper, Capacitor, recordatorios por lugar y terminar la Fase 4.

---

## 8. Decisiones que necesito de ti
1. **Backend**: ¿unificar en Python (recomendado) o mantener Java?
2. **Proveedor de IA** de Jarvis: Claude, Gemini, local (Ollama) o intercambiable.
3. **Framework de frontend**: Svelte (recomendado), Preact, o seguir vanilla con módulos.
4. ¿Estás de acuerdo con reducir a 3 secciones y 4 colores, o hay alguna pantalla actual que uses mucho y quieras conservar tal cual?
5. ¿Por dónde empezamos? Sugerencia: **Fase 0 + Fase 1** (impacto inmediato, poco riesgo).
