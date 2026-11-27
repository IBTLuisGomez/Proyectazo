'use strict';
// Ficha "Ajustes" de Repasar (antes "Más"): ajustes, instalación y Nexus.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA 4: ⋯ MÁS (HUB DE HERRAMIENTAS TDAH)
  // Ajustes, instalación y Nexus
  // ==========================================
  renderViewMas(container) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 py-2">

        <div class="mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">Repasar</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            ⚙️ Ajustes
          </h1>
          <p class="text-xs text-slate-400 mt-1">
            Configuración, instalación y asistente Nexus.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

          <!-- 6. Ajustes del Sistema & Nube -->
          <div onclick="app.openSettings()" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              ⚙️
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-bold text-base text-white">Ajustes & Sincronización</h3>
              <p class="text-xs text-slate-400 mt-1">Servidor, copias de seguridad, tema, notificaciones e IA.</p>
            </div>
          </div>

          <!-- 6. Versión de Escritorio -->
          <div onclick="app.triggerDesktopInstall()" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              💻
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-bold text-base text-white">Instalar en Escritorio</h3>
              <p class="text-xs text-slate-400 mt-1">Instalar FocusFlow OS como app independiente en Windows sin barras de navegador.</p>
            </div>
          </div>

          <!-- 7. Nexus IA -->
          <div onclick="app.openJarvis()" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-purple-500/30 hover:border-purple-500/60 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              🤖
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-base text-white">Nexus IA</h3>
                
              </div>
              <p class="text-xs text-slate-400 mt-1">Jarvis: habla o escribe y él apunta, avisa y te ayuda a empezar.</p>
            </div>
          </div>

        </div>

        ${this.renderModulosAjustes()}

      </div>
    `;
  },
});
