# 🔮 Nexus Orb — FocusFlow OS (Fullstack & Multiplataforma)

> **Sistema operativo cognitivo unificado para trabajo multiproyecto y mentes neurodivergentes (TDAH).**  
> *Esfera volumétrica 3D WebGL · Reconocimiento por voz Nexus IA · Backend en Spring Boot 3 + PostgreSQL/H2 · Microservicio Nexus AI en Python · PWA móvil y de escritorio · Docker Compose.*

---

## 🌟 Novedades y Características Principales

### 1. Esfera de Cristal Nexus Orb 3D (WebGL Volumétrico)
- **Humo animado fluido real**: Simulación volumétrica en GLSL mediante *domain warping* con ruido Simplex 3D y FBM, produciendo corrientes de convección térmica, turbulencia y filamentos luminosos en tiempo real.
- **Respuesta cromática pura de 9 colores nucleares**:
  - ✨ **General (Cian)**: Pensamiento libre sin clasificar.
  - ⚪ **Humo Blanco**: Descarga catártica para soltar pensamientos intrusivos y liberar memoria de trabajo.
  - 🔴 **Humo Rojo**: Urgencia crítica y fuegos de alta prioridad.
  - 🟡 **Humo Dorado**: Chispas de valor e ideas transformables en micro-pasos de 15 min.
  - 🔵 **Humo Azul**: Deep Work, foco mono-tarea y arquitectura.
  - 🟢 **Humo Verde**: Hábitos diarios, salud y energía física.
  - 🟣 **Humo Púrpura**: CRM personal, vínculos y personas clave.
  - 🟠 **Humo Naranja**: Fricción financiera y compras conscientes.
  - 🔘 **Humo Ceniza**: Hibernación *Someday / Maybe* para evitar saturación cognitiva.
- **Rendimiento ultra-optimizado a 60 FPS**: Clamping de resolución interna a 320x320 con escalado CSS suave y 15 pasos de raymarching, reduciendo la carga de GPU en más del 88% y eliminando sobrecalentamientos o congelamientos en móviles.
- **Recuperación automática de contexto**: Protección contra pérdida de contexto WebGL (`webglcontextlost`) para evitar que la esfera se torne blanca al salir de modales o alternar vistas.

### 2. Control Gestual e Interacción Sensorial
- **Walkie-Talkie Nexus IA (Mantener presionado para hablar)**: Al mantener presionado el orbe con el dedo o ratón durante más de 300 ms, se activa la captura de voz en tiempo real con un resplandor pulsante. Al soltar, el pensamiento se deposita instantáneamente en el Pensadero o se canaliza al proyecto indicado por voz (ej. *"Mandar a CytoHelix"*).
- **Deslizamiento táctil (Swipe)**: Desliza hacia la derecha o izquierda sobre el orbe en pantallas táctiles para ciclar fluidamente entre los 9 colores del reactor con micro-vibración háptica.
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

---

## 🏗️ Arquitectura Técnica

```
Proyectazo/
├── index.html                 # PWA y SPA Frontend unificada (HTML5, Tailwind, WebGL GLSL, Web Speech API)
├── manifest.json              # Manifiesto PWA para instalación móvil y de escritorio
├── sw.js                      # Service Worker para funcionamiento 100% offline
├── docker-compose.yml         # Orquestación de Frontend, Backend, Nexus AI y PostgreSQL
├── assets/
│   ├── logo_dark.png          # Logo de alta resolución para Modo Oscuro
│   ├── logo_icon_sin_bk.png   # Logo transparente para Modo Claro
│   └── NexusOrb_Neon.mp4      # Video intro cinemático
├── backend/                   # Backend REST en Spring Boot 3.3.4 (Java 17)
│   ├── src/main/java/com/proyectazo/
│   │   ├── controller/        # Projects, Tasks, Pensadero, Logs, Sync
│   │   ├── model/             # Entidades JPA (Project, Task, PensaderoItem, InboxItem)
│   │   └── service/           # Lógica de sincronización offline-first y límites WIP
└── nexus_ai_service/          # Microservicio de IA en Python (FastAPI / Gemini 1.5 Flash)
```

---

## 🚀 Despliegue y Ejecución Local

### Ejecución Completa con Docker Compose
```bash
docker-compose up -d --build
```
Puertos disponibles:
- **Frontend Web & PWA**: [http://localhost:8000](http://localhost:8000) o tu IP local `http://192.168.x.x:8000`
- **Backend Spring Boot**: [http://localhost:8081/api](http://localhost:8081/api)
- **Microservicio Nexus AI**: [http://localhost:8002/docs](http://localhost:8002/docs)
- **Base de Datos PostgreSQL**: Puerto 5432

### Seguridad y primer acceso
- Copia `.env.example` a `.env`. `POSTGRES_PASSWORD` es obligatoria.
- El usuario inicial se crea con `NEXUS_ADMIN_USER` y `NEXUS_ADMIN_PASSWORD` (mínimo 8 caracteres). Si no defines la contraseña, se genera una temporal y aparece en `docker logs nexus-backend`.
- Toda la API (`/api/**`) y el microservicio Nexus (`/nexus/**`, mediante `auth_request` de nginx) requieren `Authorization: Bearer <token>`, obtenido en `POST /api/auth/login`.
- El borrado total por `/api/sync` exige la cabecera `X-Confirm-Wipe: BORRAR-TODO`.
- El PIN del Baúl se elige la primera vez que se abre y se guarda solo como hash.

### Estilos (Tailwind compilado)
Tailwind ya no se carga desde CDN: se compila a `assets/tailwind.css` con la configuración de `tailwind.config.js`.
```bash
npm install
npm run build:css     # o npm run watch:css mientras editas index.html
```
La imagen de nginx lo recompila sola en `docker compose build`.

### Tests
```bash
cd backend && ./mvnw test          # seguridad, CORS, wipe y límite WIP
python -m pytest -q tests          # microservicio Nexus sin Gemini
```
GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) ejecuta ambos, compila el CSS, valida la sintaxis de `js/*.js` y construye las imágenes Docker.

### Actualización en Caliente del Frontend
```powershell
npm run build:css
docker cp index.html nexus-frontend:/usr/share/nginx/html/index.html
docker cp assets/tailwind.css nexus-frontend:/usr/share/nginx/html/assets/tailwind.css
docker exec nexus-frontend nginx -s reload
```

---

## 📚 Documentación Adicional

- 🖥️ **[Guía de Usuario para Aplicación Web](docs/GUIA_USUARIO_WEB.md)**
- 📱 **[Guía de Usuario para Aplicación Móvil](docs/GUIA_USUARIO_MOVIL.md)**
- 📖 **[Descripción Completa y Detallada del Sistema](docs/DESCRIPCION_DETALLADA.md)**
