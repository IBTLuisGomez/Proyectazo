'use strict';
// Vista "Más": hub de herramientas.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA 4: ⋯ MÁS (HUB DE HERRAMIENTAS TDAH)
  // Proyectos, lienzo, bitácora, radar y ajustes
  // ==========================================
  renderViewMas(container) {
    const projects = (this.state.projects || []).filter(p => !p.inBaul);
    const liveProjects = projects.filter(p => p.status === 'en_ejecucion' || p.status === 'activo').length;
    const totalVictories = projects.reduce((acc, p) => acc + (p.tasks || []).filter(t => t.column === 'victorias').length, 0);

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 py-2">

        <div class="mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">Centro de Recursos</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            ⋯ Más Herramientas
          </h1>
          <p class="text-xs text-slate-400 mt-1">
            Acceso organizado a tus proyectos, bitácora histórica, lienzo libre, radar y ajustes del sistema.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

          <!-- 1. Proyectos & Portfolio -->
          <div onclick="app.navigate('hoy')" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              💼
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-base text-white">Proyectos & Metas</h3>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">${liveProjects} activos</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Proyectos en ejecución (máx 3), radar de proyectos activos y checkout diario.</p>
            </div>
          </div>

          <!-- 2. Lienzo Freeform -->
          <div onclick="app.navigate('freeform')" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              🎨
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-bold text-base text-white">Lienzo Freeform</h3>
              <p class="text-xs text-slate-400 mt-1">Bocetos visuales, notas manuscritas, mapas mentales y diagramas sin límites.</p>
            </div>
          </div>

          <!-- 3. Bitácora & Log -->
          <div onclick="app.navigate('bitacora')" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              📜
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-base text-white">Bitácora & Historial</h3>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">${totalVictories} victorias</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Historial cronológico de avances, victorias dopamínicas y notas de continuidad.</p>
            </div>
          </div>

          <!-- 4. Radar de Prioridades -->
          <div onclick="app.navigate('radar')" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              📡
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-bold text-base text-white">Radar de Enfoque</h3>
              <p class="text-xs text-slate-400 mt-1">Matriz de prioridades y niveles de energía para ordenar el trabajo sin abrumarse.</p>
            </div>
          </div>

          <!-- 5. Baúl Confidencial (Acceso con Código PIN) -->
          <div onclick="app.openBaul()" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              🔒
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-base text-white flex items-center gap-1.5">
                  <span>Baúl Confidencial</span>
                </h3>
              </div>
              <p class="text-xs text-slate-400 mt-1">Sección privada y protegida para notas, pensamientos y proyectos confidenciales.</p>
            </div>
          </div>

          <!-- 6. Ajustes del Sistema & Nube -->
          <div onclick="app.openSettings()" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              ⚙️
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-bold text-base text-white">Ajustes & Sincronización</h3>
              <p class="text-xs text-slate-400 mt-1">Configuración de servidor Spring Boot, copias de seguridad JSON, temas y notificaciones.</p>
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

          <!-- 7. Nexus IA & Asistente Gemini 1.5 -->
          <div onclick="app.openNexusVoice('streaming')" class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-purple-500/30 hover:border-purple-500/60 text-left transition cursor-pointer flex items-start gap-4 group">
            <div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
              🤖
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-base text-white">Nexus IA (Gemini 1.5)</h3>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Activo</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Voz streaming, transcripción semántica, autoclasificación y desglose en micro-pasos de 15 min.</p>
            </div>
          </div>

        </div>

      </div>
    `;
  },
});
