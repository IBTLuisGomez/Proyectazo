'use strict';
// Fechas de tareas y pensamientos: "Para hoy" en la vista Hoy, sin culpa por lo que quedó de antes.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({
  // <input type="datetime-local"> ⇄ ISO
  dueFromInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  },

  dueToInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  },

  isDueTodayOrBefore(iso) {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t <= this.endOfToday();
  },

  formatDue(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 864e5);
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (diff === 0) return `hoy ${time}`;
    if (diff === 1) return `mañana ${time}`;
    if (diff === -1) return `ayer`;
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  },

  // Lo que tiene fecha hasta hoy: tareas sin terminar y pensamientos sin resolver
  dueItems() {
    const limit = this.endOfToday();
    const items = [];
    for (const p of (this.state.projects || [])) {
      if (p.inBaul) continue;
      for (const t of (p.tasks || [])) {
        if (!t.dueAt || t.column === 'victorias') continue;
        const at = new Date(t.dueAt).getTime();
        if (at <= limit) items.push({ kind: 'task', id: t.id, projectId: p.id, title: t.title, at, where: `${p.emoji || '🎯'} ${p.name}` });
      }
    }
    for (const n of (this.state.pensadero || [])) {
      if (!n.dueAt || n.isResolved) continue;
      const at = new Date(n.dueAt).getTime();
      if (at <= limit) items.push({ kind: 'thought', id: n.id, title: n.content, at, where: '💭 Pensadero' });
    }
    return items.sort((a, b) => a.at - b.at);
  },

  renderDueTodayCard() {
    const items = this.dueItems();
    if (!items.length) return '';
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const row = it => `
      <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl theme-card-subtle border theme-border">
        <div class="min-w-0">
          <p class="font-semibold text-sm truncate">${this.escapeHtml(it.title)}</p>
          <p class="text-xs theme-text-muted">${this.escapeHtml(it.where)} · ${this.formatDue(new Date(it.at).toISOString())}</p>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button type="button" onclick="app.completeDueItem('${it.kind}', '${it.id}', '${it.projectId || ''}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">✓ Hecho</button>
          <button type="button" onclick="app.snoozeDueItem('${it.kind}', '${it.id}', '${it.projectId || ''}')" class="px-2.5 py-1.5 rounded-lg theme-card border theme-border text-xs font-semibold" title="Moverlo a mañana a las 9:00">Mañana</button>
        </div>
      </div>`;
    const today = items.filter(i => i.at >= startToday.getTime());
    const before = items.filter(i => i.at < startToday.getTime());
    const shown = 5;
    return `
      <div class="mb-5 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2">
        <p class="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">📅 Para hoy</p>
        ${today.slice(0, shown).map(row).join('')}
        ${before.length ? `
          <p class="text-xs theme-text-muted pt-1">Quedó de antes (sin culpa: elige hacerlo o pasarlo a mañana)</p>
          ${before.slice(0, Math.max(0, shown - today.length) || 2).map(row).join('')}
        ` : ''}
        ${items.length > shown ? `<p class="text-xs theme-text-muted">y ${items.length - shown} más en Repasar → Tareas</p>` : ''}
      </div>`;
  },

  findDueTarget(kind, id, projectId) {
    if (kind === 'task') {
      const p = (this.state.projects || []).find(x => x.id === projectId);
      return p && (p.tasks || []).find(t => t.id === id);
    }
    return (this.state.pensadero || []).find(n => n.id === id);
  },

  completeDueItem(kind, id, projectId) {
    const target = this.findDueTarget(kind, id, projectId);
    if (!target) return;
    if (kind === 'task') {
      this.completeSprintAndRegisterVictory(projectId, id, target.title);
      return;
    }
    target.isResolved = true;
    target.updatedAt = new Date().toISOString();
    this.saveState();
    this.render();
    this.triggerDopamineReward();
    this.showToast('✓ Hecho. Uno menos en la cabeza.');
  },

  // "Mañana" a las 9:00: reprogramar sin culpa en un toque
  snoozeDueItem(kind, id, projectId) {
    const target = this.findDueTarget(kind, id, projectId);
    if (!target) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    target.dueAt = d.toISOString();
    target.updatedAt = new Date().toISOString();
    if (kind === 'task') {
      const p = (this.state.projects || []).find(x => x.id === projectId);
      if (p) p.updatedAt = target.updatedAt;
    }
    this.saveState();
    this.render();
    if (this.backendAvailable) this.scheduleBackgroundPush(id, target.title || target.content, target.dueAt).catch(() => {});
    this.showToast('🌅 Para mañana a las 9:00.');
  }
});
