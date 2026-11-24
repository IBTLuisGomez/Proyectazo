# Guía de pendientes (lo que te toca a ti)

Estado: todo el trabajo está en la rama `dev` (sin subir a GitHub). `main` no se ha tocado.
Los pasos están en orden: los de **Antes de arrancar** son obligatorios; el resto, cuando puedas.

---

## 1. Antes de arrancar (obligatorio)

### 1.1 Cerrar el proceso de prueba
Quedó un backend de prueba escuchando en el puerto 8091 y bloquea `backend/target/*.jar`.

```powershell
Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -like '*proyectazo-api-1.0.0.jar*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId }
```

### 1.2 Completar `.env`
Copia lo que falte desde [`.env.example`](../.env.example). Sin `POSTGRES_PASSWORD`, `docker compose` no arranca.

| Variable | Qué poner |
|---|---|
| `POSTGRES_PASSWORD` | **Si ya tenías el volumen de Postgres**, la contraseña con que se creó: `nexus_secret_2026` (el valor que traía antes el compose). Si quieres otra, borra el volumen (`docker compose down -v`, **borra los datos del servidor**) |
| `NEXUS_ADMIN_USER` | Tu usuario de login (p. ej. `fernando`) |
| `NEXUS_ADMIN_PASSWORD` | Mínimo 8 caracteres. Si la dejas vacía, se genera una temporal y aparece en `docker logs nexus-backend` |
| `CORS_ALLOWED_ORIGINS` | Solo si abres la app desde **otra** dirección que el propio servidor (ver 2.3). Por defecto vale |
| `NEXUS_PUSH_SUBJECT` | `mailto:tu_correo@...` (lo exigen los servicios de push) |
| `NEXUS_VAPID_PUBLIC_KEY` / `NEXUS_VAPID_PRIVATE_KEY` | Opcional. Si las dejas vacías se generan solas y se guardan en la BD |

Para generar una contraseña segura:
```powershell
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
```

> Cada cuenta ve solo sus datos. Lo que ya existía antes de esta versión se asigna automáticamente al usuario inicial en el primer arranque.

> El usuario inicial **solo se crea si no existe ninguno**. Cambiar `NEXUS_ADMIN_PASSWORD` después no cambia la contraseña: hazlo desde Ajustes → Avanzado → Seguridad.

### 1.3 Arrancar y comprobar
```powershell
docker compose up -d --build
docker compose ps          # los 4 servicios en "healthy"
docker logs nexus-backend  # si no fijaste contraseña, aquí está la temporal
```
Abre `http://localhost:8080` (o el `PORT` de tu `.env`).

---

## 2. Probar en un navegador real (20 minutos)

Lo automático ya pasa (backend, Nexus, sintaxis, barrido de botones en navegador sin pantalla), pero conviene una vuelta tuya:

- [ ] Login con tu usuario. Contraseña incorrecta debe dar error.
- [ ] Aparece la **guía de bienvenida** la primera vez (se repite en Ajustes → Guía rápida).
- [ ] Soltar un pensamiento sin color → Nexus lo clasifica y ofrece **Deshacer**.
- [ ] En un pensamiento: **🚀 Mandar a Proyecto** abre la ventana y lo envía.
- [ ] Borrar una tarea → **Deshacer** la recupera.
- [ ] Editar un proyecto y poner **Palabras clave**; dictar/escribir una y comprobar que va a ese proyecto.
- [ ] Abrir el **Baúl**: la primera vez pide crear el PIN.
- [ ] Modo Zen: al acabar el sprint llega la notificación y "Cerrar sesión" abre el Checkout.
- [ ] Desde otro dispositivo (móvil): login y ver que los datos se sincronizan.

**Captura y clasificación**
- [ ] Soltar `- Comprar pan` y `- Llamar a Ana` en dos líneas: se separan en 2 tarjetas (con botón **Unir**).
- [ ] `urgente: pagar la luz mañana a las 9`: queda en 🔴 Urgente con aviso para mañana.
- [ ] `para <tu proyecto>: revisar contrato`: crea la tarea directamente en ese proyecto.
- [ ] Cambiar a mano el color de un pensamiento y soltar otro parecido: debe recordar tu elección.
- [ ] Con 3+ sin clasificar aparece **🧹 Repaso**: ordenarlos con las teclas 1–9.
- [ ] Ajustes → "Usar IA en la nube" está **apagado** por defecto (todo se clasifica en el dispositivo).

