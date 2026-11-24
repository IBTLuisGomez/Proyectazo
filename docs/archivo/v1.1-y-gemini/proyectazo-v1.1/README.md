# Proyectazo v1.1 — Core MVP

Sistema de gestión multiproyecto diseñado para TDAH.
Offline-first · localStorage · PWA instalable.

## Cómo usar

### Opción rápida (recomendada)
1. Abre `index.html` en cualquier navegador moderno (Chrome, Edge, Safari, Firefox).
2. O sirve la carpeta con cualquier servidor estático:

```bash
# Python
python -m http.server 5173

# Node (si tienes npx)
npx serve .
```

Luego ve a `http://localhost:5173`

### Instalar como app
En Chrome/Edge móvil o desktop: menú → "Instalar aplicación" / "Add to Home Screen".

## Qué incluye (V1 Core MVP)

- **Dashboard "¿Qué hago hoy?"** — tarjetas de proyectos activos + sugerencia del día
- **Próximo paso único** tipado (hacer / esperar / decidir / explorar)
- **Protocolo de Cierre** — registrar avance + próximo paso obligatorio
- **Tarjeta de reingreso** — al abrir un proyecto ves dónde quedaste
- **Kanban ligero** por proyecto con límite WIP (máx 3 en "En foco")
- **Bitácora / historial** de avances
- **Radar de proyectos** — todos los estados (activo, pausado, esperando, idea, completado)
- **Estacionar / pausar** sin culpa
- **Semáforo de frescura** (verde / amarillo / rojo / gris)
- **PWA** con service worker (funciona offline)

## Datos
Todo se guarda en `localStorage` del navegador. No hay backend todavía.
Para exportar: abre DevTools → Application → Local Storage → copia el JSON de `proyectazo_v1_1`.

## Próximos pasos (V1.2 / V2)
- Sync en la nube (Supabase)
- Filtros por energía/tiempo
- Captura rápida de ideas global
- Racha visual tipo GitHub
- Exportar PDF de bitácora

---
Basado en la Especificación Unificada Proyectazo / FocusFlow OS.
