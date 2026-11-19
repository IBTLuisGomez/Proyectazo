# Nexus Orb — especificación vigente del producto

Este es el **único** documento que describe qué es la app y cómo debe comportarse. Las especificaciones anteriores (PDFs de Claude/GPT/DeepSeek, la descripción de los 9 colores, la v1.1) están en [archivo/](archivo/) solo como referencia histórica. La hoja de ruta está en [PROPUESTA_MEJORA.md](PROPUESTA_MEJORA.md).

## Para quién y para qué
Una persona con TDAH que lleva varios proyectos a la vez. La app debe **quitar decisiones**, no añadirlas: capturar sin pensar, decir qué hacer ahora y recordar por ella. A medio plazo funciona como un asistente personal (Jarvis) que conversa, recuerda y avisa por iniciativa propia.

## Principios
1. **Una pantalla, una decisión.** Nunca listas largas como primera vista.
2. **Sin culpa.** Nada de contadores rojos acumulados; posponer e hibernar son acciones normales.
3. **Todo se puede deshacer.**
4. **Local primero.** Funciona sin red; la IA en la nube es opcional y está apagada por defecto. El Baúl nunca sale del dispositivo.
5. **Capturar en 1 segundo** desde cualquier sitio: orbe (mantener para hablar), Ctrl+Shift+Espacio, compartir en Android.

## Las 3 secciones
| Sección | Pregunta que responde | Contenido |
|---|---|---|
| **Soltar** | "Tengo algo en la cabeza" | Orbe, captura por voz/texto, pensamientos recientes y repaso rápido |
| **Ahora** | "¿Qué hago ya?" | Una tarjeta con la siguiente acción, tiempo estimado, *Empezar*; "No sé por dónde empezar"; energía del día; "Para hoy" plegado |
| **Repasar** | "¿Cómo voy?" | Fichas: Proyectos · Ideas · Historial · Baúl · Ajustes |

## Las categorías (4 + Luego)
Las asigna el clasificador (local) o Jarvis; el usuario solo corrige.

| Categoría | Significado | Categorías antiguas que agrupa | Etiqueta automática |
|---|---|---|---|
| 🔴 **Urgente** | Tiene fecha o consecuencia | humo_rojo | — |
| 🔵 **Proyecto** | Trabajo de un proyecto o foco profundo | humo_azul | — |
| 🟢 **Vida** | Rutina, salud, personas, dinero | humo_verde, humo_purpura, humo_naranja | salud · personas · dinero |
| 🟡 **Idea** | Aún sin acción | humo_dorado | — |
| ⚪ **Luego** | Algún día, desahogo, hibernado | humo_blanco, humo_ceniza | desahogo · algún día |
| ✨ Sin clasificar | Pendiente de repaso | humo_general | — |

Los datos se siguen guardando con las claves antiguas (`humo_*`); la agrupación se hace al mostrar (`categoriaVisible()` en `js/smoke-palette.js`). Así no hay migración ni cambios en el backend.

## Funciones TDAH que se mantienen
Límite de tareas en curso, modo Zen con temporizador y ruido marrón, Checkout/cierre de sesión, reactivar o hibernar proyectos sin culpa, deconstruir metas en micro-pasos, avisos push, Baúl con PIN.

## Jarvis (asistente)
Se abre con el botón 🤖/🎙️ flotante, desde Ajustes o desde el aviso del resumen diario. Se habla o se escribe en lenguaje normal.

- **Qué puede hacer** (herramientas, se ejecutan en el navegador sobre tus datos): soltar un pensamiento, crear una tarea en un proyecto, programar un aviso, ver tareas, recordar un dato sobre ti, arrancar un foco, abrir una sección. No puede borrar nada.
- **Memoria**: los datos que le pides recordar y la conversación se guardan en este dispositivo (no en el servidor). 🧹 empieza una conversación nueva; la memoria se conserva.
- **Proveedor de IA**: `NEXUS_AI_PROVIDER` en `.env` (`claude` o `local`). Sin clave de IA funciona en modo local: lo que digas se guarda en Soltar con el intérprete de siempre (entiende "para <proyecto>: …" y fechas).
- **Resumen del día**: una vez al día, a partir de las 6:00, al abrir la app: lo que vence hoy, lo urgente, la primera tarea propuesta y un proyecto quieto. Se calcula en el dispositivo, sin IA.
- **Voz**: dictado con 🎙️; 🔈/🔊 activa la lectura de respuestas en voz alta.
