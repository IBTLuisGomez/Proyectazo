/* exported FocoCore */
// Foco acompañado, estimaciones aprendidas y resumen de la semana: la lógica, sin DOM (Fases 11-14).
// La interfaz está en js/app/features/acompanamiento.js; los tests, en tests/js/foco.test.mjs.
const FocoCore = (() => {
  const MIN = 60000;
  const HIPERFOCO_MIN = 90;      // minutos seguidos tras los que se sugiere parar un momento
  const DESCANSO_MIN = 5;        // una pausa así de larga cuenta como descanso y reinicia la cuenta
  const HUECO_MAX_MS = 90000;    // entre dos ticks: más que esto es una pausa, no tiempo de foco
  const MUESTRAS_MIN = 3;        // tareas terminadas de un tamaño antes de corregir su estimación
  const DIAS_QUIETO = 14;

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // ---------------- Foco acompañado ----------------
  function nuevoEstado() {
    return { seguidoMs: 0, desdeCheckinMs: 0, ultimoTick: 0, avisadoHiperfoco: false };
  }

  // Llamar en cada tick del temporizador en marcha. Devuelve el estado nuevo, el tiempo de foco que
  // suma este tick (delta) y, si toca, un aviso: 'checkin' (¿sigues con ello?) o 'hiperfoco'.
  // Una pestaña en segundo plano hace ticks cada minuto como mucho: por eso se admite un hueco de 90 s.
  function tick(estado, ahoraMs, config = {}) {
    const e = { ...nuevoEstado(), ...estado };
    const hueco = e.ultimoTick ? ahoraMs - e.ultimoTick : 0;
    let delta = 0;
    if (hueco > DESCANSO_MIN * MIN) {
      e.seguidoMs = 0;
      e.desdeCheckinMs = 0;
      e.avisadoHiperfoco = false;
    } else if (hueco > 0 && hueco <= HUECO_MAX_MS) {
      delta = hueco;
    }
    e.ultimoTick = ahoraMs;
    e.seguidoMs += delta;
    e.desdeCheckinMs += delta;

    let aviso = null;
    const cada = Number(config.checkInMin) > 0 ? Number(config.checkInMin) * MIN : 0;
    if (!e.avisadoHiperfoco && e.seguidoMs >= HIPERFOCO_MIN * MIN) {
      e.avisadoHiperfoco = true;
      e.desdeCheckinMs = 0; // no encadenar dos avisos seguidos
      aviso = 'hiperfoco';
    } else if (cada && e.desdeCheckinMs >= cada) {
      e.desdeCheckinMs = 0;
      aviso = 'checkin';
    }
    return { estado: e, delta, aviso };
  }

  // ---------------- Estimaciones (ceguera temporal) ----------------
  // muestras: [{ effort, estimado, real }] en minutos. Devuelve cuántas veces más (o menos) se tarda
  // de verdad en las tareas de ese tamaño, o null si aún hay pocas para saberlo.
  function factor(muestras, effort) {
    const ratios = (muestras || [])
      .filter(m => m && m.effort === effort && m.estimado > 0 && m.real > 0)
      .slice(-20) // las más recientes: los hábitos cambian
      .map(m => m.real / m.estimado)
      .sort((a, b) => a - b);
    if (ratios.length < MUESTRAS_MIN) return null;
    const mitad = Math.floor(ratios.length / 2);
    // Mediana: una tarde que se fue de las manos no cambia la estimación
    const mediana = ratios.length % 2 ? ratios[mitad] : (ratios[mitad - 1] + ratios[mitad]) / 2;
    return Math.round(Math.min(3, Math.max(0.5, mediana)) * 10) / 10;
  }

  // Minutos corregidos, redondeados a múltiplos de 5. null si no cambia nada que merezca decirse.
  function ajustada(minutos, f) {
    if (!minutos || !f) return null;
    const real = Math.max(5, Math.round((minutos * f) / 5) * 5);
    return real === minutos ? null : real;
  }

  // ---------------- Días y semanas (hora local) ----------------
  function claveDia(ms) {
    const d = new Date(ms);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // Lunes a las 00:00 de la semana de `ms`
  function inicioSemana(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }

  const claveSemana = ms => claveDia(inicioSemana(ms));

  // Lo que dejó dicho en el último cierre anterior a hoy, si es de los últimos 3 días
  function primeroDeHoy(cierres, ahoraMs) {
    const hoy = claveDia(ahoraMs);
    const previo = (cierres || []).filter(c => c && c.date < hoy && String(c.manana || '').trim()).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!previo || ahoraMs - tiempo(`${previo.date}T12:00:00`) > 3.5 * 24 * 60 * MIN) return '';
    return String(previo.manana).trim();
  }

  // ---------------- Revisión semanal ----------------
  // Todo en positivo: lo hecho, no lo que falta. Los pendientes solo aparecen como algo sobre lo que decidir.
  function resumenSemana(state, ahoraMs) {
    const desde = inicioSemana(ahoraMs);
    const enSemana = v => tiempo(v) >= desde;
    const proyectos = (state.projects || []).filter(p => p && !p.inBaul);

    const victorias = [];
    proyectos.forEach(p => (p.tasks || []).forEach(t => {
      if (t && t.column === 'victorias' && enSemana(t.updatedAt)) victorias.push({ title: t.title, project: p.name });
    }));

    let tachados = 0;
    (state.notas || []).forEach(n => {
      if (!n || n.deleted) return;
      (n.items || []).forEach(i => { if (i && !i.deleted && i.done && enSemana(i.updatedAt)) tachados++; });
    });

    const quietos = proyectos
      .filter(p => (p.status === 'activo' || p.status === 'en_ejecucion') && p.nextActionType !== 'esperar')
      .map(p => ({ id: p.id, name: p.name, emoji: p.emoji, dias: Math.floor((ahoraMs - tiempo(p.lastActivity)) / (24 * 60 * MIN)) }))
      .filter(p => p.dias >= DIAS_QUIETO)
      .sort((a, b) => b.dias - a.dias);

    return {
      semana: claveDia(desde),
      minutosFoco: (state.focusSessions || []).filter(s => s && enSemana(s.at)).reduce((sum, s) => sum + (s.minutes || 0), 0),
      victorias,
      tachados,
      distracciones: (state.focusDistractions || []).filter(d => d && enSemana(d.at)).length,
      cierres: (state.cierres || []).filter(c => c && c.date >= claveDia(desde)).length,
      sinClasificar: (state.pensadero || []).filter(x => x && !x.inBaul && !x.isResolved && (!x.category || x.category === 'humo_general')).length,
      quietos
    };
  }

  // ---------------- Incubadora automática (Fase 19) ----------------
  // Tareas del Buzón o de Próximo que nadie toca desde hace DIAS_INCUBAR días: pasan a «Más tarde»
  // (columna congelador) para decidir sobre ellas en la revisión semanal. No se tocan las que están
  // En foco, las que tienen fecha ni las de proyectos del Baúl.
  const DIAS_INCUBAR = 14;

  function incubables(projects, ahoraMs, dias = DIAS_INCUBAR) {
    const limite = ahoraMs - dias * 24 * 60 * MIN;
    const out = [];
    for (const p of projects || []) {
      if (!p || p.inBaul) continue;
      for (const t of p.tasks || []) {
        if (!t || !t.id || (t.column !== 'buzon' && t.column !== 'proximo') || t.dueAt) continue;
        const tocada = tiempo(t.updatedAt) || tiempo(t.createdAt);
        if (!tocada || tocada > limite) continue;
        out.push({ projectId: p.id, project: p.name, taskId: t.id, title: t.title, column: t.column, dias: Math.floor((ahoraMs - tocada) / (24 * 60 * MIN)) });
      }
    }
    return out.sort((a, b) => b.dias - a.dias);
  }

  // Lo que la incubadora movió y sigue en «Más tarde», lo más reciente primero
  function incubadas(projects) {
    const out = [];
    for (const p of projects || []) {
      if (!p || p.inBaul) continue;
      for (const t of p.tasks || []) {
        if (t && t.column === 'congelador' && t.incubatedAt) out.push({ projectId: p.id, project: p.name, taskId: t.id, title: t.title, incubatedAt: t.incubatedAt });
      }
    }
    return out.sort((a, b) => tiempo(b.incubatedAt) - tiempo(a.incubatedAt));
  }

  return {
    HIPERFOCO_MIN, DESCANSO_MIN, MUESTRAS_MIN, DIAS_QUIETO, DIAS_INCUBAR,
    nuevoEstado, tick, factor, ajustada, claveDia, inicioSemana, claveSemana, primeroDeHoy, resumenSemana,
    incubables, incubadas
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FocoCore;
}
