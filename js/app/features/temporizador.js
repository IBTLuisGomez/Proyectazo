'use strict';
// Temporizador de sprint, minutos de foco y recompensas (sonido, vibración).
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // SPRINT FOCUS TIMER
  // ==========================================
  toggleTimerWidget() {
    const bar = document.getElementById('sprint-timer-bar');
    bar.classList.toggle('hidden');
  },

  setTimerDuration(minutes) {
    this.timer.durationMinutes = minutes;
    this.timer.secondsLeft = minutes * 60;
    this.updateTimerDisplay();
  },

  startPauseTimer() {
    if (this.timer.isRunning) {
      clearInterval(this.timer.intervalId);
      this.timer.isRunning = false;
      this.accumulateFocusSegment();
      document.getElementById('timer-toggle-btn').textContent = 'Continuar';
      const zenBtn = document.getElementById('zen-timer-btn');
      if (zenBtn) zenBtn.textContent = 'Continuar';
      const zenViewLabel = document.getElementById('zen-view-toggle-label');
      if (zenViewLabel) zenViewLabel.textContent = 'Continuar';
    } else {
      this.timer.isRunning = true;
      this.timer.endAt = Date.now() + this.timer.secondsLeft * 1000;
      this.timer.segmentStart = Date.now();
      document.getElementById('timer-toggle-btn').textContent = 'Pausar';
      const zenBtn = document.getElementById('zen-timer-btn');
      if (zenBtn) zenBtn.textContent = 'Pausar';
      const zenViewLabel = document.getElementById('zen-view-toggle-label');
      if (zenViewLabel) zenViewLabel.textContent = 'Pausar';
      this.timer.intervalId = setInterval(() => {
        this.timer.secondsLeft = Math.max(0, Math.ceil((this.timer.endAt - Date.now()) / 1000));
        this.updateTimerDisplay();
        this.focoTick(); // acompañamiento, aviso de hiperfoco y tiempo real por tarea
        if (this.timer.secondsLeft <= 0) {
          clearInterval(this.timer.intervalId);
          this.timer.isRunning = false;
          this.accumulateFocusSegment();
          this.onTimerComplete();
        }
      }, 1000);
    }
  },

  resetTimer() {
    clearInterval(this.timer.intervalId);
    if (this.timer.isRunning) this.accumulateFocusSegment();
    this.timer.isRunning = false;
    const partialMinutes = Math.floor((this.timer.focusedMs || 0) / 60000);
    if (partialMinutes >= 5) this.recordFocusSession(partialMinutes);
    this.timer.focusedMs = 0;
    this.timer.secondsLeft = this.timer.durationMinutes * 60;
    document.getElementById('timer-toggle-btn').textContent = 'Iniciar';
    const zenBtn = document.getElementById('zen-timer-btn');
    if (zenBtn) zenBtn.textContent = 'Iniciar';
    const zenViewLabel = document.getElementById('zen-view-toggle-label');
    if (zenViewLabel) zenViewLabel.textContent = 'Iniciar';
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const m = Math.floor(this.timer.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.timer.secondsLeft % 60).toString().padStart(2, '0');
    const timeStr = `${m}:${s}`;
    const headerEl = document.getElementById('header-timer-display');
    const barEl = document.getElementById('bar-timer-countdown');
    const zenEl = document.getElementById('zen-timer-display');
    if (headerEl) headerEl.textContent = timeStr;
    if (barEl) barEl.textContent = timeStr;
    if (zenEl) zenEl.textContent = timeStr;
    this.updateZenViewProgress();
  },

  onTimerComplete() {
    this.stopBrownNoise();
    this.triggerDopamineReward();
    const minutes = Math.max(1, Math.round((this.timer.focusedMs || 0) / 60000));
    this.recordFocusSession(minutes);
    this.timer.focusedMs = 0;
    this.timer.secondsLeft = this.timer.durationMinutes * 60;
    this.updateTimerDisplay();

    const projectId = this.getFocusProjectId();
    const msg = `🎉 Sprint completado: ${minutes} min de foco. Tómate 2 minutos para cerrar.`;
    // Notificación del sistema: avisa aunque la pestaña esté en segundo plano
    this.sendSystemNotification('⏱️ Sprint de enfoque completado', { body: msg, tag: 'nexus-sprint' }).catch(() => {});
    if (projectId) {
      this.showToast(msg, () => this.openCheckout(projectId), 'Cerrar sesión');
    } else {
      this.showToast(msg);
    }
  },

  // --- MINUTOS DE FOCO ---
  accumulateFocusSegment() {
    if (this.timer.segmentStart) {
      this.timer.focusedMs = (this.timer.focusedMs || 0) + (Date.now() - this.timer.segmentStart);
      this.timer.segmentStart = null;
    }
  },

  getFocusProjectId() {
    return this.zenProjectId || this.selectedKanbanProjectId || null;
  },

  recordFocusSession(minutes) {
    if (!minutes || minutes < 1) return;
    if (!Array.isArray(this.state.focusSessions)) this.state.focusSessions = [];
    this.state.focusSessions.push({ projectId: this.getFocusProjectId(), minutes, at: new Date().toISOString() });
    // Basta con ~3 meses de historial para las métricas
    if (this.state.focusSessions.length > 500) this.state.focusSessions = this.state.focusSessions.slice(-500);
    this.saveState();
  },

  getFocusMinutes(days = 7) {
    const since = Date.now() - days * 86400000;
    return (this.state.focusSessions || [])
      .filter(s => new Date(s.at).getTime() >= since)
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
  },

  // --- PROYECTOS ESTANCADOS: proponer reactivar o pausar sin culpa ---
  getStalledProjects(minDays = 14) {
    return (this.state.projects || [])
      .filter(p => (p.status === 'activo' || p.status === 'en_ejecucion') && p.nextActionType !== 'esperar')
      .filter(p => this.daysSince(p.lastActivity) >= minDays)
      .filter(p => !(this.state.settings?.stalledDismissed || {})[p.id] || this.daysSince(this.state.settings.stalledDismissed[p.id]) >= 7)
      .sort((a, b) => this.daysSince(b.lastActivity) - this.daysSince(a.lastActivity));
  },

  dismissStalledProject(projectId) {
    if (!this.state.settings) this.state.settings = {};
    if (!this.state.settings.stalledDismissed) this.state.settings.stalledDismissed = {};
    this.state.settings.stalledDismissed[projectId] = new Date().toISOString();
    this.saveState();
    this.render();
  },

  renderStalledProjectsCard() {
    const stalled = this.getStalledProjects().slice(0, 2);
    if (!stalled.length) return '';
    const rows = stalled.map(p => `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl theme-card-subtle border theme-border">
        <div class="min-w-0">
          <p class="font-semibold text-sm truncate">${p.emoji || '🎯'} ${this.escapeHtml(p.name)}</p>
          <p class="text-[11px] theme-text-muted">${this.daysSince(p.lastActivity)} días sin moverse. Pausarlo también es avanzar: libera espacio mental.</p>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button type="button" onclick="app.reactivateProjectWithGemini('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition">Retomar</button>
          <button type="button" onclick="app.hibernateProjectWithoutGuilt('${p.id}')" class="px-2.5 py-1.5 rounded-lg theme-card-subtle border theme-border text-xs font-semibold">Pausar sin culpa</button>
          <button type="button" onclick="app.dismissStalledProject('${p.id}')" class="px-2 py-1.5 rounded-lg theme-text-muted hover:text-white text-xs" aria-label="Recordármelo en una semana" title="Recordármelo en una semana">✕</button>
        </div>
      </div>`).join('');
    return `
      <div class="mb-5 p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-2">
        <p class="text-xs font-mono font-bold uppercase tracking-wider text-purple-300">🧊 Proyectos quietos</p>
        ${rows}
      </div>`;
  },

  // ==========================================
  // DOPAMINE REWARD ENGINE (CONFETTI + CHIME + HAPTIC)
  // ==========================================
  triggerDopamineReward() {
    if (this.state.settings?.vibration && 'vibrate' in navigator) {
      try {
        navigator.vibrate([20, 40, 30]);
      } catch (e) {}
    }

    if (this.state.settings?.sound) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') { ctx.resume(); }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } catch (e) {}
    }

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 45 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 12,
      size: Math.random() * 6 + 4,
      color: ['#10b981', '#38bdf8', '#fbbf24', '#f43f5e', '#a78bfa'][Math.floor(Math.random() * 5)],
      life: 1
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life -= 0.02;
        if (p.life > 0) {
          alive = true;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (alive) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(animate);
  },
});