**Tarjetas, fechas y tema**
- [ ] Cada tarjeta muestra 3 acciones y **⋯**; el menú se cierra al tocar fuera.
- [ ] Crear una tarea con **Para cuándo** hoy: aparece en Hoy → **📅 Para hoy**; probar **Mañana**.
- [ ] Tema claro (Ajustes → Versión Clara): revisar que los textos se lean bien; dime cuáles no.
- [ ] Android con la app instalada: **Compartir → Nexus Orb** desde el navegador guarda el enlace.

**Listas y notas (Repasar → 📝 Listas)**
- [ ] Crear una lista, añadir tres pendientes (pega varias líneas: uno por línea), marcar uno: baja a «completados».
- [ ] Color, fijar, archivar y borrar; cada borrado ofrece **Deshacer**.
- [ ] En otro dispositivo: la lista aparece; marca un pendiente en cada uno y sincroniza: se conservan los dos.
- [ ] Tema claro: los colores de las tarjetas se leen bien.

**Sin red**
- [ ] Modo avión, borrar un pensamiento, volver a conectar: no debe reaparecer.

### 2.1 Datos que ya tenías
- Lo guardado en cada navegador se sube al servidor **la primera vez que inicias sesión** en ese dispositivo. Abre la app en cada uno al menos una vez.
- El antiguo PIN del Baúl se conserva (se convierte a hash). La antigua contraseña local se borra: ahora vale la del servidor.

### 2.2 Avisos con la app cerrada (Web Push) y voz
Requieren **HTTPS** (o `localhost`). En la red local por IP (`http://192.168.x.x`) el móvil **no** permitirá push ni micrófono.
Opciones: un dominio con certificado (Caddy o certbot delante de nginx) o un túnel tipo Cloudflare Tunnel / Tailscale Funnel.
Con HTTPS: Ajustes → Notificaciones → **Activar avisos con la app cerrada** en cada dispositivo → **Probar**.

### 2.3 Si pones un proxy HTTPS delante (Cloudflare, Caddy…)
Si el HTTPS termina **antes** de nginx, nginx ve `http` y el navegador `https`. Añade tu dirección pública a `.env`:
```
CORS_ALLOWED_ORIGINS=https://tu-dominio.com,null
```
(`null` es la app de escritorio Electron.) Síntoma si falta: al guardar, error 403 en la consola del navegador.

### 2.4 App de escritorio (atajo Ctrl+Shift+Espacio)
```powershell
cd desktop
npm install
npm start
```
Pulsa `Ctrl+Shift+Espacio` desde cualquier programa: debe abrir la captura rápida.

### 2.5 App Android
La app carga la URL del servidor (configurable dentro de la app). Apúntala a tu dirección HTTPS para tener push y voz.

**Widgets de listas (sin compilar ni probar en un teléfono todavía):** este equipo no tiene Android SDK, así que el código de `android/app/src/main/java/com/nexus/orb/notas/` está escrito pero no compilado. Abre `android/` en Android Studio, compila e instala, y prueba:
- [ ] La app compila (si falla algo, pásame el error tal cual).
- [ ] Pantalla de inicio → Widgets → Nexus Orb: aparecen **Lista de pendientes** y **Añadir pendiente**.
- [ ] Marcar una casilla en el widget y abrir la app: el pendiente sale marcado; mirar también en el ordenador.
- [ ] **＋** en el widget con el modo avión: se añade; al volver la red llega al servidor.
- [ ] Marcar algo en el ordenador: el widget lo refleja al abrir la app o en ~30 min.
- [ ] Tocar el título cambia de lista; **↗** abre la app en esa lista.

---

## 3. Revisar y subir el trabajo

```powershell
git log --oneline main..dev     # un commit por bloque de trabajo
git push -u origin dev
```
Después abre un Pull Request de `dev` a `main`: GitHub Actions ejecutará los tests, el build del CSS y el de las imágenes Docker.

---

## 4. Decisiones pendientes (dime y lo hago)

