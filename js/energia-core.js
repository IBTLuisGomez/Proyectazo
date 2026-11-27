/* exported EnergiaCore */
// Medidor de energía del día y «¿qué cabe ahora?» (Fases 17 y 18): la lógica, sin DOM.
// La interfaz está en js/app/features/energia.js; los tests, en tests/js/energia.test.mjs.
// Regla (docs/ECOSISTEMA_HIVEBRAIN.md): la energía del día da una capacidad en puntos y cada tarea
// de hoy gasta según su tamaño. Pasarse no es un error: es una invitación a mover algo a mañana.
const EnergiaCore = (() => {
  const CAPACIDAD = { baja: 3, media: 6, alta: 9 };
  const PESO = { XS: 0.5, S: 1, M: 2, L: 3 };
  const PESO_PASO = 0.25;          // cada micro-paso pendiente
  const NIVELES = ['baja', 'media', 'alta'];

  const nivelValido = nivel => (NIVELES.includes(nivel) ? nivel : 'media');
  const capacidad = nivel => CAPACIDAD[nivelValido(nivel)];

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Puntos que gasta una tarea: su tamaño (S si no lo tiene) más sus micro-pasos sin hacer
  function pesoTarea(tarea) {
    if (!tarea) return 0;
    const base = PESO[tarea.effort] ?? PESO.S;
    const pendientes = (Array.isArray(tarea.steps) ? tarea.steps : []).filter(s => s && !s.done).length;
    return base + pendientes * PESO_PASO;
  }

  // Lo que cuenta como «hoy»: lo que está En foco y lo que tiene fecha hasta el final del día.
  // No entran los proyectos del Baúl ni los hibernados, ni lo ya terminado.
  function tareasDeHoy(projects, finHoyMs) {
    const vistas = new Set();
    const out = [];
    for (const p of projects || []) {
      if (!p || p.inBaul || p.status === 'hibernado') continue;
      for (const t of p.tasks || []) {
        if (!t || !t.id || vistas.has(t.id) || t.column === 'victorias' || t.column === 'congelador') continue;
        const conFecha = t.dueAt && tiempo(t.dueAt) && tiempo(t.dueAt) <= finHoyMs;
        if (t.column !== 'enfoco' && !conFecha) continue;
        vistas.add(t.id);
        out.push({ projectId: p.id, project: p.name, task: t, peso: pesoTarea(t) });
      }
    }
    return out;
  }

  const redondear = n => Math.round(n * 100) / 100;

  // tareas: la salida de tareasDeHoy (o cualquier lista con .peso)
  function medidor(tareas, nivel) {
    const cap = capacidad(nivel);
    const carga = redondear((tareas || []).reduce((sum, x) => sum + (x.peso || 0), 0));
    return {
      nivel: nivelValido(nivel),
      capacidad: cap,
      carga,
      restante: redondear(Math.max(0, cap - carga)),
      pct: Math.min(100, Math.round((carga / cap) * 100)),
      pasado: carga > cap
    };
  }

  const cabe = (tarea, restante) => pesoTarea(tarea) <= restante;

  // «¿Qué cabe ahora?»: primero las tareas que caben en la energía que queda, sin cambiar
  // el orden que ya traían (columna, energía). Una tarea que ya cuenta en la carga de hoy siempre cabe.
  function ordenarPorCabida(tareas, restante, idsDeHoy) {
    const hoy = idsDeHoy instanceof Set ? idsDeHoy : new Set(idsDeHoy || []);
    const si = [];
    const no = [];
    for (const t of tareas || []) ((hoy.has(t.id) || cabe(t, restante)) ? si : no).push(t);
    return [...si, ...no];
  }

  // ---------------- Energía guardada por día (se sincroniza: colección «energy») ----------------
  function docEnergia(claveDia, nivel, ahoraIso) {
    return { id: claveDia, level: nivelValido(nivel), updatedAt: ahoraIso || new Date().toISOString() };
  }

  // null si ese día no se ha dicho nada
  function nivelDe(docs, claveDia) {
    const doc = (docs || []).find(d => d && d.id === claveDia && !d.deleted);
    return doc && NIVELES.includes(doc.level) ? doc.level : null;
  }

  return { CAPACIDAD, PESO, PESO_PASO, NIVELES, capacidad, pesoTarea, tareasDeHoy, medidor, cabe, ordenarPorCabida, docEnergia, nivelDe };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnergiaCore;
}
