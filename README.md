# 🔮 Nexus Orb — FocusFlow OS (Fullstack & Multiplataforma)

> **Sistema operativo cognitivo unificado para trabajo multiproyecto y mentes neurodivergentes (TDAH).**  
> *Esfera volumétrica 3D WebGL · Reconocimiento por voz Nexus IA · Backend único en Python + SQLite (API, IA y asistente Jarvis) · PWA móvil y de escritorio · Docker Compose.*

---

## 🌟 Novedades y Características Principales

### 1. Esfera de Cristal Nexus Orb 3D (WebGL Volumétrico)
- **Humo animado fluido real**: Simulación volumétrica en GLSL mediante *domain warping* con ruido Simplex 3D y FBM, produciendo corrientes de convección térmica, turbulencia y filamentos luminosos en tiempo real.
- **5 categorías que pone Nexus** (ver [docs/PRODUCTO.md](docs/PRODUCTO.md)): 🔴 Urgente · 🔵 Proyecto · 🟢 Vida (salud, personas, dinero, recados) · 🟡 Idea · ⚪ Luego. ✨ Sin clasificar mientras no se repasa.
- **Rendimiento ultra-optimizado a 60 FPS**: Clamping de resolución interna a 320x320 con escalado CSS suave y 15 pasos de raymarching, reduciendo la carga de GPU en más del 88% y eliminando sobrecalentamientos o congelamientos en móviles.
- **Recuperación automática de contexto**: Protección contra pérdida de contexto WebGL (`webglcontextlost`) para evitar que la esfera se torne blanca al salir de modales o alternar vistas.

### 2. Control Gestual e Interacción Sensorial
- **Walkie-Talkie Nexus IA (Mantener presionado para hablar)**: Al mantener presionado el orbe con el dedo o ratón durante más de 300 ms, se activa la captura de voz en tiempo real con un resplandor pulsante. Al soltar, el pensamiento se deposita instantáneamente en el Pensadero o se canaliza al proyecto indicado por voz (ej. *"Mandar a CytoHelix"*).
- **Deslizamiento táctil (Swipe)**: Desliza hacia la derecha o izquierda sobre el orbe en pantallas táctiles para ciclar entre las 5 categorías con micro-vibración háptica.
- **Pulso resonante (Clic / Tap rápido)**: Dispara una onda expansiva de partículas y dopamina auditiva.

### 3. Logotipo Dinámico según Modo de Color
- 🌙 **Modo Oscuro / Noche**: Despliega el isotipo `assets/logo_dark.png` con base oscura translúcida, filamentos neuronales y humo neón.
- ☀️ **Modo Claro**: Despliega `assets/logo_icon_sin_bk.png` optimizado para fondos luminosos.

### 4. Sesión Persistente y Video Cinemático
- **Video intro solo la primera vez**: El video de inicio cinematográfico (`NexusOrb_Neon.mp4`) se reproduce únicamente la primera vez que se accede desde el dispositivo (`localStorage`).
- **Pantalla de bienvenida y login con diseño**: Permite registrar el alias de usuario y recordar la sesión durante 30 días, evitando re-autenticarse o recargar videos en aperturas subsecuentes.

### 5. Gadget Aislado de Vaciado Rápido
- Vista ultra-minimalista centrada exclusivamente en la esfera de cristal flotante.
- Mantener presionado para hablar y soltar para guardar en 1 segundo sin distracciones ni listas.

### 6. Despacho Directo a Proyectos sin Bloqueos
- Botón **"🚀 Mandar a Proyecto"** en cada pensamiento o desde la consola Jarvis: canaliza la idea como tarea al Buzón o Próximo Paso del proyecto activo (`FocusFlow OS`, `CytoHelix`, `CytoCore`) mediante una notificación toast interactiva sin alertas bloqueantes.

### 7. Listas de pendientes y notas (tipo Google Keep)
- En **Repasar → 📝 Listas**: listas con casillas y notas de texto, con color, fijar, archivar y búsqueda.
- Sin red y sincronizadas entre dispositivos (mezcla pendiente a pendiente, sin pisar cambios).
- **Widgets en Android**: *Lista de pendientes* (marcar sin abrir la app) y *Añadir pendiente*. Ver [guía móvil](docs/GUIA_USUARIO_MOVIL.md).

### 8. Foco acompañado y rutinas
- Al pie de **Ahora**: check-ins durante el foco, aviso a los 90 minutos, cierre del día en un minuto y revisión semanal guiada.
- La app aprende cuánto tardas de verdad y lo muestra junto a la estimación.

### 9. Energía del día y módulos opcionales
- **Medidor de energía**: lo que tienes para hoy frente a tu energía (baja, media, alta); Ahora propone primero lo que cabe y lo que lleva 14 días sin tocarse pasa solo a «Más tarde».
- **Módulos** que se encienden en Ajustes: 🌱 Hábitos (racha flexible), 🫂 Personas (cumpleaños y cada cuánto hablar) y 💸 Finanzas rápidas («café 65»). Ver [docs/PRODUCTO.md](docs/PRODUCTO.md).

### 10. Operación
- Copia de seguridad diaria de la base de datos, secretos cifrados en reposo (`NEXUS_SECRET_KEY`) y registro de errores del navegador. Detalle en [docs/GUIA_PENDIENTES.md](docs/GUIA_PENDIENTES.md), punto 6.
- Estado del plan y lo que falta: [docs/PROPUESTA_MEJORA.md](docs/PROPUESTA_MEJORA.md), sección 7.

---

## 🏗️ Arquitectura Técnica