| Tema | Qué implica |
|---|---|
| **Voz en iOS/Firefox** | No tienen reconocimiento de voz en el navegador. Requiere transcribir en el servidor (Whisper), que pide ~1–2 GB de RAM más |
| **Google Calendar / Gmail con OAuth** | Sustituye la contraseña de aplicación de Gmail. Necesito que crees en [Google Cloud Console](https://console.cloud.google.com/) un proyecto, la pantalla de consentimiento OAuth y unas credenciales "Aplicación web" con tu dominio como URI de redirección, y me pases el *Client ID* |

---

## 5. Limpieza (hecha)

- Borrados `nexus_deploy_v1.tar.gz`, `__pycache__/`, `.pytest_cache/` y `android/build/`.
- `archive/` y las especificaciones antiguas están en `docs/archivo/`. La especificación vigente es [PRODUCTO.md](PRODUCTO.md).
- Quedan en disco (fuera de git) `data/` y `backend/data/` (bases H2 antiguas): bórralas si no las necesitas.
- Los modelos de IA se eligen con `NEXUS_AI_MODELS` en `.env` (ver `.env.example`).

## 5b. Activar Jarvis con IA (opcional)

1. Crea una clave en https://console.anthropic.com y ponla en `.env`: `ANTHROPIC_API_KEY=...`
2. `docker compose up -d --build app` (en la versión anterior a la Fase 3: `nexus-ai`)
3. Comprueba: `http://localhost:8080/nexus/health` debe mostrar `"jarvis": {"provider": "claude", ...}`.
4. Prueba: abre Jarvis y di "mañana a las 10 recuérdame llamar al banco".

Modelo por defecto `claude-opus-5-5` con esfuerzo `low` (respuestas rápidas). Para gastar menos: `JARVIS_MODEL=claude-sonnet-5-5` o `claude-haiku-5-5`. Sin clave, Jarvis funciona en modo local.

## 5c. Backend único (Fase 3, rama `feat/backend-unico`)

Sustituye Postgres + Spring + Nexus por un solo servicio Python con SQLite. Pasos para migrar tus datos sin perderlos en [MIGRACION.md](MIGRACION.md). El volumen de Postgres no se borra hasta que tú lo decidas.

## 5d. Frontend (Fase 4, rama `feat/frontend-modular`, encima de la Fase 3)

Hecho:
- `index.html` sin manejadores inline: atributos `data-on-*` y un único despachador (`js/app/ui/acciones.js`).
- Plantillas `` html`…` `` que escapan por defecto (`js/app/ui/html.js`), ya usadas en Repasar y Jarvis.
- `npm run lint` (ESLint) y `npm run typecheck` (tsc) en CI.

Pendiente, a propósito: módulos ES con un bundle único, componentes y un store central. Unir los scripts cambia el modo estricto y el ámbito de los globales, y eso solo se puede validar en un navegador. Se hará vista a vista, con pruebas E2E en CI (Playwright), cuando el CI vuelva a funcionar (ahora lo bloquea la facturación de GitHub).

**Prueba manual que necesito de ti:** pulsa los botones de cada pantalla y de los modales (login, Ajustes, Baúl, Checkout, crear tarea, compartir…). Ahora todos pasan por el despachador nuevo; si alguno no responde, dime cuál.

## 6. A tener en cuenta

- **Memoria del equipo**: durante el desarrollo había solo ~260 MB libres de 7,5 GB. Docker con Postgres, backend, Nexus y nginx necesita ~1–1,5 GB; cierra lo que no uses antes de `docker compose up`. Para los tests del backend en este equipo: `MAVEN_OPTS="-Xmx256m" ./mvnw test -DargLine="-Xmx320m"`.
- **Clasificador**: las reglas están en `js/clasificador-reglas.js` (las usan el navegador y Nexus). Para añadir palabras, edítalas ahí y ejecuta los tests (`node --test tests/js/*.test.mjs` y `pytest tests`).
- **Contraste**: `assets/contraste.css` se genera con `python scripts/gen-contraste.py`; no lo edites a mano.

### Seguridad

- La **contraseña de aplicación de Gmail** se guarda en texto plano en el disco del servicio Nexus (`data/google_mail_config.json` dentro del contenedor). Está protegida por el login, pero OAuth (punto 4) es lo correcto.
- La **clave privada VAPID** se guarda en la base de datos si no la fijas en `.env`. Haz copias de seguridad de la BD.
- Si alguna vez compartiste el `.env`, rota la `GEMINI_API_KEY` en Google AI Studio.
