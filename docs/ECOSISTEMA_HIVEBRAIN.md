# Hive Brain — cómo crecer sin perder el foco TDAH

Fecha: 2026-11-25 · Complementa [PRODUCTO.md](PRODUCTO.md) (qué es hoy) y [PROPUESTA_MEJORA.md](PROPUESTA_MEJORA.md) (plan técnico).

## 1. Decisión recomendada: una sola app modular

La idea es un programa completo para TDAH (Pensadero, tiempos, proyectos, hábitos, finanzas, personas) del que NexusHiveBrain/Proyectazo es una parte. **La mejor opción es no hacer apps separadas**: una sola app (este repositorio) con módulos que se encienden y apagan.

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **A. Una app, módulos dentro** | Una captura (orbe), un Jarvis, una sincronización, un login. Lo ya hecho (offline, push, Android, tests) sirve para todo | Hay que poner reglas para que no crezca el ruido | ✅ **Recomendada** |
| B. Apps separadas (Proyectos, Hábitos, Finanzas…) | Cada una más simple | Cambiar de app = cambiar de contexto (lo peor para TDAH). Triple mantenimiento para una persona | ❌ |
| C. Reescribir desde cero (Next.js/Flutter) | Código "limpio" | Meses sin producto usable; se pierde lo que ya funciona | ❌ por ahora |

**Arquitectura:** se mantiene la actual (PWA en JS + Python/SQLite + Android con Capacitor). El servidor guarda cada cosa como documento JSON, así que un módulo nuevo es una tabla nueva sin migraciones complicadas.

### La regla de oro de los módulos
Un módulo **nunca añade una pestaña principal**. La navegación sigue siendo de 3 verbos:

| Verbo | Qué aporta cada módulo |
|---|---|
| **Soltar** | Una categoría de captura (ej. «gasté 200 en café» → Finanzas) que el clasificador reconoce |
| **Ahora** | Candidatos para la única tarjeta de «qué hago ya» (una tarea, un hábito pendiente, una persona a la que escribir) |
| **Repasar** | Una ficha en la barra de Repasar |

Además, cada módulo registra sus herramientas de Jarvis. Esquema propuesto:

```js
// js/modulos/habitos/index.js
registrarModulo({
  id: 'habitos', nombre: 'Hábitos', icono: '🌱', activoPorDefecto: false,
  categoriasCaptura: ['habito'],                 // Soltar
  candidatosAhora: (estado, energia) => [...],   // Ahora (máx. 1 visible)
  fichaRepasar: { icono: '🌱', render: renderHabitos },
  herramientasJarvis: [marcarHabito, verRacha],
});
```

### Un solo nombre
Hoy la interfaz usa cuatro: *NexusHiveBrain* (47 veces), *FocusFlow OS* (12), *Nexus Orb* (9) y *Proyectazo* (3). Propuesta: **Hive Brain** = la app · **Nexus** = el asistente · **Pensadero** = el orbe. Proyectazo queda como nombre del repositorio.

## 1b. Especificación completa vs. código real (revisión 2026-11-25)

Leyenda: ✅ funciona · 🟡 parcial o maqueta · ❌ falta · ⛔ no recomendado