```
Proyectazo/
├── index.html                 # PWA y SPA Frontend unificada (HTML5, Tailwind, WebGL GLSL, Web Speech API)
├── manifest.json              # Manifiesto PWA para instalación móvil y de escritorio
├── sw.js                      # Service Worker para funcionamiento 100% offline
├── docker-compose.yml         # 2 contenedores: app (Python) y frontend (nginx); Caddy opcional para HTTPS (caddy/Caddyfile)
├── assets/
│   ├── logo_dark.png          # Logo de alta resolución para Modo Oscuro
│   ├── logo_icon_sin_bk.png   # Logo transparente para Modo Claro
│   └── NexusOrb_Neon.mp4      # Video intro cinemático
├── server/                    # Backend único en Python: API (/api) + IA y Jarvis (/api/nexus), SQLite
│   ├── app.py                 # Rutas HTTP, autenticación y CORS
│   ├── store.py               # Proyectos, tareas, pensadero y sincronización (límite WIP)
│   ├── auth.py / push.py      # Sesiones (BCrypt) y avisos Web Push
│   └── importar_postgres.py   # Migración desde la versión anterior (ver docs/MIGRACION.md)
├── nexus_service.py, jarvis.py # IA: clasificación, desglose y asistente Jarvis
├── js/notas-core.js           # Listas y notas: modelo y mezcla entre dispositivos (vista en js/app/views/notas.js)
├── js/modulos-core.js         # Registro de módulos opcionales; cada módulo en js/app/modulos/ (hábitos, personas, finanzas)
├── android/                   # App Android (WebView) y widgets de listas (app/src/main/java/com/nexus/orb/notas/)
└── backend/                   # Versión anterior en Spring Boot (se retirará tras migrar)
```

---

## 🚀 Despliegue y Ejecución Local

### Ejecución Completa con Docker Compose
```bash
docker compose up -d --build
```
- **App web y PWA**: [http://localhost:8080](http://localhost:8080) (o el `PORT` de tu `.env`); en la red local `http://192.168.x.x:8080`
- La API y la IA quedan detrás de nginx (`/api` y `/nexus`). Datos en el volumen `nexus_data` (SQLite).
- **HTTPS** (necesario para push y micrófono en el móvil): `COMPOSE_PROFILES=https` y `NEXUS_DOMAIN=...` en `.env` añaden Caddy con certificado automático. Pasos en [docs/GUIA_PENDIENTES.md](docs/GUIA_PENDIENTES.md), punto 2.2.
- ¿Vienes de la versión con Postgres? Sigue [docs/MIGRACION.md](docs/MIGRACION.md).

Sin Docker: `pip install -r server/requirements.txt` y `python -m server` (API + IA en el puerto 8081).

### Seguridad y primer acceso
- Copia `.env.example` a `.env`.
- El usuario inicial se crea con `NEXUS_ADMIN_USER` y `NEXUS_ADMIN_PASSWORD` (mínimo 8 caracteres). Si no defines la contraseña, se genera una temporal y aparece en `docker logs nexus-app`.
- Toda la API (`/api/**`) y la IA (`/api/nexus/**`, salvo `health`) requieren `Authorization: Bearer <token>`, obtenido en `POST /api/auth/login`. El servidor lo comprueba también sin nginx.
- El borrado total por `/api/sync` exige la cabecera `X-Confirm-Wipe: BORRAR-TODO`.
- El PIN del Baúl se elige la primera vez que se abre y se guarda solo como hash.

### Avisos con la app cerrada (Web Push)
- En **Ajustes → Notificaciones → Activar avisos con la app cerrada** cada dispositivo se suscribe (requiere HTTPS o `localhost`).
- Los recordatorios de **Programar recordatorio** se pueden enviar como notificación push, con o sin correo; el backend revisa cada 30 s los que vencen.
- Las claves VAPID se generan solas y se guardan en la base de datos, o se fijan con `NEXUS_VAPID_PUBLIC_KEY` / `NEXUS_VAPID_PRIVATE_KEY`.

### Estilos (Tailwind compilado)
Tailwind ya no se carga desde CDN: se compila a `assets/tailwind.css` con la configuración de `tailwind.config.js`.
```bash
npm install
npm run build:css     # o npm run watch:css mientras editas index.html
```
La imagen de nginx lo recompila sola en `docker compose build`.

### Tests
```bash
python -m pytest -q tests          # backend único (API, sync, push, migración), IA y Jarvis
node --test tests/js/*.test.mjs    # captura, categorías, Jarvis, listas, energía, módulos y carga de la app completa
```
GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) ejecuta ambos, compila el CSS, valida la sintaxis de todo `js/` y construye las imágenes Docker.

### Actualización en Caliente del Frontend
```powershell
npm run build:css
docker cp index.html nexus-frontend:/usr/share/nginx/html/index.html
docker cp assets/tailwind.css nexus-frontend:/usr/share/nginx/html/assets/tailwind.css
docker exec nexus-frontend nginx -s reload
```

---

## 📚 Documentación Adicional

- ✅ **[Guía de pendientes tras la actualización](docs/GUIA_PENDIENTES.md)**: configuración de `.env`, pruebas y decisiones

- 🖥️ **[Guía de Usuario para Aplicación Web](docs/GUIA_USUARIO_WEB.md)**
- 📱 **[Guía de Usuario para Aplicación Móvil](docs/GUIA_USUARIO_MOVIL.md)**
- 📖 **[Especificación vigente del producto](docs/PRODUCTO.md)**
- 🗺️ **[Propuesta de mejora y hoja de ruta](docs/PROPUESTA_MEJORA.md)**
- 🐝 **[Ecosistema Hive Brain: módulos, qué quitar y qué añadir](docs/ECOSISTEMA_HIVEBRAIN.md)**
