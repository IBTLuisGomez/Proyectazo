'use strict';
// Embudo único de captura: todo lo que se suelta (orbe, gadget, voz, Ctrl+K, consola Nexus, compartir)
// entra por captureThought(). Guarda al instante y clasifica después, sin preguntar nada.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({
  /**
   * @param {string} text  Lo que el usuario soltó (puede traer varias ideas)
   * @param {object} opts  source: origen ('soltar', 'voz', 'gadget'…); category: color elegido a mano;
   *                       skipSplit: no separar; silent: sin aviso; voiceRoute: el nombre de un proyecto lo envía allí
   * @returns {object[]} pensamientos creados o reutilizados
   */
  captureThought(text, opts = {}) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const ideas = opts.skipSplit ? [raw] : CapturaParser.splitIdeas(raw);
    if (!ideas.length) ideas.push(raw);
    const multiple = ideas.length > 1;
    const results = [];

    for (const idea of ideas) {
      const parsed = CapturaParser.parseIdea(idea);
      if (!parsed.text) continue;
      const explicitCategory = (opts.category && opts.category !== 'humo_general') ? opts.category : parsed.category;

      // "para <proyecto>: …" o, por voz, nombrar el proyecto → tarea directa en su Buzón
      const target = parsed.projectName
        ? this.findProjectMatch(parsed.projectName)
        : (opts.voiceRoute ? this.findProjectMatch(parsed.text, { byNameOnly: true }) : null);
      if (target) {
        this.addTaskFromCapture(target.project, parsed, { silent: opts.silent || multiple });
        continue;
      }

      const repeated = this.registerRepeatedThought(parsed.text);
      if (repeated) {
        results.push(repeated);
        continue;
      }

      const stored = this.quickDumpToOrbe(parsed.text, explicitCategory || 'humo_general', {
        amount: parsed.amount,
        contactName: parsed.contactName,
        dueAt: parsed.dueAt,
        source: opts.source || null
      });
      if (!stored) continue;
      const { item, created } = stored;
      results.push(item);

      if (parsed.dueAt) this.scheduleCaptureReminder(item, created);

      const suggestion = this.findProjectMatch(parsed.text);
      if (suggestion) item.suggestedProjectId = suggestion.project.id;

      if (!explicitCategory) {
        created.then(() => this.classifyCapturedThought(item.id, { silent: opts.silent || multiple }));
      } else if (!opts.silent && !multiple) {
        const meta = SMOKE_PALETTE[explicitCategory] || SMOKE_PALETTE.humo_general;
        this.showToast(`✓ Soltado en ${meta.icon} ${meta.name}: "${parsed.text.slice(0, 40)}"`);
      }
    }

    if (multiple && !opts.silent) {
      const ids = results.map(r => r.id);
      this.showToast(`✂️ Separé ${ideas.length} ideas para que cada una vaya a su sitio`, () => {
        // Unir: deshacer la separación y guardar el texto como un solo pensamiento
        this.state.pensadero = (this.state.pensadero || []).filter(p => !ids.includes(p.id));
        if (this.backendAvailable) ids.forEach(id => fetch(`${this.API_BASE}/pensadero/${id}`, { method: 'DELETE' }).catch(() => {}));
        this.saveState();
        this.captureThought(raw, { ...opts, skipSplit: true });
      }, 'Unir');
    }
    this.saveState();
    if (this.currentView === 'soltar' || this.currentView === 'pensadero') {
      if (typeof this.renderPensaderoItemsOnly === 'function') this.renderPensaderoItemsOnly();
    }
    return results;
  },

  // Un pensamiento que ya estaba (sin resolver) no se duplica: cuenta las veces que vuelve.
  registerRepeatedThought(text) {
    const key = CapturaParser.normalize(text);
    const existing = (this.state.pensadero || []).find(p => !p.isResolved && CapturaParser.normalize(p.content) === key);
    if (!existing) return null;
    const ageMs = Date.now() - new Date(existing.lastSeenAt || existing.createdAt).getTime();
    if (ageMs < 10 * 60 * 1000) return existing; // doble envío accidental: se ignora
    existing.count = (existing.count || 1) + 1;
    existing.lastSeenAt = new Date().toISOString();
    this.state.pensadero = [existing, ...this.state.pensadero.filter(p => p !== existing)];
    this.showToast(`💭 Lo has pensado ${existing.count} veces. Quizá merece un micro-paso.`, () => this.quickDispatchThoughtToProject(existing.id), 'Moverlo');
    return existing;
  },

  addTaskFromCapture(project, parsed, { silent = false } = {}) {
    if (!project.tasks) project.tasks = [];
    const task = { id: this.uid(), title: parsed.text, column: 'buzon', effort: 'S', createdAt: new Date().toISOString() };
    project.tasks.unshift(task);
    project.lastActivity = new Date().toISOString();
    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      }).catch(() => {});
    }
    if (parsed.dueAt && this.backendAvailable) {
      this.scheduleBackgroundPush(task.id, parsed.text, parsed.dueAt).catch(() => {});
    }
    if (!silent) this.showToast(`🚀 A ${project.name}: "${parsed.text.slice(0, 40)}"`, () => this.openKanbanProject(project.id), 'Ver');
    return task;
  },

  scheduleCaptureReminder(item, created) {
    if (!this.backendAvailable) return;
    created
      .then(() => this.scheduleBackgroundPush(item.id, item.content, item.dueAt))
      .catch(() => {});
  },

  /**
   * Clasificación en segundo plano: reglas locales + memoria de correcciones; Gemini solo si el usuario
   * lo activó y lo local no encontró pistas. Nunca toca algo que el usuario ya cambió.
   */
  async classifyCapturedThought(itemId, { silent = false } = {}) {
    if (!this.isAutoClassifyEnabled()) return;
    const item = (this.state.pensadero || []).find(p => p.id === itemId);
    if (!item || item.category !== 'humo_general') return;

    const local = CapturaParser.classifyLocal(item.content, { memory: this.state.settings?.classifierMemory });
    if (local.matched) {
      item.classifiedBy = { by: 'local', reasons: local.reasons, confidence: local.confidence };
      this.changeThoughtCategory(itemId, local.category, { source: 'auto' });
      if (silent) return;
      const meta = SMOKE_PALETTE[local.category];
      const why = local.reasons.length ? ` · por «${local.reasons.join('», «')}»` : '';
      const project = item.suggestedProjectId && (this.state.projects || []).find(p => p.id === item.suggestedProjectId);
      if (project) {
        this.showToast(`🧠 ${meta.icon} ${meta.name}${why}. ¿Es de ${project.name}?`, () => this.executeDispatchThought(itemId, project.id, 'buzon'), 'Mandar');
      } else {
        this.showToast(`🧠 Lo puse en ${meta.icon} ${meta.name}${why}`, () => this.changeThoughtCategory(itemId, 'humo_general', { source: 'auto' }), 'Deshacer');
      }
      return;
    }

    if (this.isCloudAIEnabled()) await this.nexusClassifyNewThought(itemId, item.content);
  },

  isCloudAIEnabled() {
    return this.state.settings?.cloudAI === true;
  },

  setCloudAI(enabled) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.cloudAI = !!enabled;
    this.saveState();
    this.showToast(enabled
      ? '☁️ Las frases sin pistas se consultarán a Gemini (nunca lo de "Soltar" ni el Baúl).'
      : '🔒 La clasificación es 100 % local en este dispositivo.');
  }
});
