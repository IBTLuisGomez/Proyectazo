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
      if (opts.dueAt) parsed.dueAt = opts.dueAt; // fecha ya resuelta (p. ej. por Jarvis)
      const explicitCategory = (opts.category && opts.category !== 'humo_general') ? opts.category : parsed.category;

      // "para <proyecto>: …" o, por voz, nombrar el proyecto → tarea directa en su Buzón
      const target = parsed.projectName
        ? this.findProjectMatch(parsed.projectName)
        : (opts.voiceRoute ? this.findProjectMatch(parsed.text, { byNameOnly: true }) : null);
      if (target) {
        const task = this.addTaskFromCapture(target.project, parsed, { silent: opts.silent || multiple });
        results.push({ id: task.id, kind: 'task', projectName: target.project.name, dueAt: task.dueAt });
        continue;
      }

      const repeated = this.registerRepeatedThought(parsed.text);
      if (repeated) {
        // Repetir algo ya apuntado con una hora nueva programa el aviso igualmente
        if (parsed.dueAt) {
          repeated.dueAt = new Date(parsed.dueAt).toISOString();
          repeated.updatedAt = new Date().toISOString();
          this.scheduleCaptureReminder(repeated, Promise.resolve());
        }
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
      const ids = results.filter(r => r.kind !== 'task').map(r => r.id);
      this.showToast(`✂️ Separé ${ideas.length} ideas para que cada una vaya a su sitio`, () => {
        // Unir: deshacer la separación y guardar el texto como un solo pensamiento
        this.state.pensadero = (this.state.pensadero || []).filter(p => !ids.includes(p.id));
        ids.forEach(id => this.deleteOnServer('pensadero', id));
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
    const existing = (this.state.pensadero || []).find(p => !p.isResolved && !p.inBaul && CapturaParser.normalize(p.content) === key);
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
    const task = {
      id: this.uid(), title: parsed.text, column: 'buzon', effort: parsed.effort || 'S',
      dueAt: parsed.dueAt ? new Date(parsed.dueAt).toISOString() : null,
      createdAt: new Date().toISOString()
    };
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

  // Chips de la tarjeta: por qué tiene ese color, cuántas veces volvió y cuándo avisa
  captureChips(item) {
    const chips = [];
    const by = item.classifiedBy && item.classifiedBy.by;
    if (by === 'local' && item.classifiedBy.reasons && item.classifiedBy.reasons.length) {
      chips.push(`🧠 por «${item.classifiedBy.reasons.map(r => this.escapeHtml(r)).join('», «')}»`);
    } else if (by === 'usuario') {
      chips.push('✋ elegido por ti');
    } else if (by === 'gemini') {
      chips.push('☁️ sugerido por IA');
    }
    if (item.count > 1) chips.push(`💭 pensado ${item.count} veces`);
    if (item.dueAt) chips.push(`⏰ ${new Date(item.dueAt).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    if (!chips.length) return '';
    return `<div class="flex flex-wrap gap-1.5 mt-1.5">${chips.map(c => `<span class="text-[11px] px-2 py-0.5 rounded-full theme-card-subtle border theme-border theme-text-muted">${c}</span>`).join('')}</div>`;
  },

  // Categorías que ya no existen (p. ej. "chispa" de la antigua captura rápida) vuelven a Sin clasificar
  migrateLegacyCategories() {
    let changed = false;
    for (const item of (this.state.pensadero || [])) {
      if (item && item.category && !SMOKE_PALETTE[item.category]) {
        item.category = 'humo_general';
        changed = true;
      }
    }
    if (changed) this.saveState();
  },

  // Entradas desde fuera: "Compartir" de otras apps (Share Target) y accesos directos del icono
  handleLaunchIntent() {
    const params = new URLSearchParams(window.location.search);
    const shared = ['title', 'text', 'url'].map(k => (params.get(k) || '').trim()).filter(Boolean);
    const mode = params.get('capturar');
    if (!shared.length && !mode) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);

    if (shared.length) {
      // Evitar "título — título" cuando la app de origen repite el texto
      const unique = shared.filter((v, i) => shared.findIndex(o => o === v || o.includes(v)) === i);
      this.captureThought(unique.join(' — '), { source: 'compartir', skipSplit: true });
      this.navigate('soltar');
      return;
    }
    this.openQuickCapture();
    if (mode === 'urgente') {
      const field = document.getElementById('quick-capture-text');
      if (field) field.value = 'urgente: ';
    }
  },

  // --- REPASO RÁPIDO: ordenar lo que quedó sin clasificar, de a uno ---
  pendingReviewItems() {
    return (this.state.pensadero || [])
      .filter(p => p && !p.isResolved && (p.category === 'humo_general' || !p.category))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  renderQuickReviewPrompt() {
    const n = this.pendingReviewItems().length;
    if (n < 3) return '';
    const minutes = Math.max(1, Math.round(Math.min(n, 10) * 0.3));
    return `
      <button type="button" onclick="app.startQuickReview()" class="w-full p-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 text-left transition flex items-center justify-between gap-3">
        <span><strong>🧹 Repaso de ${minutes} min</strong> <span class="theme-text-muted">· ${n} pensamientos sin clasificar, de a uno</span></span>
        <span class="text-cyan-300 font-bold shrink-0">Empezar →</span>
      </button>`;
  },

  startQuickReview() {
    this._review = { queue: this.pendingReviewItems().slice(0, 10).map(p => p.id), index: 0, done: 0 };
    if (!this._review.queue.length) {
      this.showToast('✨ No hay nada sin clasificar. Mente despejada.');
      return;
    }
    if (!this._reviewKeys) {
      this._reviewKeys = (e) => {
        const modal = document.getElementById('modal-quick-review');
        if (!modal || modal.classList.contains('hidden') || /input|textarea|select/i.test(e.target.tagName)) return;
        const keys = this.reviewCategories();
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= keys.length) { e.preventDefault(); this.reviewChoose(keys[n - 1]); }
        else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); this.reviewSkip(); }
        else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); this.reviewResolve(); }
      };
      document.addEventListener('keydown', this._reviewKeys);
    }
    this.renderReviewCard();
    this.openModal('modal-quick-review');
  },

  reviewCategories() {
    return SMOKE_VISIBLE_KEYS.filter(k => k !== 'humo_general');
  },

  renderReviewCard() {
    const r = this._review;
    const body = document.getElementById('quick-review-body');
    if (!r || !body) return;
    const item = (this.state.pensadero || []).find(p => p.id === r.queue[r.index]);
    if (!item) return this.finishQuickReview();
    const suggestion = CapturaParser.classifyLocal(item.content, { memory: this.state.settings?.classifierMemory });
    const project = this.findProjectForText(item.content);
    document.getElementById('quick-review-progress').textContent = `${r.index + 1} de ${r.queue.length}`;
    body.innerHTML = `
      <p class="text-lg font-semibold leading-snug">${this.escapeHtml(item.content)}</p>
      <p class="text-[11px] theme-text-muted">Toca un color (o pulsa 1–${this.reviewCategories().length}). Lo que elijas lo aprenderé para la próxima.</p>
      <div class="grid grid-cols-3 gap-2">
        ${this.reviewCategories().map((k, i) => {
          const m = SMOKE_PALETTE[k];
          const hint = suggestion.matched && categoriaVisible(suggestion.category) === k ? ' ring-2 ring-cyan-400' : '';
          return `<button type="button" onclick="app.reviewChoose('${k}')" class="p-2 rounded-xl border ${m.badgeClass}${hint} text-xs font-semibold text-left transition active:scale-95">
            <span class="theme-text-muted font-mono">${i + 1}</span> ${m.icon} ${m.name}</button>`;
        }).join('')}
      </div>
      ${project ? `<button type="button" onclick="app.reviewSendToProject('${project.id}')" class="w-full py-2 rounded-xl border theme-border text-xs font-semibold">🚀 Es de ${this.escapeHtml(project.name)}: mandarlo a su Buzón</button>` : ''}
      <div class="flex gap-2">
        <button type="button" onclick="app.reviewResolve()" class="flex-1 py-2 rounded-xl border theme-border text-xs font-semibold">✓ Ya no importa</button>
        <button type="button" onclick="app.reviewSkip()" class="flex-1 py-2 rounded-xl border theme-border text-xs font-semibold">Saltar →</button>
      </div>`;
  },

  advanceReview(counted) {
    if (counted) this._review.done++;
    this._review.index++;
    if (this._review.index >= this._review.queue.length) this.finishQuickReview();
    else this.renderReviewCard();
  },

  reviewChoose(category) {
    const id = this._review && this._review.queue[this._review.index];
    if (!id) return;
    // Si la sugerencia local cae en el mismo grupo, conservar su subtipo (p. ej. personas dentro de Vida)
    const item = (this.state.pensadero || []).find(p => p.id === id);
    if (item) {
      const sug = CapturaParser.classifyLocal(item.content, { memory: this.state.settings?.classifierMemory });
      if (sug.matched && categoriaVisible(sug.category) === category) category = sug.category;
    }
    this.changeThoughtCategory(id, category); // corrección del usuario: se aprende
    this.advanceReview(true);
  },

  reviewSendToProject(projectId) {
    const id = this._review && this._review.queue[this._review.index];
    if (!id) return;
    this.executeDispatchThought(id, projectId, 'buzon');
    this.closeModal('modal-dispatch-thought');
    this.openModal('modal-quick-review');
    this.advanceReview(true);
  },

  reviewResolve() {
    const id = this._review && this._review.queue[this._review.index];
    const item = (this.state.pensadero || []).find(p => p.id === id);
    if (!item) return;
    item.isResolved = true;
    item.updatedAt = new Date().toISOString();
    this.saveState();
    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/pensadero/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: true })
      }).catch(() => {});
    }
    this.advanceReview(true);
  },

  reviewSkip() {
    this.advanceReview(false);
  },

  finishQuickReview() {
    const done = this._review ? this._review.done : 0;
    this._review = null;
    this.closeModal('modal-quick-review');
    this.render();
    if (done) {
      this.triggerDopamineReward();
      this.showToast(`🧹 Repaso hecho: ${done} pensamiento(s) en su sitio. Menos ruido en la cabeza.`);
    }
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