| Área | Función de la especificación | Estado | Detalle en el código |
|---|---|---|---|
| Concepto | Captura en 1–2 toques o voz | ✅ | Orbe (mantener para hablar), Ctrl+Shift+Espacio, compartir y widgets Android |
| | Guardado automático | 🟡 | Pensamientos, listas y pasos sí; «Editar tarea/proyecto» aún usan botón Guardar |
| | Bajo estímulo, oscuro | ✅ | Oscuro por defecto; claro opcional (arreglado) |
| Pensadero | Voz «Nexus, registra…» | ✅ | Web Speech + intérprete local; Jarvis con IA opcional |
| | Palabra de activación siempre escuchando | ⛔ | Gasta batería y micrófono abierto; mejor mantener-para-hablar y widget |
| | Clasificación por humo | ✅ | 4 categorías + Luego (agrupa los colores antiguos) |
| | Orbe GLSL 3D | ✅ | Simplex 3D, 320 px internos, recuperación de contexto WebGL |
| | Densidad del humo = carga mental | ❌ | La densidad depende de la categoría, no de cuántos pensamientos sin procesar hay |
| | Modo ahorro de batería | 🟡 | Respeta «movimiento reducido»; falta interruptor y pausa con batería baja |
| Tiempos | Gap filling | 🟡 | Propone mañana 10:00 fijo y abre una plantilla de Google Calendar; no lee huecos reales |
| | Buffers de 15 min | 🟡 | Se suman al evento creado; no se insertan entre bloques |
| | Priorización dinámica (lo rojo desplaza) | ❌ | — |
| | Estimación realista | ✅ | +30 % anti-optimismo y «sueles tardar ~N» aprendido |
| | Veto del usuario | ✅ | Todo se confirma |
| Proyectos | Desglose atómico | ✅ | Proyecto → pasos; tarea → micro-pasos dentro de la tarjeta |
| | Pensamiento → proyecto | ✅ | «Mandar a proyecto» guarda el pensamiento de origen |
| | Pensamiento → paso concreto | ❌ | Fácil ahora que existen `task.steps` |
| Hábitos | Medicación, hidratación, lectura con avisos persistentes | 🟡 | Solo categoría y «racha» por pensamiento con `alert()`; no hay módulo |
| | Heatmap y rachas por hábito, mensual y anual | 🟡 | Hay heatmap de 28 días de avances de proyectos, no por hábito |
| CRM | Fichas, cadencia, nudges, contexto pre-llamada | 🟡 | Maqueta: un `alert()`. Mostraba una persona inventada si faltaban datos (corregido) |
| Finanzas | Gasto en 1–2 toques, dinero libre | 🟡 | Maqueta: `prompt()` en USD y «dinero libre» fijo en código (450); no guarda historial |
| Técnica | PWA offline | ✅ | Service worker + IndexedDB + cola de borrados |
| | Flutter / Flet | ⛔ | Reescribir todo; la PWA + Capacitor ya cubre móvil y escritorio |
| | PostgreSQL / Supabase | ⛔ | Se migró a SQLite a propósito (un usuario, menos servicios) |
| | Tablas `brain_dump`, `projects`, `tasks` | ✅ | Como `pensadero`, `projects`, `tasks` |
| | Tablas `habits`, `personal_crm` | ❌ | Ver sección 4 |
| | Google Calendar | 🟡 | Enlaces de plantilla y .ics; sin API (OAuth) |
| | Google Tasks / Drive | ❌ | Requiere OAuth de Google |
| | Google Keep | ⛔ | Su API solo existe para cuentas Workspace empresariales; las Listas propias ya lo sustituyen |
| | Gemini | 🟡 | La IA es intercambiable (`NEXUS_AI_PROVIDER`: claude o local); se puede añadir Gemini como proveedor |
| | Spotify (alarmas) | ⛔ | Aparcar |

Nota: «Antigravity» es el IDE con agentes de Google con el que se generó código, no una biblioteca del backend; conviene quitarlo de la sección de arquitectura de la especificación.

**Resumen:** el núcleo (Soltar, Ahora, Proyectos, Pensadero) está construido. Hábitos, Personas y Finanzas existen solo como maquetas con `alert()`/`prompt()`, y el gestor de tiempos no lee el calendario. Ahí está el trabajo pendiente.

## 2. Qué quitar o simplificar

| Qué | Por qué | Estado |
|---|---|---|
| Barra roja parpadeante «🚨 FUEGO ACTIVO» | Rojo + parpadeo = ansiedad; contradice «Sin culpa» | ✅ Hecho: aviso ámbar tranquilo |
| 10 botones por tarjeta de tarea | Parálisis por elección | ✅ Hecho: 🪄 + ⋯ (lo demás plegado) |
| 11 botones en la cabecera del Kanban | Igual | ✅ Hecho: 5 visibles + «⋯ Más» |
| Desglose IA que crea 4–6 tarjetas nuevas | Llena el tablero; la tarea grande se pierde | ✅ Hecho: los pasos van dentro de la tarea |
| 🍴 «Masticar» (`prompt()` que crea 3 tareas genéricas) | Duplica el desglose y usa un diálogo bloqueante | ✅ Hecho (Fase 25) |
| «Batería mental» (Proyectos) y «Energía» (Ahora) | Dos controles para lo mismo | ✅ Hecho: una sola energía (Fase 25) |
| Racha con 28 puntos vacíos | Muestra lo que falta, no lo hecho | ✅ Hecho: «Esta semana: N avances» (Fase 25) |
| Radar, Proyectos e Historial por separado | Tres fichas casi iguales | Radar dentro de Proyectos |
| 5 botones encima del orbe (Nexus IA, Gadget, Pulso, Ruido, Limpiar) | Compiten con el orbe | Dejar Nexus IA; resto en ⋯; Ruido en Ahora |
| Etiqueta «Sin clasificar: Sin clasificar» | Texto duplicado | ✅ Hecho (Fase 25) |
| `backend/` Spring Boot + jar de 50 MB | Ya migrado a Python | Retirar (estaba en el plan) |
| Alarmas con Spotify | Mucho trabajo, poco efecto | Aparcar |

