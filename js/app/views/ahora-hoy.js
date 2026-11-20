'use strict';
// Vistas "Ahora" y "Hoy": dónde me quedé, proyecto sugerido, racha y proyectos quietos.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

// Minutos aproximados por tamaño de tarea (campo effort que ya guarda el backend)
const ProyectazoAhora = { EFFORT_MINUTES: { XS: 5, S: 15, M: 45, L: 90 } };

defineAppMethods({

  // Tareas candidatas para "Ahora", en orden. Con energía baja primero las pequeñas; con alta, las grandes.
  ahoraCandidates(project, energy = 'media') {
    const colRank = { enfoco: 0, proximo: 1, buzon: 2 };
    const size = t => ProyectazoAhora.EFFORT_MINUTES[t.effort] || 15;
    const energyRank = t => energy === 'baja' ? size(t) : energy === 'alta' ? -size(t) : 0;
    return (project.tasks || [])
      .filter(t => t.column in colRank)
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (colRank[a.t.column] - colRank[b.t.column]) || (energyRank(a.t) - energyRank(b.t)) || (a.i - b.i))
      .map(x => x.t);
  },

  getEnergyToday() {
    try {
      const raw = JSON.parse(localStorage.getItem('nexus_energy') || 'null');
      if (raw && raw.date === new Date().toDateString()) return raw.level;
    } catch (e) {}
    return 'media';
  },

  setEnergyToday(level) {
    try { localStorage.setItem('nexus_energy', JSON.stringify({ date: new Date().toDateString(), level })); } catch (e) {}
    this.ahoraOffset = 0;
    this.render();
  },

  nextAhoraCandidate() {
    this.ahoraOffset = (this.ahoraOffset || 0) + 1;
    this.render();
  },

  // Anti-parálisis: 2 minutos con la tarea propuesta. Empezar es lo difícil; seguir suele venir solo.
  startTinyStep() {
    this.setTimerDuration(2);
    if (!this.timer.isRunning) this.startPauseTimer();
    if (this.currentView === 'ahora') this.render();
    this.showToast('🤏 Solo 2 minutos. Si al acabar quieres seguir, sigue; si no, ya has empezado.');
  },

  // ==========================================
  // VISTA 1: 🎯 AHORA (INICIO TDAH)
  // "¿Dónde me quedé y cuál es el paso de 15 minutos?"
  // Fusión de Zen, One Thing y Reingreso del Checkout
  // ==========================================
  renderViewAhora(container) {
    const projects = (this.state.projects || []).filter(p => !p.inBaul);

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4 my-8">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl">
            🎯
          </div>
          <div>
            <h3 class="text-xl font-display font-extrabold text-white">¿En qué quieres avanzar hoy?</h3>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">FocusFlow OS arranca con una sola pregunta para no saturar tu memoria de trabajo: crea tu primer proyecto o suelta una idea al orbe.</p>
          </div>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button onclick="app.openProjectModal()" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition">
              + Crear Primer Proyecto
            </button>
            <button onclick="app.navigate('soltar')" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition">
              💡 Soltar una Idea
            </button>
          </div>
        </div>
      `;
      return;
    }

    let activeProject = projects.find(p => p.id === this.selectedKanbanProjectId);
    if (!activeProject) {
      activeProject = projects.find(p => p.status === 'en_ejecucion') || projects.find(p => p.status === 'activo') || projects[0];
    }

    const energy = this.getEnergyToday();
    const candidates = this.ahoraCandidates(activeProject, energy);
    const offset = candidates.length ? (this.ahoraOffset || 0) % candidates.length : 0;
    const activeTask = candidates[offset] || {
      id: 'task-temp',
      title: activeProject.nextAction || 'Avanzar en el micro-paso de 15 minutos',
      notes: ''
    };
    const estimate = ProyectazoAhora.EFFORT_MINUTES[activeTask.effort];
    const energyBtn = (key, label) => `<button type="button" onclick="app.setEnergyToday('${key}')" aria-pressed="${energy === key}"
      class="min-h-[44px] px-3 rounded-full text-xs font-semibold border transition ${energy === key ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200' : 'border-slate-800 text-slate-400 hover:text-slate-200'}">${label}</button>`;

    const m = Math.floor(this.timer.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.timer.secondsLeft % 60).toString().padStart(2, '0');
    const totalSecs = (this.timer.durationMinutes || 25) * 60;
    const progressFrac = Math.max(0, Math.min(1, this.timer.secondsLeft / totalSecs));
    const ringCircumference = 540.35; // 2 * Math.PI * 86
    const ringOffset = ringCircumference * (1 - progressFrac);

    container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col space-y-4 py-2 px-1 relative select-none">

        <!-- 1. CONTEXTO: ¿DÓNDE ME QUEDÉ? -->
        <section class="flex flex-col items-center text-center space-y-2">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 shadow-sm text-xs">
            <span class="text-base">${activeProject.emoji || '🎯'}</span>
            <span class="font-bold text-white">${this.escapeHtml(activeProject.name)}</span>
            <span class="text-slate-600">•</span>
            <button onclick="app.navigate('hacer')" class="text-cyan-400 hover:text-cyan-300 font-medium text-[11px] underline" title="Ver lista de tareas de este proyecto">
              Cambiar tarea
            </button>
          </div>

          <!-- Título de la Única Tarea (15 min) -->
          <div class="flex flex-col items-center px-2 max-w-lg">
            <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-semibold">¿Cuál es el micro-paso de 15 minutos?</span>
            <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight leading-snug mt-1">
              ${this.escapeHtml(activeTask.title)}
            </h1>
            ${estimate ? `<span class="mt-1.5 text-xs font-mono text-slate-400">⏱ ~${estimate} min</span>` : ''}
            ${activeTask.notes ? `<p class="text-xs text-slate-400 mt-1 max-w-md italic truncate">"${this.escapeHtml(activeTask.notes)}"</p>` : ''}
          </div>

          <!-- Energía de hoy: ordena qué tarea se propone -->
          <div class="flex items-center justify-center gap-1.5 flex-wrap" role="group" aria-label="Tu energía ahora">
            <span class="text-[11px] text-slate-500">Energía:</span>
            ${energyBtn('baja', '🪫 Baja')}${energyBtn('media', '🔋 Media')}${energyBtn('alta', '⚡ Alta')}
          </div>

          <div class="flex items-center justify-center gap-2 flex-wrap">
            <button type="button" onclick="app.startTinyStep()" class="min-h-[44px] px-4 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition active:scale-95">
              🤷 No sé por dónde empezar
            </button>
            ${candidates.length > 1 ? `<button type="button" onclick="app.nextAhoraCandidate()" class="min-h-[44px] px-4 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition">↻ Otra</button>` : ''}
          </div>
        </section>

        <!-- 2. MEDIDOR CIRCULAR DE TIEMPO & SPRINT -->
        <section class="flex flex-col items-center justify-center relative py-1">
          <div class="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center">
            <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
              <circle class="text-slate-800 fill-none" cx="100" cy="100" r="86" stroke="currentColor" stroke-width="6"></circle>
              <circle class="${this.timer.isRunning ? 'text-emerald-400' : 'text-slate-400'} fill-none transition-all duration-1000" cx="100" cy="100" id="zen-view-timer-ring"
                r="86" stroke="currentColor" stroke-dasharray="540.35" stroke-dashoffset="${ringOffset}"
                stroke-linecap="round" stroke-width="7"></circle>
            </svg>

            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-4xl sm:text-5xl font-display font-black text-white tracking-tighter tabular-nums" id="zen-view-timer-display">
                ${m}:${s}
              </span>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="w-2 h-2 rounded-full ${this.timer.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
                <span class="text-[11px] font-mono uppercase tracking-wider ${this.timer.isRunning ? 'text-emerald-400' : 'text-slate-400'} font-bold">
                  ${this.timer.isRunning ? 'Enfoque Activo' : 'En Pausa'}
                </span>
              </div>
            </div>
          </div>

          <!-- Controles de Tiempo -->
          <div class="flex flex-wrap items-center justify-center gap-2.5 mt-3 px-2">
            <button onclick="app.startPauseTimer()" class="flex items-center gap-2 px-6 py-2.5 rounded-full ${this.timer.isRunning ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} font-display font-bold text-sm shadow-md active:scale-95 transition" id="zen-view-toggle-btn">
              <span>${this.timer.isRunning ? '⏸️' : '▶️'}</span>
              <span id="zen-view-toggle-label">${this.timer.isRunning ? 'Pausar' : 'Iniciar'}</span>
            </button>
            <button onclick="app.setTimerDuration(15)" class="px-3.5 py-2 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs transition" title="Fijar sprint a 15 minutos">
              15 min
            </button>
            <button onclick="app.addTimerMinutes(5)" class="px-3.5 py-2 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs transition" title="Extender sprint 5 minutos">
              +5m
            </button>
            <button onclick="app.resetTimer()" class="p-2.5 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Reiniciar temporizador">
              🔄
            </button>
          </div>
        </section>

        <!-- 3. RUIDO MARRÓN (CALMA SENSORIAL) -->
        <section class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow flex flex-col space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <button onclick="app.toggleBrownNoise()" class="w-9 h-9 rounded-xl ${this.isNoisePlaying ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'} flex items-center justify-center shrink-0 active:scale-90 transition">
                <span>${this.isNoisePlaying ? '🔊' : '🔈'}</span>
              </button>
              <div>
                <span class="font-display font-bold text-xs sm:text-sm text-white block">Ruido Marrón</span>
                <span class="text-[11px] text-slate-400 block">Silencia el parloteo mental y ruidos del entorno</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="app.setNoisePreset('brown')" class="noise-preset-btn px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300 font-mono text-[10px] font-bold border border-slate-700">Marrón</button>
              <button type="button" onclick="app.setNoisePreset('rain')" class="noise-preset-btn px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 font-mono text-[10px] font-bold border border-slate-800">Lluvia</button>
              <button type="button" onclick="app.setNoisePreset('binaural')" class="noise-preset-btn px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 font-mono text-[10px] font-bold border border-slate-800">40Hz</button>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-0.5">
            <span class="text-[10px] text-slate-500">🔈</span>
            <input type="range" min="0" max="1" step="0.02" value="0.65" id="zen-volume-slider" oninput="app.setNoiseVolume(this.value)"
              class="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-slate-400 cursor-pointer" />
            <span class="text-[10px] text-slate-400">🔊</span>
          </div>
        </section>

        <!-- 4. ACCIONES DE CIERRE Y ANTI-PARÁLISIS -->
        <section class="flex flex-col space-y-2 pt-1">
          <button onclick="app.completeSprintAndRegisterVictory('${activeProject.id}', '${activeTask.id}', '${this.uriArg(activeTask.title)}')"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm shadow-md active:scale-95 transition">
            <span>✓</span>
            <span>Listo, registrar el avance</span>
          </button>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="app.breakdownTaskWithAI('${this.uriArg(activeTask.title)}', '${activeProject.id}')"
              class="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
              <span>⚡</span>
              <span>Desglosar en 15 min</span>
            </button>
            <button onclick="app.toggleThoughtDrain()"
              class="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
              <span>💡</span>
              <span>Soltar distracción</span>
            </button>
          </div>

          <!-- Drawer desplegable para soltar distracción sin salir -->
          <div id="thought-drain-panel" class="hidden flex-col bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2 shadow-xl transition-all">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold text-slate-400 uppercase">Soltar pensamiento intrusivo al orbe</span>
              <button onclick="app.toggleThoughtDrain()" class="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div class="flex gap-1.5">
              <input type="text" id="zen-thought-input" placeholder="Ej: Responder correo a las 4..."
                onkeydown="if(event.key==='Enter') app.saveIntrusiveThought()"
                class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none" />
              <button onclick="app.saveIntrusiveThought()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">
                Soltar
              </button>
            </div>
          </div>
        </section>

      </div>
    `;
  },

  renderViewZen(container) {
    this.renderViewAhora(container);
  },

  addTimerMinutes(min) {
    this.timer.secondsLeft += min * 60;
    this.updateTimerDisplay();
    this.updateZenViewProgress();
  },

  updateZenViewProgress() {
    const m = Math.floor(this.timer.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.timer.secondsLeft % 60).toString().padStart(2, '0');
    const disp = document.getElementById('zen-view-timer-display');
    if (disp) disp.textContent = `${m}:${s}`;
    const ring = document.getElementById('zen-view-timer-ring');
    if (ring) {
      const totalSecs = (this.timer.durationMinutes || 25) * 60;
      const progressFrac = Math.max(0, Math.min(1, this.timer.secondsLeft / totalSecs));
      const ringCircumference = 540.35;
      ring.style.strokeDashoffset = (ringCircumference * (1 - progressFrac)).toString();
    }
  },

  toggleThoughtDrain() {
    const p = document.getElementById('thought-drain-panel');
    if (p) {
      p.classList.toggle('hidden');
      p.classList.toggle('flex');
      if (!p.classList.contains('hidden')) {
        const inp = document.getElementById('zen-thought-input');
        if (inp) inp.focus();
      }
    }
  },

  saveIntrusiveThought() {
    const inp = document.getElementById('zen-thought-input');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';
    this.toggleThoughtDrain();

    const newItem = {
      id: this.uid(),
      content: text,
      category: 'humo_blanco',
      createdAt: new Date().toISOString(),
      isPinned: false
    };
    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.saveState();

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_blanco');
      this.shaderEngine.pulseShockwave();
    }

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/pensadero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, category: 'humo_blanco' })
      }).catch(() => {});
    }

    if ('vibrate' in navigator && this.state?.settings?.vibration) {
      try { navigator.vibrate([20, 30]); } catch(e) {}
    }
    this.showToast("✓ Pensamiento intrusivo soltado. ¡Continúa enfocado!");
  },

  setNoisePreset(preset) {
    document.querySelectorAll('.noise-preset-btn').forEach(b => {
      if (b.getAttribute('data-preset') === preset) {
        b.className = 'noise-preset-btn flex flex-col items-center justify-center p-2 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold text-center transition';
      } else {
        b.className = 'noise-preset-btn flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800 font-semibold text-center transition';
      }
    });
    if (!this.isNoisePlaying) {
      this.playBrownNoise();
    }
  },

  setNoiseVolume(val) {
    if (this.audioCtx && this.brownGainNode) {
      this.brownGainNode.gain.setValueAtTime(parseFloat(val) * 0.12, this.audioCtx.currentTime);
    }
  },

  completeSprintAndRegisterVictory(projectId, taskId, taskTitle) {
    this.stopBrownNoise();
    const decodedTitle = decodeURIComponent(taskTitle || 'Tarea completada');

    // 1. Acorde de victoria dopamínico (Stitch C Major)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch(e) {}

    this.triggerDopamineReward();

    // Mover tarea a victorias si existe
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p && p.tasks) {
      const t = p.tasks.find(x => x.id === taskId);
      if (t) {
        t.column = 'victorias';
        t.updatedAt = new Date().toISOString();
        this.saveState();
        if (this.backendAvailable) {
          fetch(`${this.API_BASE}/tasks/${taskId}/move`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column: 'victorias' })
          }).catch(() => {});
        }
      }
    }

    if (projectId && projectId !== 'focus-temp') {
      setTimeout(() => this.openCheckout(projectId), 400);
    } else {
      this.showToast(`🎉 ¡Victoria registrada: "${decodedTitle}"!`);
    }
  },

  // ==========================================
  // VISTA 1: HOY & FOCO (DÓNDE ME QUEDÉ)
  // ==========================================
  renderViewHoy(container) {
    const allProjects = (this.state.projects || []).filter(p => !p.inBaul);
    const enEjecucionProjects = allProjects.filter(p => p.status === 'en_ejecucion');
    const activeProjects = allProjects.filter(p => p.status === 'activo');
    const totalLive = enEjecucionProjects.length + activeProjects.length;

    const filterFn = p => {
      if (this.batteryLevel === 20) return p.energy === 'baja' || p.nextActionType === 'hacer';
      if (this.activeFilterEnergy === 'all') return true;
      if (this.activeFilterEnergy === 'baja') return p.energy === 'baja';
      if (this.activeFilterEnergy === 'media') return p.energy === 'media';
      if (this.activeFilterEnergy === 'alta') return p.energy === 'alta';
      return true;
    };

    const filteredEjecucion = enEjecucionProjects.filter(filterFn);
    const filteredActivos = activeProjects.filter(filterFn);

    const sortedByColdest = [...enEjecucionProjects, ...activeProjects].sort((a, b) => this.daysSince(b.lastActivity) - this.daysSince(a.lastActivity));
    const heroProject = sortedByColdest[0] || null;

    // Streak y Heatmap de Consistencia TDAH (28 días)
    const monthlyHeatmap = this.getMonthlyHeatmapHistory(28);
    const currentStreak = this.calculateCurrentStreak();
    const totalMonthlyAdvances = monthlyHeatmap.reduce((sum, d) => sum + d.count, 0);

    container.innerHTML = `
      <!-- Header saludo y Medidor de Batería Mental -->
      <div class="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">¿Dónde me quedé hoy?</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="text-xs theme-text-muted font-medium">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5">
            ${enEjecucionProjects.length} en ejecución • ${activeProjects.length} en radar
          </h1>
        </div>

        <!-- Medidor de Batería Mental TDAH -->
        <div class="flex items-center gap-2 theme-card-subtle p-1.5 rounded-2xl border theme-border self-start lg:self-auto overflow-x-auto max-w-full">
          <span class="text-[11px] font-bold theme-text-muted px-2">Batería Mental:</span>
          <button onclick="app.setBattery(100)" class="px-2.5 py-1 rounded-xl text-xs font-semibold transition ${this.batteryLevel === 100 ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : 'theme-text-muted hover:text-white'}">
            🔋 100% (Hiperfoco)
          </button>
          <button onclick="app.setBattery(50)" class="px-2.5 py-1 rounded-xl text-xs font-semibold transition ${this.batteryLevel === 50 ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'theme-text-muted hover:text-white'}">
            ⚡ 50% (Normal)
          </button>
          <button onclick="app.setBattery(20)" class="px-2.5 py-1 rounded-xl text-xs font-semibold transition ${this.batteryLevel === 20 ? 'bg-rose-500 text-white font-bold shadow-sm' : 'theme-text-muted hover:text-white'}">
            🪫 20% (Niebla mental)
          </button>
        </div>
      </div>

      <!-- Banner de aviso si batería baja (Modo Niebla Mental) -->
      ${this.batteryLevel === 20 ? `
        <div class="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🪫</span>
            <div>
              <strong class="font-bold">Modo Niebla Mental Activado:</strong> Ocultamos tareas de alta energía. Haz solo una micro-acción de 5 min o vuelca ideas en El Pensadero.
            </div>
          </div>
          <button onclick="app.navigate('pensadero')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0">
            Ir a El Pensadero →
          </button>
        </div>
      ` : ''}

      <!-- Gamificación, Rachas y Refuerzo Dopaminérgico (Heatmap 28 días estilo GitHub / Duolingo) -->
      <div class="mb-6 p-4 sm:p-5 rounded-2xl theme-card border theme-border space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
              🔥
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">Racha de Momentum TDAH: ${currentStreak} días</span>
                <span class="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">${totalMonthlyAdvances} micro-avances este mes</span>
                <span class="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">⏱️ ${this.getFocusMinutes(7)} min de foco (7 días)</span>
              </div>
              <p class="text-[11px] theme-text-muted mt-0.5">
                Evidencia tangible contra la ceguera temporal. Los huecos vacíos son pausas de recarga, no fracasos.
              </p>
            </div>
          </div>

          <!-- Badges de Refuerzo Dopaminérgico -->
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <span class="text-[10px] font-mono px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/30">
              ${currentStreak >= 7 ? '🌟 Maestro del Enfoque' : (currentStreak >= 3 ? '⚡ En Racha Activa' : '🌱 Sembrando Inercia')}
            </span>
          </div>
        </div>

        <!-- Grid de 4 semanas (28 días) -->
        <div class="pt-2 border-t theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 overflow-x-auto pb-1">
          <span class="text-[10px] font-mono theme-text-muted uppercase tracking-wider shrink-0">Últimos 28 días:</span>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${monthlyHeatmap.map(d => {
              let cellClass = 'theme-card-subtle theme-text-muted opacity-60';
              if (d.count === 1) cellClass = 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40 font-bold';
              else if (d.count >= 2) cellClass = 'bg-emerald-400 text-slate-950 font-extrabold shadow-sm shadow-emerald-400/40 border-emerald-300';
              return `
                <div class="w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-mono transition-transform hover:scale-125 cursor-pointer ${cellClass}" title="${d.dateStr} (${d.dayName}): ${d.count} avances">
                  ${d.count > 0 ? (d.count > 1 ? d.count : '✓') : '·'}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      ${this.renderDueTodayCard()}
      ${this.renderStalledProjectsCard()}
      <div class="mb-5">${this.renderQuickReviewPrompt()}</div>

      <!-- HERO CARD: Sugerencia del Día (Elimina la decisión de inicio) -->
      ${heroProject ? `
        <div class="relative overflow-hidden mb-8 p-6 rounded-3xl theme-card border theme-border shadow-xl">
          <div class="absolute -right-8 -top-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Sugerencia del día
              </span>
              <span class="text-xs theme-text-muted">Sin pensar: arranca por aquí</span>
            </div>
            <div class="flex items-center gap-2 text-xs font-mono theme-text-muted">
              <span>${this.getFreshness(heroProject).label}</span>
            </div>
          </div>

          <div class="flex items-start gap-4 mb-4">
            <span class="text-3xl p-2.5 rounded-2xl theme-card-subtle border theme-border">${heroProject.emoji || '🎯'}</span>
            <div class="flex-1">
              <h2 class="text-xl sm:text-2xl font-display font-extrabold tracking-tight">${heroProject.name}</h2>
              ${heroProject.objective ? `<p class="text-xs theme-text-muted mt-0.5">${heroProject.objective}</p>` : ''}
            </div>
          </div>

          <!-- Próximo paso destacado -->
          <div class="p-4 rounded-2xl theme-card-subtle border theme-border mb-5">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🎯</span> Próxima Micro-Acción (Masticada)
              </span>
              <div class="flex items-center gap-1.5">
                <button onclick="app.promptMasticarTask('${this.jsStr(heroProject.nextAction)}')" class="text-[10px] theme-text-muted hover:text-white px-2 py-0.5 rounded border theme-border hover:brightness-110" title="Desglosar en 3 micro-pasos de 5 min">
                  🍴 Masticar
                </button>
                <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full theme-card border theme-border">
                  ${heroProject.nextActionType || 'hacer'}
                </span>
              </div>
            </div>
            <p class="text-base sm:text-lg font-semibold leading-relaxed">${heroProject.nextAction || 'Definir siguiente paso'}</p>

            ${heroProject.logs && heroProject.logs.length > 0 ? `
              <div class="mt-2.5 pt-2.5 border-t theme-border text-xs theme-text-muted flex items-center gap-2">
                <span class="text-emerald-400 font-bold">Último logro:</span>
                <span class="truncate">${heroProject.logs[0].achievement}</span>
              </div>
            ` : ''}
          </div>

          <!-- Botones de Acción Inmediata -->
          <div class="flex flex-wrap items-center gap-2.5">
            <button onclick="app.openZenMode(app.state.projects.find(p=>p.id==='${heroProject.id}'), '${this.jsStr(heroProject.nextAction)}')" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition">
              <span>🎯</span> Modo Zen Hiperfoco
            </button>
            <button onclick="app.openCheckout('${heroProject.id}')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border font-semibold text-xs hover:brightness-110 active:scale-95 transition">
              ▶ Registrar Avance
            </button>
            <button onclick="app.openKanbanProject('${heroProject.id}')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border theme-text-muted font-semibold text-xs hover:brightness-110 active:scale-95 transition">
              📋 Ver Kanban
            </button>
            <button onclick="app.skipProjectWithoutGuilt('${heroProject.id}')" class="ml-auto px-3 py-2 rounded-xl theme-text-muted hover:brightness-125 text-xs transition" title="Pospone el proyecto 3 días sin culpa visual">
              ⏭ Saltar sin culpa
            </button>
          </div>
        </div>
      ` : ''}

      <!-- SECCIÓN 1: PROYECTOS EN EJECUCIÓN (MÁX 3 - FOCO INMEDIATO) -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse"></span>
            <h3 class="text-sm font-display font-bold uppercase tracking-wider text-rose-300">
              🔥 En Ejecución (Foco Inmediato — ${enEjecucionProjects.length} de 3 Máx.)
            </h3>
          </div>
          <button onclick="app.openProjectModal()" class="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1">
            <span>+</span> Nuevo Proyecto
          </button>
        </div>

        ${filteredEjecucion.length === 0 ? `
          <div class="p-8 text-center theme-card rounded-2xl border border-dashed border-rose-500/30 bg-rose-950/10 space-y-2">
            <div class="text-3xl">🔥</div>
            <h4 class="text-sm font-bold text-white">Sin proyectos en Ejecución Inmediata</h4>
            <p class="text-xs theme-text-muted max-w-sm mx-auto">FocusFlow OS protege tu cerebro limitando la ejecución a 3 proyectos a la vez. Pulsa "🔥 Ejecutar" en cualquiera de tus proyectos activos en radar para enfocarlo aquí.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${filteredEjecucion.map(p => this.renderProjectCard(p)).join('')}
          </div>
        `}
      </div>

      <!-- SECCIÓN 2: PROYECTOS ACTIVOS (EN RADAR - ILIMITADOS) -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
            <h3 class="text-sm font-display font-bold uppercase tracking-wider text-cyan-300">
              ⚡ Proyectos Activos (En Radar — ${activeProjects.length})
            </h3>
          </div>
        </div>

        ${filteredActivos.length === 0 ? `
          <div class="p-8 text-center theme-card rounded-2xl border border-dashed theme-border space-y-2">
            <p class="text-xs theme-text-muted">No tienes proyectos adicionales en radar activo. Crea uno nuevo o despierta proyectos desde el Radar.</p>
            <button onclick="app.openProjectModal()" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition">
              + Crear Proyecto
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${filteredActivos.map(p => this.renderProjectCard(p)).join('')}
          </div>
        `}
      </div>

      <!-- Módulo de Vínculos & CRM Personal (Humo Púrpura 🟣 - Stitch Screen 4) -->
      <div class="mt-8 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(208,188,255,0.8)]"></span>
            <h3 class="font-display font-bold text-base sm:text-lg text-white">Vínculos & CRM Personal</h3>
          </div>
          <span class="font-mono text-[10px] text-purple-300 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">Humo Púrpura 🟣</span>
        </div>

        ${this.renderCrmPersonalSection()}
      </div>
    `;
  },

  renderCrmPersonalSection() {
    const crmItems = (this.state.pensadero || []).filter(item => item.category === 'humo_purpura');
    if (crmItems.length === 0) {
      return `
        <div class="p-5 rounded-3xl bg-slate-900/60 border border-purple-500/20 text-center space-y-2">
          <p class="text-xs text-slate-300">
            Tus relaciones y personas clave protegidas contra la amnesia del TDAH.
          </p>
          <p class="text-[11px] text-slate-500">
            Dicta al Orbe o añade una nota: <em>"Hablar con Elena para coordinar feedback"</em>.
          </p>
          <button onclick="app.quickAddCrmContact()" class="px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 font-semibold text-xs transition">
            + Añadir Contacto o Nota de Vínculo
          </button>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${crmItems.map(item => `
          <div class="p-4 rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-base shrink-0">
                🟣
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-white leading-snug break-words">${item.content}</p>
                <span class="text-[10px] font-mono text-purple-400 mt-1 block">${new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
            <div class="mt-3 pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
              <button onclick="app.openDispatchThoughtModal('${item.id}')" class="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition" title="Mandar a Proyecto">
                🚀 Proyecto
              </button>
              <button onclick="app.deletePensaderoItemWithUndo('${item.id}')" class="px-2 py-1 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 text-xs transition" title="Archivar">
                ✕
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  quickAddCrmContact() {
    const text = prompt("Nombre o nota del contacto / relación (Humo Púrpura):");
    if (!text || !text.trim()) return;
    const newItem = {
      id: this.uid(),
      content: text.trim(),
      category: 'humo_purpura',
      createdAt: new Date().toISOString(),
      isPinned: false
    };
    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.saveState();
    this.render();
  },

  getStreakHistory() {
    const days = [];
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    let allLogs = [];
    (this.state.projects || []).forEach(p => {
      (p.logs || []).forEach(l => allLogs.push(new Date(l.date)));
    });

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const count = allLogs.filter(logDate => logDate.toISOString().slice(0, 10) === dateStr).length;
      days.push({
        dateStr: dateStr,
        label: labels[d.getDay()],
        count: count,
        hasActivity: count > 0
      });
    }
    return days;
  },

  getMonthlyHeatmapHistory(daysCount = 28) {
    const days = [];
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    let allLogs = [];
    (this.state.projects || []).forEach(p => {
      (p.logs || []).forEach(l => {
        if (l.date) allLogs.push(new Date(l.date).toISOString().slice(0, 10));
      });
    });

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = allLogs.filter(logDate => logDate === dateStr).length;
      days.push({
        dateStr: dateStr,
        dayName: labels[d.getDay()],
        count: count,
        hasActivity: count > 0
      });
    }
    return days;
  },

  calculateCurrentStreak() {
    let allLogs = [];
    (this.state.projects || []).forEach(p => {
      (p.logs || []).forEach(l => {
        if (l.date) allLogs.push(new Date(l.date).toISOString().slice(0, 10));
      });
    });
    const uniqueDays = new Set(allLogs);
    let streak = 0;
    let checkDate = new Date();
    const todayStr = checkDate.toISOString().slice(0, 10);
    if (!uniqueDays.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      if (uniqueDays.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return Math.max(streak, 1);
  },

  setBattery(level) {
    this.batteryLevel = level;
    this.render();
  },

  renderProjectCard(project) {
    const fresh = this.getFreshness(project);
    const latestLog = (project.logs && project.logs.length > 0) ? project.logs[0] : null;
    const d = this.daysSince(project.lastActivity);
    const healthPct = Math.max(15, Math.min(100, Math.round(100 - (d * 12))));

    return `
      <div class="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between relative overflow-hidden backdrop-blur-md"
           style="border-left: 5px solid ${project.color || '#4cd7f6'};">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-2xl shrink-0">${project.emoji || '🎯'}</span>
              <div class="min-w-0">
                <h4 class="font-display font-bold text-base sm:text-lg leading-tight text-white truncate">${this.escapeHtml(project.name)}</h4>
                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span class="text-[10px] font-mono px-2 py-0.2 rounded-full border ${fresh.badge} inline-block">
                    ${fresh.label}
                  </span>
                  ${project.status === 'en_ejecucion' ? `
                    <span class="text-[10px] font-mono px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold inline-block">
                      🔥 En Ejecución
                    </span>
                  ` : `
                    <span class="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-block">
                      ⚡ Radar
                    </span>
                  `}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${project.status === 'activo' ? `
                <button onclick="app.promoteToEjecucion('${project.id}')" class="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold border border-rose-500/30 transition" title="Promover a Ejecución Inmediata (Foco)">
                  🔥 Ejecutar
                </button>
              ` : (project.status === 'en_ejecucion' ? `
                <button onclick="app.demoteToActivo('${project.id}')" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-semibold border border-slate-700 transition" title="Pasar a Radar Activo">
                  ⚡ A Radar
                </button>
              ` : '')}
              <button onclick="app.openProjectModal('${project.id}')" class="text-slate-400 hover:text-white p-1 text-xs shrink-0" title="Editar Proyecto (CRUD)">
                ⚙️
              </button>
            </div>
          </div>

          <!-- Medidor de Frescura / Salud (Stitch Screen 4) -->
          <div class="my-2.5">
            <div class="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-400">
              <span>Frescura: <strong class="text-white">${healthPct}% Salud</strong></span>
              <span class="text-cyan-400 font-semibold">${d === 0 ? 'Tocado hoy 🔥' : (d <= 3 ? 'Listo para Ejecución' : 'Enfriándose')}</span>
            </div>
            <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" style="width: ${healthPct}%; background: ${project.color || '#4cd7f6'};"></div>
            </div>
          </div>

          <!-- Próximo paso fijado (Stitch Style) -->
          <div class="my-2.5 p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2">
            <span class="text-cyan-400 text-sm shrink-0 mt-0.5">🚩</span>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-mono text-cyan-300 uppercase tracking-wider font-semibold">Próximo paso:</span>
                <span class="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">${project.nextActionType || 'hacer'}</span>
              </div>
              <p class="text-xs font-bold text-white mt-0.5 leading-snug">
                ${project.nextAction || '<span class="italic text-slate-500">No definido aún</span>'}
              </p>
            </div>
          </div>

          ${latestLog ? `
            <p class="text-[11px] text-slate-400 mb-2 line-clamp-1">
              <strong>Último avance:</strong> ${latestLog.achievement}
            </p>
          ` : ''}

          ${project.originThoughtContent ? `
            <div class="mb-2 text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1.5 truncate" title="Pensamiento original en El Pensadero: ${project.originThoughtContent}">
              <span>🔮</span>
              <span class="truncate italic font-mono">"${project.originThoughtContent}"</span>
            </div>
          ` : ''}
        </div>

        <!-- Botones de Acción Táctiles (Stitch Mobile) -->
        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
          <button onclick="app.openCheckout('${project.id}')" class="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-display font-extrabold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition text-center" title="Registrar avance">
            ▶ Avancé
          </button>
          <button onclick="app.launchZenForTask('${project.id}', '', '${this.uriArg(project.nextAction || project.name)}')" class="py-2 px-2.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 font-semibold text-xs transition" title="Llevar a Modo Zen">
            🧘 Zen
          </button>
          <button onclick="app.openOneThingMode('${project.id}')" class="py-2 px-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-semibold text-xs transition" title="Modo Solo 1 Cosa (Filtro de Ruido)">
            👁️
          </button>
          <button onclick="app.openKanbanProject('${project.id}')" class="py-2 px-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition" title="Ver Kanban">
            📋
          </button>
          <button onclick="app.skipProjectWithoutGuilt('${project.id}')" class="py-2 px-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700/60 transition" title="Saltar sin culpa (+3 días)">
            ⏭
          </button>
        </div>
      </div>
    `;
  },

  skipProjectWithoutGuilt(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.render();
    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projectId}/skip`, { method: 'POST' }).catch(() => {});
    }
  },
});
