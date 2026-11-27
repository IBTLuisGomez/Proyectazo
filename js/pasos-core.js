'use strict';
/* exported PasosCore */
// Micro-pasos de una tarea (subtareas de un solo nivel): modelo puro, sin DOM.
// Se guardan dentro de la tarea como task.steps = [{ id, text, done, doneAt? }].
// El servidor guarda la tarea como documento JSON, así que no hace falta migración.

const PasosCore = (() => {
  const MAX_PASOS = 12;      // más de esto ya no es un micro-paso, es otro proyecto
  const MAX_TEXTO = 140;

  const nuevoId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Deja la lista en forma: sin vacíos, sin duplicados de id, textos recortados y con tope.
  function normalizar(steps) {
    if (!Array.isArray(steps)) return [];
    const vistos = new Set();
    const out = [];
    for (const s of steps) {
      if (!s) continue;
      const text = String(typeof s === 'string' ? s : s.text || '').trim().slice(0, MAX_TEXTO);
      if (!text) continue;
      let id = typeof s === 'object' && s.id ? String(s.id) : nuevoId();
      while (vistos.has(id)) id = nuevoId();
      vistos.add(id);
      const paso = { id, text, done: !!(typeof s === 'object' && s.done) };
      if (paso.done && s.doneAt) paso.doneAt = s.doneAt;
      out.push(paso);
      if (out.length >= MAX_PASOS) break;
    }
    return out;
  }

  function progreso(steps) {
    const lista = Array.isArray(steps) ? steps : [];
    const hechos = lista.filter(s => s && s.done).length;
    const total = lista.length;
    return { hechos, total, pct: total ? Math.round((hechos / total) * 100) : 0, completo: total > 0 && hechos === total };
  }

  // El primero sin hacer, en el orden en que se escribieron
  function siguiente(steps) {
    return (Array.isArray(steps) ? steps : []).find(s => s && !s.done) || null;
  }

  // Devuelve una lista nueva con el paso alternado (no muta la original)
  function alternar(steps, id, ahora = new Date().toISOString()) {
    return (Array.isArray(steps) ? steps : []).map(s => {
      if (!s || s.id !== id) return s;
      const done = !s.done;
      const paso = { ...s, done };
      if (done) paso.doneAt = ahora; else delete paso.doneAt;
      return paso;
    });
  }

  // Convierte la respuesta de /api/nexus/deconstruct (o una lista de textos) en pasos.
  // El "kickstart" va primero: es el arranque de menos de 5 minutos.
  function desdeSugerencia(data) {
    if (Array.isArray(data)) return normalizar(data);
    if (!data || typeof data !== 'object') return [];
    const textos = [];
    if (data.kickstart_action) textos.push(data.kickstart_action);
    for (const t of data.atomic_steps || []) textos.push(t);
    // La IA a veces numera ("1. …"): se quita para que no se duplique con el orden visual
    return normalizar(textos.map(t => String(t).replace(/^\s*\d+[.)-]\s*/, '')));
  }

  // Pasos genéricos cuando no hay IA ni red: arrancar, hacer lo mínimo, cerrar.
  function plantilla(titulo) {
    const t = String(titulo || 'la tarea').trim().slice(0, 60);
    return normalizar([
      `Abrir lo necesario para «${t}» (2 min)`,
      'Hacer la versión más pequeña posible, sin pulir',
      'Revisar 5 minutos y dejar anotado el siguiente paso'
    ]);
  }

  return { MAX_PASOS, normalizar, progreso, siguiente, alternar, desdeSugerencia, plantilla };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PasosCore;
