'use strict';
// Modos de foco: Despegue (restaurar contexto) y Modo Una Sola Cosa.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // CHECKPOINT COGNITIVO: EL DESPEGUE (CONTEXT RESTORATION)
  // ==========================================
  openDespegue(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    this.selectedKanbanProjectId = p.id;

    const emojiEl = document.getElementById('despegue-project-emoji');
    const nameEl = document.getElementById('despegue-project-name');
    const objEl = document.getElementById('despegue-project-obj');
    const lastAchEl = document.getElementById('despegue-last-achievement');
    const nextStepEl = document.getElementById('despegue-next-step');

    if (emojiEl) emojiEl.textContent = p.emoji || '⚡';
    if (nameEl) nameEl.textContent = p.name;
    if (objEl) objEl.textContent = p.objective || 'Sin objetivo registrado.';

    const latestLog = (p.logs && p.logs.length > 0) ? p.logs[0] : null;
    if (lastAchEl) {
      lastAchEl.textContent = latestLog ? latestLog.achievement : 'Comenzando una nueva fase de avance tangible sin sobrecarga mental.';
    }

    if (nextStepEl) {
      nextStepEl.textContent = p.nextAction || 'Abrir el tablero y elegir una sola micro-tarea de 5 minutos.';
    }

    const overlay = document.getElementById('despegue-overlay');
    if (overlay) overlay.classList.remove('hidden');
  },

  closeDespegue() {
    const overlay = document.getElementById('despegue-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  acceptDespegueAndStart() {
    const p = this.state.projects.find(x => x.id === this.selectedKanbanProjectId);
    this.closeDespegue();
    if (p) {
      this.openZenMode(p, p.nextAction);
    }
  },

  acceptDespegueShowKanban() {
    this.closeDespegue();
    this.navigate('kanban');
  },

  skipDespegueWithoutGuilt() {
    this.closeDespegue();
    if (this.selectedKanbanProjectId) {
      this.skipProjectWithoutGuilt(this.selectedKanbanProjectId);
    }
  },

  // ==========================================
  // MODO ONE THING (FILTRO DE RUIDO TDAH TOTAL)
  // ==========================================
  openOneThingMode(projectId = null, taskId = null) {
    let p = projectId ? this.state.projects.find(x => x.id === projectId) : this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0];
    if (!p) return;

    let task = null;
    if (taskId && p.tasks) {
      task = p.tasks.find(x => x.id === taskId);
    }
    if (!task && p.tasks) {
      task = p.tasks.find(x => x.column === 'enfoco') || p.tasks.find(x => x.column === 'proximo') || p.tasks[0];
    }

    if (!task) {
      task = { id: this.uid(), title: p.nextAction || 'Micro-paso del proyecto', column: 'enfoco', isKickstart: true };
    }

    this.currentOneThingTask = { projectId: p.id, taskId: task.id, title: task.title, isKickstart: !!task.isKickstart };

    const overlay = document.getElementById('onething-overlay');
    const projectTag = document.getElementById('onething-project-tag');
    const taskTitle = document.getElementById('onething-task-title');
    const taskDesc = document.getElementById('onething-task-desc');
    const kickBadge = document.getElementById('onething-kickstart-badge');
    const progBar = document.getElementById('onething-progress-bar');

    if (projectTag) projectTag.textContent = `${p.emoji || '🎯'} ${p.name}`;
    if (taskTitle) taskTitle.textContent = task.title;
    if (taskDesc) {
      taskDesc.textContent = task.notes || (task.isKickstart ? '🚀 Kickstart Action: Micro-paso trivial diseñado para vencer la resistencia inicial en menos de 10 min.' : 'Mantén tu foco visual exclusivo en esta tarjeta para evitar sobrecarga.');
    }

    if (kickBadge) {
      if (task.isKickstart) kickBadge.classList.remove('hidden');
      else kickBadge.classList.add('hidden');
    }

    // Progreso visual fluido
    const tasks = p.tasks || [];
    const doneTasks = tasks.filter(t => t.column === 'victorias').length;
    const totalTasks = Math.max(1, tasks.length);
    const progressPct = Math.round((doneTasks / totalTasks) * 100);
    if (progBar) progBar.style.width = `${Math.max(15, progressPct)}%`;

    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('active');
    }
  },

  closeOneThingMode() {
    const overlay = document.getElementById('onething-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
    }
    this.currentOneThingTask = null;
  },

  completeOneThing() {
    const cur = this.currentOneThingTask;
    if (cur) {
      const p = this.state.projects.find(x => x.id === cur.projectId);
      const t = (p?.tasks || []).find(x => x.id === cur.taskId);

      // Audio chime suave y armónico con Web Audio API
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') { ctx.resume(); }
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.06, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } catch(e){}

      // Retroalimentación háptica
      if (navigator.vibrate) {
        try { navigator.vibrate([120, 50, 160]); } catch(e){}
      }

      if (t?.isBureaucratic) {
        this.completeBureaucraticTask(cur.projectId, cur.taskId);
      } else {
        this.moveTaskToColumn(cur.projectId, cur.taskId, 'victorias');
        this.triggerDopamineReward();
      }

      // Animar barra al 100% momentáneamente
      const progBar = document.getElementById('onething-progress-bar');
      if (progBar) progBar.style.width = '100%';
    }

    setTimeout(() => {
      this.closeOneThingMode();
      this.render();
    }, 500);
  },

  postponeOneThing() {
    const cur = this.currentOneThingTask;
    this.closeOneThingMode();
    if (cur) {
      this.openCheckout(cur.projectId);
    }
  },

  freezeOneThing() {
    const cur = this.currentOneThingTask;
    if (cur) {
      this.moveTaskToColumn(cur.projectId, cur.taskId, 'congelador');
    }
    this.closeOneThingMode();
    this.showNotification('❄️ Tarea enviada al congelador para no saturar tu memoria de trabajo.', 'info');
  },

  triggerAIDeconstructFromOneThing() {
    const cur = this.currentOneThingTask;
    if (!cur) return;
    this.closeOneThingMode();
    this.openDeconstructModal(cur.projectId, cur.title);
  },

  breakdownTaskWithAI(taskTitle, projectId) {
    const title = taskTitle ? decodeURIComponent(taskTitle) : '';
    this.openDeconstructModal(projectId, title);
  },
});
