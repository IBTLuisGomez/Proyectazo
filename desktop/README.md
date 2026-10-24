# FocusFlow OS — Aplicación de Escritorio (Desktop)

Este directorio contiene la arquitectura para ejecutar y compilar FocusFlow OS como aplicación nativa de escritorio para Windows, macOS y Linux.

---

## ⚡ Método 1: Lanzador Rápido de Windows (Sin instalación requerida)
En la carpeta raíz del proyecto encontrarás el archivo:
- **`iniciar_escritorio.bat`**

Solo haz **doble clic** sobre `iniciar_escritorio.bat`. 
Este script:
1. Verifica e inicia el microservicio local de IA (`nexus_service.py`) en el puerto 8002 en segundo plano.
2. Abre FocusFlow OS en una ventana de escritorio nativa independiente (usando el motor Chromium de Edge o Chrome en modo `--app`), sin barras de URL ni distracciones del navegador.

---

## 💻 Método 2: Instalación PWA Directa (1-Clic desde el navegador)
1. Abre la aplicación en tu navegador (Google Chrome, Microsoft Edge, Brave u Opera).
2. Haz clic en el botón con icono **💻** en la barra superior o en **Ajustes ⚙️ > Instalar en Escritorio**.
3. Acepta la instalación: la aplicación se integrará con el menú de inicio de Windows, creará un acceso directo en tu escritorio y funcionará con notificaciones del sistema.

---

## 📦 Método 3: Paquete Nativo con Electron
Si deseas compilar un instalador ejecutable (`.exe` para Windows):

1. Abre una terminal dentro de la carpeta `desktop/`:
   ```bash
   cd desktop
   npm install
   ```

2. Probar la aplicación en modo desarrollo:
   ```bash
   npm start
   ```

3. Generar instalador para Windows (`.exe` en `desktop/dist/`):
   ```bash
   npm run dist
   ```
