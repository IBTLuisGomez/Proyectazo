'use strict';
// Sección "Repasar": fichas que agrupan las vistas de consulta (tareas, proyectos, ideas,
// historial, radar, baúl y ajustes). Cada ficha reutiliza su renderView* existente.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  repasarTabs() {
    return [
      { view: 'hacer', icon: '⚡', label: 'Tareas' },
      { view: 'notas', icon: '📝', label: 'Listas' },
      { view: 'hoy', icon: '💼', label: 'Proyectos' },
      { view: 'freeform', icon: '🎨', label: 'Ideas' },
      { view: 'bitacora', icon: '📜', label: 'Historial' },
      { view: 'radar', icon: '📡', label: 'Radar' },
      { view: 'baul', icon: '🔒', label: 'Baúl' },
      { view: 'mas', icon: '⚙️', label: 'Ajustes' }
    ];
  },

  // Pinta la barra de fichas y devuelve el panel donde debe dibujarse la vista activa.
  renderRepasarShell(container, activeView) {
    const tabs = this.repasarTabs().map(t => {
      const active = t.view === activeView;
      // El Baúl pasa siempre por el PIN
      const act = t.view === 'baul' ? accion('openBaul') : accion('navigate', t.view);
      return html`<button type="button" data-on-click="${act}" role="tab" aria-selected="${String(active)}" aria-controls="repasar-panel"
        class="shrink-0 min-h-[44px] px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition ${
          active ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200' : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
        }"><span aria-hidden="true">${t.icon}</span>${t.label}</button>`;
    });

    container.innerHTML = html`
      <div class="space-y-4">
        <div role="tablist" aria-label="Repasar" class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">${tabs}</div>
        <div id="repasar-panel" role="tabpanel" class="min-w-0"></div>
      </div>`;
    return document.getElementById('repasar-panel');
  },
});
