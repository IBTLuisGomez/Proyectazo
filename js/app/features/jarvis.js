'use strict';
// Jarvis: asistente conversacional con herramientas que actúan sobre los datos de la app.
// El servidor (/jarvis en Nexus) solo llama al modelo; las herramientas se ejecutan aquí,
// donde están los datos, y funcionan igual sin conexión con el backend.
// Sin proveedor de IA configurado, Jarvis usa el intérprete local de comandos (processNexusCommand).
// Métodos de ProyectazoApp (la clase base está en js/app.js).

const JARVIS = {
  CHAT_KEY: 'nexus_jarvis_chat',
  MEMORY_KEY: 'nexus_jarvis_memoria',
  VOICE_KEY: 'nexus_jarvis_voz',
  BRIEFING_KEY: 'nexus_briefing_dia',
  MAX_TOOL_ROUNDS: 6,
  MAX_HISTORY: 60,   // al superarlo se empieza conversación nueva (la memoria se conserva)
  MAX_MEMORY: 50,
  CATEGORY: { urgente: 'humo_rojo', proyecto: 'humo_azul', vida: 'humo_verde', idea: 'humo_dorado', luego: 'humo_ceniza' },
  EFFORTS: ['XS', 'S', 'M', 'L']
};

function jarvisRead(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function jarvisWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

defineAppMethods({

  // ---------- Panel ----------
  openJarvis() {
    let panel = document.getElementById('jarvis-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'jarvis-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Jarvis');
      panel.setAttribute('aria-modal', 'true');
      panel.className = 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm';
      panel.innerHTML = `
        <div class="w-full sm:max-w-lg h-[85dvh] sm:h-[70vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
          <header class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
            <div class="min-w-0">
              <h2 class="font-display font-bold text-white text-sm">🤖 Jarvis</h2>
              <p id="jarvis-mode" class="text-[11px] text-slate-400 truncate">Cuéntame qué tienes en la cabeza</p>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" onclick="app.toggleJarvisVoice()" id="jarvis-voice-btn" class="min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:bg-slate-800" title="Leer respuestas en voz alta"></button>
              <button type="button" onclick="app.newJarvisConversation()" class="min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:bg-slate-800 text-xs" title="Conversación nueva">🧹</button>
              <button type="button" onclick="app.closeJarvis()" class="min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:bg-slate-800" aria-label="Cerrar">✕</button>
            </div>
          </header>
          <div id="jarvis-log" class="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm" aria-live="polite"></div>
          <form onsubmit="event.preventDefault(); app.sendJarvis()" class="flex items-end gap-2 p-3 border-t border-slate-800">
            <button type="button" onclick="app.dictateField('jarvis-input')" class="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 text-lg" aria-label="Dictar">🎙️</button>
            <textarea id="jarvis-input" rows="1" placeholder="Ej: mañana a las 10 llamar al banco"
              onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); app.sendJarvis();}"
              class="flex-1 resize-none max-h-32 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"></textarea>
            <button type="submit" id="jarvis-send" class="min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm">Enviar</button>
          </form>
        </div>`;
      panel.addEventListener('click', e => { if (e.target === panel) this.closeJarvis(); });
      document.body.appendChild(panel);
    }
    panel.classList.remove('hidden');
    this._jarvisMode = undefined; // se vuelve a preguntar al servidor: puede haberse configurado la IA
    this.updateJarvisVoiceButton();
    this.renderJarvisLog();
    setTimeout(() => document.getElementById('jarvis-input')?.focus(), 50);
  },

  closeJarvis() {
    document.getElementById('jarvis-panel')?.classList.add('hidden');
    try { window.speechSynthesis?.cancel(); } catch (e) {}
  },

  newJarvisConversation() {
    jarvisWrite(JARVIS.CHAT_KEY, []);
    this.renderJarvisLog();
  },

  jarvisHistory() {
    const h = jarvisRead(JARVIS.CHAT_KEY, []);
    return Array.isArray(h) ? h : [];
  },

  // Vista: texto del usuario (sin el bloque de contexto), texto de Jarvis y acciones realizadas.
  // extra: fragmento html`` opcional al final (estado, errores)
  renderJarvisLog(extra = null) {
    const log = document.getElementById('jarvis-log');
    if (!log) return;
    const rows = [];
    if (this._briefingHtml) rows.push(html`<div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-xs leading-relaxed">${this._briefingHtml}</div>`);
    for (const m of this.jarvisHistory()) {
      const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content || []);
      if (m.role === 'user') {
        const said = blocks.find(b => b.type === 'text' && !b.text.startsWith('<contexto>'));
        if (said) rows.push(html`<div class="ml-10 p-3 rounded-2xl bg-cyan-600/20 border border-cyan-600/30 text-white">${said.text}</div>`);
        blocks.filter(b => b.type === 'tool_result').forEach(b => {
          rows.push(html`<div class="text-[11px] ${b.is_error ? 'text-rose-300' : 'text-emerald-300'}">${b.is_error ? '⚠️' : '✓'} ${String(b.content).slice(0, 160)}</div>`);
        });
      } else {
        blocks.filter(b => b.type === 'text' && b.text.trim()).forEach(b => {
          rows.push(html`<div class="mr-10 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 whitespace-pre-wrap">${b.text}</div>`);
        });
      }
    }
    if (!rows.length) rows.push(html`<p class="text-xs text-slate-500 text-center py-8">Puedes pedirme que apunte algo, que te avise, que parta una tarea o qué hacer ahora.</p>`);
    log.innerHTML = html`${rows}${extra}`;
    log.scrollTop = log.scrollHeight;
  },

  // ---------- Conversación ----------
  async sendJarvis(customText) {
    const input = document.getElementById('jarvis-input');
    const text = String(customText ?? input?.value ?? '').trim();
    if (!text || this._jarvisBusy) return;
    if (input) input.value = '';

    if (this._jarvisMode === 'local') return this.runJarvisLocal(text);

    let history = this.jarvisHistory();
    let restarted = false;
    if (history.length > JARVIS.MAX_HISTORY) { history = []; restarted = true; }
    // El contexto completo (memoria, proyectos) va al empezar; después solo lo que cambia cada turno
    history.push({ role: 'user', content: [{ type: 'text', text }, { type: 'text', text: this.jarvisContext(history.length === 0) }] });
    if (restarted) this.showToast('🧹 Empecé una conversación nueva para no ir lento. Lo que te pedí recordar sigue guardado.');
    jarvisWrite(JARVIS.CHAT_KEY, history);

    this._jarvisBusy = true;
    const sendBtn = document.getElementById('jarvis-send');
    if (sendBtn) sendBtn.disabled = true;
    try {
      for (let round = 0; round < JARVIS.MAX_TOOL_ROUNDS; round++) {
        this.renderJarvisLog(html`<p class="text-xs text-slate-500 animate-pulse">Jarvis está pensando…</p>`);
        const res = await fetch(`${this.NEXUS_API_BASE}/jarvis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Error ${res.status}`);

        if (body.provider === 'local') {
          // Sin IA configurada: deshacer el turno y usar el intérprete local
          history.pop();
          jarvisWrite(JARVIS.CHAT_KEY, history);
          this.setJarvisMode('local');
          return this.runJarvisLocal(text);
        }
        this.setJarvisMode(body.provider, body.model);

        history.push({ role: 'assistant', content: body.content || [] });
        const calls = (body.content || []).filter(b => b.type === 'tool_use');
        const incomplete = body.stop_reason === 'refusal' || body.stop_reason === 'max_tokens';
        if (incomplete && calls.length) {
          // Cada tool_use necesita su tool_result o la API rechazará los siguientes turnos
          history.push({ role: 'user', content: calls.map(c => ({ type: 'tool_result', tool_use_id: c.id, content: 'No se ejecutó: la respuesta quedó incompleta.', is_error: true })) });
        }
        jarvisWrite(JARVIS.CHAT_KEY, history);

        if (body.stop_reason === 'refusal') {
          this.renderJarvisLog(html`<p class="text-xs text-amber-300">No puedo ayudar con eso. Prueba a decirlo de otra forma.</p>`);
          return;
        }
        if (body.stop_reason === 'max_tokens') {
          this.renderJarvisLog(html`<p class="text-xs text-amber-300">La respuesta se cortó. Pídeme que siga.</p>`);
          return;
        }

        if (body.stop_reason !== 'tool_use' || !calls.length) {
          this.renderJarvisLog();
          this.speakJarvis(body.content);
          return;
        }
        // Todas las respuestas de herramientas en un único mensaje de usuario
        const results = calls.map(c => this.runJarvisTool(c));
        history.push({ role: 'user', content: results });
        jarvisWrite(JARVIS.CHAT_KEY, history);
      }
      this.renderJarvisLog(html`<p class="text-xs text-amber-300">He hecho varias acciones seguidas y me paro aquí. ¿Sigo?</p>`);
    } catch (err) {
      this.renderJarvisLog(html`<p class="text-xs text-rose-300">⚠️ ${err.message || 'Sin conexión con Jarvis'}. Lo que escribiste no se ha perdido: está arriba.</p>`);
    } finally {
      this._jarvisBusy = false;
      if (sendBtn) sendBtn.disabled = false;
      this.saveState();
      if (this.currentView) this.render();
    }
  },

  runJarvisLocal(text) {
    this.closeJarvis();
    // Intérprete local existente: entiende "para <proyecto>: …", fechas y categorías sin IA
    this.captureThought(text, { source: 'jarvis-local', voiceRoute: true });
  },

  setJarvisMode(provider, model) {
    this._jarvisMode = provider;
    const el = document.getElementById('jarvis-mode');
    if (!el) return;
    el.textContent = provider === 'local'
      ? 'Modo sin IA: guardo lo que digas en Soltar'
      : `Conectado (${model || provider})`;
  },

  // Contexto que acompaña a cada mensaje del usuario. Breve: Jarvis pide más con ver_tareas.
  jarvisContext(full = true) {
    const now = new Date();
    const projects = (this.state.projects || []).filter(p => !p.inBaul);
    const lines = [
      `Fecha y hora: ${now.toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (ISO ${now.toISOString()}, zona ${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      `Energía hoy: ${this.getEnergyToday ? this.getEnergyToday() : 'media'}`,
      `Proyectos: ${projects.map(p => `${p.name} (${(p.tasks || []).filter(t => t.column !== 'victorias').length} pendientes)`).join('; ') || 'ninguno'}`
    ];
    if (!full) return `<contexto>\n${lines.slice(0, 2).join('\n')}\n</contexto>`;
    const due = this.dueItems ? this.dueItems() : [];
    if (due.length) lines.push(`Para hoy: ${due.slice(0, 5).map(d => d.title).join('; ')}`);
    const memory = jarvisRead(JARVIS.MEMORY_KEY, []);
    if (memory.length) lines.push(`Sabes de la persona: ${memory.join('; ')}`);
    return `<contexto>\n${lines.join('\n')}\n</contexto>`;
  },

  // ---------- Herramientas ----------
  runJarvisTool(call) {
    const ok = content => ({ type: 'tool_result', tool_use_id: call.id, content });
    const fail = content => ({ type: 'tool_result', tool_use_id: call.id, content, is_error: true });
    const input = call.input && typeof call.input === 'object' ? call.input : {};
    const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const isoOrNull = v => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
    };
    const findProject = name => {
      const all = (this.state.projects || []).filter(p => !p.inBaul);
      const n = str(name).toLowerCase();
      return all.find(p => p.name.toLowerCase() === n) || (this.findProjectMatch(name)?.project ?? null);
    };

    try {
      switch (call.name) {
        case 'soltar_pensamiento': {
          const texto = str(input.texto);
          if (!texto) return fail('Falta el texto.');
          const category = JARVIS.CATEGORY[input.categoria];
          const [r] = this.captureThought(texto, { source: 'jarvis', category, skipSplit: true, silent: true });
          if (!r) return fail('No se pudo guardar.');
          if (r.kind === 'task') return ok(`Lo puse como tarea en ${r.projectName}: "${texto}"`);
          return ok(r.count > 1 ? `Ya estaba apuntado (van ${r.count} veces): "${r.content}"` : `Guardado en Soltar: "${texto}"`);
        }
        case 'crear_tarea': {
          const titulo = str(input.titulo);
          const project = findProject(input.proyecto);
          if (!titulo) return fail('Falta el título.');
          if (!project) return fail(`No existe el proyecto "${str(input.proyecto)}". Proyectos: ${(this.state.projects || []).filter(p => !p.inBaul).map(p => p.name).join(', ')}`);
          const dueAt = isoOrNull(input.para_cuando);
          if (dueAt === undefined) return fail('Fecha no válida; usa ISO 8601.');
          const effort = JARVIS.EFFORTS.includes(input.tamano) ? input.tamano : 'S';
          this.addTaskFromCapture(project, { text: titulo, dueAt, effort }, { silent: true });
          return ok(`Tarea creada en ${project.name}: "${titulo}"${dueAt ? ` para ${this.formatDue(dueAt)}` : ''}`);
        }
        case 'programar_aviso': {
          const texto = str(input.texto);
          const cuando = isoOrNull(input.cuando);
          if (!texto || !cuando) return fail('Necesito texto y una fecha ISO 8601 válida.');
          if (new Date(cuando).getTime() < Date.now() - 60000) return fail('Esa hora ya pasó.');
          const [saved] = this.captureThought(texto, { source: 'jarvis', category: 'humo_rojo', dueAt: cuando, skipSplit: true, silent: true });
          if (!saved || !saved.dueAt) return fail('No se pudo programar el aviso.');
          if (saved.kind === 'task') return ok(`Aviso para ${this.formatDue(cuando)} como tarea de ${saved.projectName}: "${texto}"`);
          const push = this.backendAvailable ? '' : ' (sin servidor: el aviso solo sonará con la app abierta)';
          return ok(`Aviso para ${this.formatDue(cuando)}: "${texto}"${push}`);
        }
        case 'ver_tareas': {
          const projects = input.proyecto ? [findProject(input.proyecto)].filter(Boolean) : (this.state.projects || []).filter(p => !p.inBaul);
          if (input.proyecto && !projects.length) return fail(`No existe el proyecto "${str(input.proyecto)}".`);
          const rows = [];
          projects.forEach(p => (p.tasks || []).filter(t => t.column !== 'victorias').forEach(t => {
            rows.push(`${p.name} | ${t.title} | ${t.column} | ${t.effort || 'S'}${t.dueAt ? ' | ' + this.formatDue(t.dueAt) : ''}`);
          }));
          return ok(rows.length ? rows.slice(0, 40).join('\n') : 'No hay tareas pendientes.');
        }
        case 'recordar_dato': {
          const dato = str(input.dato, 200);
          if (!dato) return fail('Falta el dato.');
          const memory = jarvisRead(JARVIS.MEMORY_KEY, []).filter(m => m !== dato);
          memory.push(dato);
          jarvisWrite(JARVIS.MEMORY_KEY, memory.slice(-JARVIS.MAX_MEMORY));
          return ok(`Lo recordaré: ${dato}`);
        }
        case 'empezar_foco': {
          const min = Math.round(Number(input.minutos));
          if (!(min >= 1 && min <= 90)) return fail('Minutos entre 1 y 90.');
          this.setTimerDuration(min);
          if (!this.timer.isRunning) this.startPauseTimer();
          this.closeJarvis();
          this.navigate('ahora');
          return ok(`Foco de ${min} min en marcha.`);
        }
        case 'ir_a': {
          if (!['soltar', 'ahora', 'repasar'].includes(input.seccion)) return fail('Sección no válida.');
          this.closeJarvis();
          this.navigate(input.seccion);
          return ok(`Abierto ${input.seccion}.`);
        }
        default:
          return fail(`Herramienta desconocida: ${call.name}`);
      }
    } catch (e) {
      return fail(`Falló al ejecutar ${call.name}: ${e.message}`);
    }
  },

  // ---------- Voz de salida ----------
  toggleJarvisVoice() {
    jarvisWrite(JARVIS.VOICE_KEY, !jarvisRead(JARVIS.VOICE_KEY, false));
    this.updateJarvisVoiceButton();
  },

  updateJarvisVoiceButton() {
    const btn = document.getElementById('jarvis-voice-btn');
    if (!btn) return;
    const on = jarvisRead(JARVIS.VOICE_KEY, false);
    btn.textContent = on ? '🔊' : '🔈';
    btn.setAttribute('aria-pressed', String(on));
  },

  speakJarvis(content) {
    if (!jarvisRead(JARVIS.VOICE_KEY, false) || !('speechSynthesis' in window)) return;
    const text = (content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.lang = 'es-ES';
      window.speechSynthesis.speak(u);
    } catch (e) {}
  },

  // ---------- Resumen de la mañana (local, sin IA, funciona offline) ----------
  buildBriefing() {
    const projects = (this.state.projects || []).filter(p => !p.inBaul);
    const parts = [];
    const due = this.dueItems ? this.dueItems() : [];
    const urgent = (this.state.pensadero || []).filter(x => !x.inBaul && x.category === 'humo_rojo' && !x.isResolved);
    const hour = new Date().getHours();
    parts.push(html`<strong>${hour < 13 ? '☀️ Buenos días' : hour < 20 ? '🌤️ Buenas tardes' : '🌙 Buenas noches'}.</strong>`);
    if (due.length) parts.push(html`📅 Para hoy: ${due.slice(0, 3).map(d => d.title).join(' · ')}${due.length > 3 ? ` y ${due.length - 3} más` : ''}.`);
    if (urgent.length) parts.push(html`🔴 ${urgent.length === 1 ? 'Hay 1 cosa urgente' : `Hay ${urgent.length} cosas urgentes`} en Soltar.`);
    const active = projects.find(p => p.status === 'en_ejecucion') || projects[0];
    if (active && this.ahoraCandidates) {
      const next = this.ahoraCandidates(active, this.getEnergyToday())[0];
      if (next) parts.push(html`🎯 Lo primero podría ser: <em>${next.title}</em> (${active.name}).`);
    }
    const stalled = projects.filter(p => (p.status === 'en_ejecucion' || p.status === 'activo') && this.daysSince(p.lastActivity) >= 7)
      .sort((a, b) => this.daysSince(b.lastActivity) - this.daysSince(a.lastActivity))[0];
    if (stalled) parts.push(html`💤 ${stalled.name} lleva ${this.daysSince(stalled.lastActivity)} días quieto. ¿Un paso pequeño o lo hibernamos sin culpa?`);
    if (parts.length === 1) parts.push(html`Nada urgente. Elige una cosa y empieza por 2 minutos.`);
    return html`${parts.map((p, i) => i ? html`<br>${p}` : p)}`;
  },

  // Se muestra una vez al día, a partir de las 6:00, al abrir la app.
  maybeShowBriefing() {
    const today = new Date().toDateString();
    if (new Date().getHours() < 6 || jarvisRead(JARVIS.BRIEFING_KEY, '') === today) return;
    if (!(this.state.projects || []).length && !(this.state.pensadero || []).length) return;
    jarvisWrite(JARVIS.BRIEFING_KEY, today);
    this._briefingHtml = this.buildBriefing();
    this.showToast('☀️ Tu resumen de hoy está listo', () => this.openJarvis(), 'Ver');
  },

  openBriefing() {
    this._briefingHtml = this.buildBriefing();
    this.openJarvis();
  },
});
