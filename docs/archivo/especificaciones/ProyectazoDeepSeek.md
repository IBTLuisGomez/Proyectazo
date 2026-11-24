# 🎯 Proyectazo — Lógica de la herramienta

## 1. El problema real (TDAH + multiproyecto)

| Fricción | Qué te pasa hoy | Qué debe hacer la app |
|---|---|---|
| Context switching | Cambiás de proyecto cada día y perdés el hilo | Mostrarte "dónde quedaste" en 5 segundos |
| Registro disperso | Los avances viven en tu cabeza, WhatsApp, notas | Un log cronológico por proyecto |
| Parálisis de inicio | Abrís la app, ves 80 tareas, cerrás | Mostrarte solo la siguiente acción de cada proyecto |

## 2. Modelo de datos

### PROYECTO
- id
- nombre
- color
- estado (activo | pausado | idea | terminado)
- prioridad (alta | media | baja)
- próxima_accion (UNA sola)
- última_actividad (fecha)
- columnas Kanban personalizables

### TAREA
- id
- proyecto_id
- título
- columna (Backlog | Hoy | En curso | Hecho)
- orden
- fecha_creación

### AVANCE (log)
- id
- proyecto_id
- fecha
- texto
- próxima_accion (opcional)

## 3. Las 4 pantallas que importan

### 🏠 Dashboard "¿Qué hago hoy?"
- Grid de proyectos activos (tarjetas con color)
- Cada tarjeta: nombre + días sin tocarlo + próxima acción + botones ▶ Avancé / ⏭ Saltar
- Arriba: "Sugerencia del día"

### 📋 Kanban por proyecto
- Columnas: Backlog · Hoy · En curso · Hecho
- Drag & drop
- Columnas personalizables

### 📝 Modo Avance
- ¿Qué hiciste?
- ¿Próximo paso?
- Estado del proyecto
- Al guardar: crea log, actualiza próxima acción y última actividad

### 📜 Bitácora del proyecto
Timeline reverso con todos los avances.

## 4. Funciones anti-TDAH

1. Regla de la próxima acción única
2. Frescura visual (verde / amarillo / rojo)
3. Modo "Saltar sin culpa"
4. Quick capture
5. Revisión semanal automática
6. Sin notificaciones agresivas

## 5. Stack recomendado

- Opción A: Next.js + Tailwind + localStorage + dnd-kit (PWA)
- Opción B: Next.js + Supabase + Vercel
- Opción C: Notion u Obsidian + Kanban

## 6. Orden de construcción

1. Modelo de datos en localStorage
2. Dashboard con tarjetas
3. Modal "Avancé" + log
4. Kanban con drag & drop
5. Bitácora / timeline
6. PWA manifest
7. Sync, auth, notificaciones

## 7. La lógica en una frase

No gestionás tareas. Gestionás momentum.
La app existe para que en 10 segundos sepas en qué proyecto avanzar hoy
y qué hiciste la última vez, sin abrir 8 pestañas ni sentir culpa.