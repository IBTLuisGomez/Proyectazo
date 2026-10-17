# ⚡ Proyectazo — FocusFlow OS (Fullstack & Multiplataforma)

> **Sistema unificado de gestión multiproyecto diseñado para TDAH.**  
> *Backend en Spring Boot 3 + PostgreSQL/H2 · Frontend Offline-First · Multiplataforma (Web & Móvil) · Listo para Docker y DigitalOcean Droplet.*

---

## 🎯 Filosofía Central: Gestionar Momentum, no Tareas
El cerebro con TDAH o trabajo multiproyecto no se bloquea por falta de ideas, sino por el **costo cognitivo de reingreso**: al volver a un proyecto tras varios días, la sobrecarga visual de un tablero tradicional con decenas de tarjetas pendientes genera culpa, parálisis y abandono.

**FocusFlow OS** resuelve esto con tres pilares no negociables extraídos de las especificaciones:
1. **Eliminar la decisión de inicio**: Al abrir la app, la pantalla principal te responde en 5 segundos: *"¿Dónde me quedé y qué puedo hacer ya mismo?"*.
2. **Regla de la próxima acción única**: Cada proyecto tiene **una sola** micro-acción masticada (≤15 min), tipada en:
   - ⚡ `Hacer` (acción directa y ejecutable)
   - ⏳ `Esperar` (bloqueado por un tercero — *se muestra en gris y neutraliza la culpa*)
   - 💡 `Decidir` (elección previa antes de actuar)
   - 🔍 `Explorar` (indagación libre sin juicio)
3. **Protocolo de Cierre (Checkout)**: Formulario rápido de 2 preguntas obligatorias al cambiar o pausar un proyecto:
   - *¿Qué avanzaste hoy?* (activa la dopamina de cierre).
   - *¿Cuál es el próximo micro-paso concreto?* (la llave para tu yo del futuro).

---

## 🎨 Sistema de Temas Visuales (Adaptabilidad Sensorial)

La interfaz cuenta con 3 modos visuales diseñados para evitar la sobreestimulación o la fatiga visual:
1. ☀️ **Tema Claro**: Fondo nítido (`#f8fafc`), tarjetas blancas puras, bordes suaves de alto contraste y acentos esmeralda/índigo.
2. 🌙 **Tema Oscuro Suave (Slate Claro)**: Fondo descansado en Slate 800 (`#1e293b`), tarjetas en azul acero suave (`#273549`) y textos en slate claro (`#cbd5e1`/`#f8fafc`). *Ideal para evitar el contraste excesivo del negro puro.*
3. 🌌 **Tema Noche**: Modo ultra-oscuro (`#0d1322`) para ambientes de baja luminosidad.

---

## 🏗️ Arquitectura del Sistema

```
Proyectazo/
├── index.html                 # Aplicación Web & PWA unificada (Frontend)
├── manifest.json              # Configuración PWA para instalación en móviles
├── sw.js                      # Service Worker para funcionamiento 100% offline
├── capacitor.config.json      # Configuración para empaquetar app móvil nativa (Android/iOS)
├── docker-compose.yml         # Orquestación de Backend, Frontend Nginx y PostgreSQL
├── deploy.sh                  # Script de despliegue en 1 clic para DigitalOcean Droplet
├── .env.example               # Variables de entorno para producción
├── nginx/
│   ├── nginx.conf             # Proxy inverso (/api/ -> backend) y servidor estático
│   └── Dockerfile             # Contenedor optimizado de Nginx Alpine
└── backend/                   # API REST en Spring Boot 3.3.4
    ├── pom.xml                # Dependencias Maven (Web, Data JPA, PostgreSQL, H2)
    ├── Dockerfile             # Imagen multi-stage en Java 17
    └── src/main/java/com/proyectazo/
        ├── model/             # Project, Task, SessionLog, InboxItem
        ├── repository/        # Spring Data JPA con queries optimizadas
        ├── service/           # Lógica de negocio (WIP limits, Protocolo de Cierre, Sync)
        └── controller/        # Endpoints REST (/api/projects, /api/tasks, /api/logs, /api/sync)
```

---

## 🚀 Despliegue en DigitalOcean Droplet (Docker)

El proyecto está 100% preparado para desplegarse en cualquier servidor Linux (Ubuntu/Debian) en DigitalOcean:

### Paso 1: Clonar o subir la carpeta a tu Droplet
```bash
git clone <tu-repositorio> proyectazo
cd proyectazo
```

### Paso 2: Ejecutar el script automatizado
```bash
chmod +x deploy.sh
./deploy.sh
```
El script automáticamente:
1. Actualiza el sistema operativo.
2. Instala Docker y Docker Compose si no están instalados.
3. Genera un archivo `.env` con credenciales seguras.
4. Configura el Firewall UFW (puertos 22, 80 y 443).
5. Construye los contenedores (`postgres`, `backend`, `frontend`) y los deja ejecutándose en segundo plano con reinicio automático.

### Paso 3: Probar los servicios
- **Web App**: `http://IP_DE_TU_DROPLET/`
- **API REST**: `http://IP_DE_TU_DROPLET/api/projects`
- **Healthcheck**: `http://IP_DE_TU_DROPLET/health`

---

## 💻 Ejecución Local

### Opción A: Frontend solo (Offline-First en Navegador)
Abre directamente [`index.html`](./index.html) o sírvelo con Python:
```bash
python -m http.server 8080
```
*Guarda automáticamente en `localStorage` sin necesidad de base de datos.*

### Opción B: Backend Spring Boot localmente
```bash
cd backend
./mvnw spring-boot:run
```
*Se ejecuta en el puerto `8081` con base de datos H2 integrada y consola en `http://localhost:8081/h2-console`.*

---

## 📱 Versión Móvil (Android / iOS)

1. **Instalación Directa como PWA (Sin tiendas)**:
   - En Android (Chrome): Menú → *"Añadir a pantalla de inicio"*.
   - En iPhone / iPad (Safari): Botón Compartir → *"Añadir a pantalla de inicio"*.
   - Incluye barra de navegación inferior adaptada al pulgar, respuestas hápticas de vibración y modo offline completo.
2. **Compilación Nativa con Capacitor**:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   npx cap open android
   ```
   *Genera el proyecto de Android Studio listo para compilar tu `.apk` o `.aab`.*