## 3. Qué añadir (por prioridad)

**P1 — completa lo que ya existe (1–2 semanas)**
1. **Medidor de energía del día** en «Para hoy»: capacidad según energía (baja 3 · media 6 · alta 9 puntos; XS=0.5, S=1, M=2, L=3, cada micro-paso pendiente 0.25). Al pasarse: ámbar y «¿mover algo a mañana?», nunca rojo. Se guarda una vez al día y se sincroniza.
2. **«¿Qué cabe ahora?»**: con la energía restante, Ahora elige la tarea (ya existe `ahoraCandidates`; falta usar la capacidad).
3. **Incubadora automática**: lo que no se toca en 14 días pasa a «Más tarde» para revisarlo en la revisión semanal (hoy solo se ve gris a los 7 días).
4. **Pasos en Jarvis**: herramienta «parte esta tarea en pasos» y «marca el paso».

**P2 — módulos nuevos, uno por sprint**
5. **Hábitos**: racha flexible (no se rompe por un día), mapa de calor mensual (ya existe `getMonthlyHeatmapHistory`), medicación como aviso que pide confirmación.
6. **Personas (CRM)**: hoy son pensamientos con `humo_purpura`; pasar a fichas con cumpleaños, último contacto y «hace 30 días que no hablas con…» como candidato de Ahora.
7. **Finanzas rápidas**: gasto en 2 toques desde Soltar («café 65») y la pregunta suave «¿dopamina rápida o necesidad?» solo en gastos altos.

**P3 — integraciones**
8. Gap filling real con Google Calendar (ya hay modal; falta leer huecos).
9. Recordatorios por lugar en Android (geofence).

**Estado (2026-11-27):** los puntos 1 a 7 están hechos (Fases 17 a 26 de [PROPUESTA_MEJORA.md](PROPUESTA_MEJORA.md), sección 7), probados con tests y pendientes de verse en un navegador. De Hábitos queda la medicación con aviso que pide confirmación. Los puntos 8 y 9 siguen bloqueados (OAuth de Google y app nativa).

## 4. Modelo de datos de los módulos nuevos

| Tabla (doc JSON) | Campos clave |
|---|---|
| `habits` | id, name, emoji, color, schedule (días), streakRule, history[{date, done}] |
| `people` | id, name, birthday, lastContactAt, contactEveryDays, notes[] |
| `expenses` | id, amount, category, note, impulse (bool), createdAt |
| `daily_energy` | date, level (baja/media/alta/no-sé) — uno por día y usuario |

Tareas ya tienen `steps[]` (micro-pasos) desde esta versión; no requiere migración.

## 5. Hoja de ruta en ciclos cortos

| Semana | Entregable visible |
|---|---|
| 1 | Medidor de energía + «¿Qué cabe ahora?» |
| 2 | Limpieza: quitar Masticar, unificar energía, un solo nombre, Soltar con menos botones |
| 3 | Registro de módulos (`registrarModulo`) + Hábitos |
| 4 | Personas |
| 5 | Finanzas rápidas |
| 6 | Incubadora automática + revisión semanal que la use |

Ajuste tras la revisión: antes de la semana 3, **convertir las maquetas en módulos reales o esconderlas**. Un botón que abre un `alert()` promete algo que no existe, y eso genera más frustración que no tenerlo. Victoria rápida visible: densidad del orbe según los pensamientos sin procesar (el orbe se «aclara» al repasar).

## 6. Cambios de esta versión (2026-11-25)

- **Editar proyectos**: nombre, emoji, **descripción** nueva, **color libre** (12 de paleta + selector), vista previa en vivo. Botón «✏️ Editar» visible en Kanban y tarjetas.
- **Tema claro**: el orbe y las tarjetas ya no se quedan oscuros (`assets/tema-claro.css` + orbe en cristal pastel). Lo que debe seguir oscuro lleva `.keep-dark`.
- **Micro-pasos en tareas**: editor en «Editar tarea» (añadir, marcar, subir, quitar, ✨ Sugerir con Nexus o plantilla), progreso y siguiente paso en las tarjetas, y «Solo esto ahora» en Ahora.
- **Menos ruido**: aviso de urgentes tranquilo, herramientas de tarjeta y Kanban plegadas.
- Los cambios de «Editar tarea» se envían al servidor al guardar (antes esperaban a la sincronización completa).
- Trabajo Profundo usaba su propia lista (`task.substeps`); ahora comparte los micro-pasos de la tarea (`task.steps`). Lo antiguo se migra solo al abrir la app.
- El CRM ya no muestra una persona inventada cuando el pensamiento no tiene datos de contacto.
