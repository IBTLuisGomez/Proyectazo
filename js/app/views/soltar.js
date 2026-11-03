'use strict';
// Vista "Soltar" (orbe y Pensadero): captura, gestos, colores, auto-clasificación y enrutado a proyectos.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA 2: 💡 SOLTAR (VACIADO MENTAL & ORBE TDAH)
  // Un solo campo y el orbe. Guardar sale sin elegir color.
  // ==========================================
  renderViewSoltar(container) {
    const items = (this.state.pensadero || []).filter(x => !x.inBaul);
    const generalCount = items.filter(x => x.category === 'humo_general' || !x.category).length;
    const whiteCount = items.filter(x => x.category === 'humo_blanco').length;
    const redCount = items.filter(x => x.category === 'humo_rojo' && !x.isResolved).length;
    const goldCount = items.filter(x => x.category === 'humo_dorado').length;
    const blueCount = items.filter(x => x.category === 'humo_azul' || x.category === 'humo_tarea').length;
    const greenCount = items.filter(x => x.category === 'humo_verde').length;
    const purpleCount = items.filter(x => x.category === 'humo_purpura').length;
    const orangeCount = items.filter(x => x.category === 'humo_naranja').length;
    const ashCount = items.filter(x => x.category === 'humo_ceniza').length;

    const activeFilter = this.pensaderoSmokeFilter || 'all';
    const nowMs = Date.now();
    const filteredItems = items.filter(it => {
      if (activeFilter === 'all') {
        if (it.category === 'humo_ceniza' && it.hibernatedUntil && it.hibernatedUntil > nowMs) {
          return false; // sombreado/hibernado para no saturar memoria de trabajo
        }
        return true;
      }
      if (activeFilter === 'humo_general') return it.category === 'humo_general' || !it.category;
      if (activeFilter === 'humo_blanco') return it.category === 'humo_blanco';
      if (activeFilter === 'humo_rojo') return it.category === 'humo_rojo';
      if (activeFilter === 'humo_dorado') return it.category === 'humo_dorado';
      if (activeFilter === 'humo_azul') return it.category === 'humo_azul' || it.category === 'humo_tarea';
      if (activeFilter === 'humo_verde') return it.category === 'humo_verde';
      if (activeFilter === 'humo_purpura') return it.category === 'humo_purpura';
      if (activeFilter === 'humo_naranja') return it.category === 'humo_naranja';
      if (activeFilter === 'humo_ceniza') return it.category === 'humo_ceniza';
      return true;
    });

    const activeMeta = SMOKE_PALETTE[activeFilter] || SMOKE_PALETTE.humo_general;

    container.innerHTML = `
      <div class="flex flex-col flex-1 h-full w-full max-w-7xl mx-auto space-y-3.5">

        <!-- BARRA SUPERIOR DE SOLTAR -->
        <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur shadow-sm">
          <div class="flex items-center gap-2">
            <span class="text-base">💡</span>
            <span class="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
              Soltar · Vaciado Mental
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              ${items.length} pensamientos
            </span>
          </div>

          <!-- Atajos -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <button onclick="app.openNexusVoice('pensadero')" class="px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold transition flex items-center gap-1.5" title="Asistente de Voz Nexus Gemini">
              <span class="animate-pulse">🎙️</span> <span>Nexus IA</span>
            </button>
            <button onclick="app.openOrbeQuickGadget()" class="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold transition flex items-center gap-1" title="Abrir Gadget Hold-to-Talk de vaciado">
              <span>🔮</span> <span>Gadget</span>
            </button>
            <button onclick="app.triggerShockwave()" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition" title="Pulso de dispersión">
              🌊 Pulso
            </button>
            <button onclick="app.toggleBrownNoise()" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition" title="Ruido Marrón anti-distracción">
              🎧 Ruido
            </button>
            <button onclick="app.clearPensaderoPrompts()" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-400 hover:text-white border border-slate-700 transition">
              🧹 Limpiar
            </button>
          </div>
        </div>

        <!-- CUENCA CENTRAL DEL ORBE -->
        <div class="pensadero-basin relative flex-1 min-h-[calc(100dvh-7rem)] md:min-h-[580px] lg:min-h-[660px] rounded-3xl border border-slate-800 bg-[#070A10] text-center overflow-hidden shadow-2xl flex flex-col justify-between p-3 sm:p-5">

          <!-- NÚCLEO CENTRAL: ESFERA 3D PROCEDIMENTAL -->
          <div class="relative my-auto py-2 flex flex-col items-center justify-center flex-1">
            <div class="relative w-[68vw] h-[68vw] max-w-[340px] max-h-[340px] sm:w-[320px] sm:h-[320px] lg:w-[400px] lg:h-[400px] mx-auto flex items-center justify-center shrink-0">
              <div id="nexus-orb-glow" class="absolute inset-4 rounded-full blur-3xl opacity-60 transition-all duration-700 pointer-events-none" style="background: radial-gradient(circle, ${activeMeta.hex} 0%, transparent 70%);"></div>

              <div class="relative w-full h-full rounded-full p-2 bg-slate-900/60 border border-slate-800 shadow-2xl flex items-center justify-center pointer-events-none">
                <div class="relative w-full h-full rounded-full p-1 bg-slate-950/90 flex items-center justify-center overflow-hidden">
                  <div id="nexus-core-wrapper" class="relative z-10 w-full h-full flex items-center justify-center select-none cursor-pointer rounded-full overflow-hidden pointer-events-auto" onclick="app.handleOrbClick(event)" title="Haz clic para generar un pulso o soltar tu pensamiento. Mantén presionado para hablar.">
                    <canvas id="pensadero-glsl-canvas" class="w-full h-full block rounded-full select-none"></canvas>
                  </div>
                </div>
              </div>
            </div>

            <!-- SELECTOR TÁCTIL DE COLOR DE ORBE Y CATEGORÍA COGNITIVA -->
            <div class="mt-3 flex flex-col items-center gap-2 z-20 w-full max-w-xl mx-auto px-2">
              <div class="flex items-center justify-center gap-2">
                <button type="button" onclick="app.cycleOrbColor(-1)" class="w-7 h-7 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition active:scale-95 shadow" title="Color anterior (o desliza hacia la derecha)">‹</button>
                <div id="orbe-status-label" class="text-xs font-mono font-bold tracking-wide text-white bg-slate-950/90 px-3.5 py-1.5 rounded-full border border-slate-700 shadow flex items-center gap-2">
                  <span id="orbe-color-indicator" class="w-2.5 h-2.5 rounded-full inline-block" style="background: ${activeMeta.hex}; box-shadow: 0 0 10px ${activeMeta.hex};"></span>
                  <span>${activeMeta.icon} ${activeMeta.name}: ${activeMeta.title}</span>
                </div>
                <button type="button" onclick="app.cycleOrbColor(1)" class="w-7 h-7 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition active:scale-95 shadow" title="Siguiente color (o desliza hacia la izquierda)">›</button>
              </div>

              <!-- Botones de Selección Directa de los 9 Colores del Orbe -->
              <div class="flex items-center justify-center gap-1.5 flex-wrap py-1">
                ${Object.entries(SMOKE_PALETTE).map(([key, meta]) => {
                  const isSel = (activeFilter === key) || (activeFilter === 'all' && key === 'humo_general');
                  return `
                    <button type="button" 
                            onclick="app.setOrbeColor('${key}')" 
                            data-smoke="${key}"
                            class="smoke-reactor-btn px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 active:scale-95 border ${isSel ? 'ring-2 ring-white scale-105 font-bold shadow-lg' : 'opacity-75 hover:opacity-100'}"
                            style="background: ${meta.hex}22; border-color: ${meta.hex}66; color: ${meta.hex};"
                            title="${meta.title}: ${meta.desc}">
                      <span>${meta.icon}</span>
                      <span class="hidden sm:inline">${meta.name}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- CAPTURA ÚNICA: UN SOLO CAMPO Y EL ORBE (SIN ELEGIR COLOR ANTES) -->
          <div class="relative z-20 w-full max-w-xl mx-auto my-2 p-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl flex items-center gap-2">
            <input type="text" id="soltar-input" placeholder="Escribe lo que tienes en la cabeza..." 
              onkeydown="if(event.key==='Enter'){event.preventDefault();app.quickSoltar();}"
              class="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none" />
            <button type="button" onclick="app.dictateField('soltar-input')" class="p-2 text-slate-400 hover:text-cyan-400 transition" title="Dictar por voz">
              🎙️
            </button>
            <button type="button" onclick="app.quickSoltar()" class="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md active:scale-95 transition">
              Soltar
            </button>
          </div>

        </div>

        <!-- FILTRO DE HUMOS & LISTA DE PENSAMIENTOS ABAJO -->
        <div class="flex flex-col space-y-3 pt-2" id="pensadero-deck">
          ${this.renderQuickReviewPrompt()}
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
              <button onclick="app.filterPensaderoSmoke('all')" class="px-3 py-1 rounded-xl font-semibold transition ${activeFilter === 'all' ? 'bg-slate-700 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'}">
                Todos (${items.length})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_general')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_general' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-cyan-300'}">
                ✨ Sin clasificar (${generalCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_rojo')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_rojo' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-rose-300'}">
                🔴 Urgente (${redCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_dorado')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_dorado' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-yellow-300'}">
                🟡 Idea (${goldCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_azul')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_azul' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-blue-300'}">
                🔵 Foco y ☑️ tareas (${blueCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_verde')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_verde' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-emerald-300'}">
                🟢 Hábitos (${greenCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_purpura')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_purpura' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-purple-300'}">
                🟣 Personas (${purpleCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_naranja')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_naranja' ? 'bg-amber-700/20 text-amber-300 border border-amber-700/50' : 'bg-slate-900/60 text-slate-400 hover:text-amber-300'}">
                🟠 Dinero (${orangeCount})
              </button>
              <button onclick="app.filterPensaderoSmoke('humo_ceniza')" class="px-2.5 py-1 rounded-xl font-semibold transition ${activeFilter === 'humo_ceniza' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/50' : 'bg-slate-900/60 text-slate-400 hover:text-slate-300'}">
                🔘 Después (${ashCount})
              </button>
            </div>

            <span class="text-[11px] font-mono text-slate-500 hidden sm:inline">
              ${filteredItems.length} mostrados
            </span>
          </div>

          <!-- Contenedor scrollable de Tarjetas -->
          <div class="space-y-3 pb-8" id="pensadero-list">
            ${filteredItems.length === 0 ? `
              <div class="p-8 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
                <span class="text-3xl block mb-2">💡</span>
                <p class="font-semibold text-sm">Tu espacio de Soltar está despejado en este filtro.</p>
                <p class="text-xs mt-1 text-slate-500">Escribe en el campo arriba para soltar pensamientos de inmediato.</p>
              </div>
            ` : filteredItems.map((item, idx) => this.renderPensaderoCard(item, idx)).join('')}
          </div>
        </div>

      </div>
    `;

    setTimeout(() => {
      const inp = document.getElementById('soltar-input');
      if (inp && !('ontouchstart' in window)) inp.focus();
    }, 100);

    setTimeout(() => {
      const vid = document.getElementById('nexus-orb-video');
      if (vid) vid.play().catch(() => {});
      const cvs = document.getElementById('pensadero-glsl-canvas');
      if (cvs && this.shaderEngine) {
        this.shaderEngine.init(cvs);
        const activeSmoke = (activeFilter !== 'all') ? activeFilter : 'humo_general';
        this.shaderEngine.setSmokeState(activeSmoke);
        this.initOrbLongPress();
      }
    }, 60);
  },

  renderViewPensadero(container) {
    this.renderViewSoltar(container);
  },

  quickSoltar() {
    const inp = document.getElementById('soltar-input') || document.getElementById('pensadero-direct-dump-input');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';
    const selectedColor = (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all') ? this.pensaderoSmokeFilter : null;
    this.captureThought(text, { source: 'soltar', category: selectedColor });
    if (this.shaderEngine) this.shaderEngine.pulseShockwave();
    this.triggerDopamineReward();
    setTimeout(() => {
      const reInp = document.getElementById('soltar-input') || document.getElementById('pensadero-direct-dump-input');
      if (reInp) reInp.focus();
    }, 100);
  },

  handleOrbClick(e) {
    if (this._suppressOrbClick) {
      this._suppressOrbClick = false;
      return;
    }
    const inp = document.getElementById('soltar-input') || document.getElementById('pensadero-direct-dump-input');
    if (inp && inp.value.trim()) {
      this.quickSoltar();
      return;
    }
    this.triggerShockwave();
    this.triggerDopamineReward();
    const activeColor = (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all') ? this.pensaderoSmokeFilter : 'humo_general';
    const meta = SMOKE_PALETTE[activeColor] || SMOKE_PALETTE.humo_general;
    this.showToast(`${meta.icon} Pulso de dispersión: ${meta.name}`);
  },

  initOrbLongPress() {
    const wrapper = document.getElementById('nexus-core-wrapper');
    if (!wrapper || wrapper._gesturesAttached) return;
    wrapper._gesturesAttached = true;

    let pressTimer = null;
    let isHoldingVoice = false;
    let hasSwiped = false;
    let startX = 0, startY = 0;
    let activeTranscript = '';

    const speechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isHoldingVoice = false;
      hasSwiped = false;
      activeTranscript = '';
      this._suppressOrbClick = false;

      startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      startY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;

      wrapper.style.transform = 'scale(1.05)';
      wrapper.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      const glow = document.getElementById('nexus-orb-glow');
      if (glow) glow.style.opacity = '1';

      // Timer de activación de grabación por voz Nexus IA (320ms hold)
      pressTimer = setTimeout(() => {
        if (hasSwiped) return;
        isHoldingVoice = true;
        this._suppressOrbClick = true;

        // Feedback háptico
        if (navigator.vibrate) {
          try { navigator.vibrate(60); } catch(err){}
        }
        this.triggerShockwave();

        // Activar HUD de grabación en vivo sobre el orbe
        this.showOrbVoiceRecordingHUD(true);

        // Iniciar reconocimiento por voz en streaming
        if (speechRec) {
          try {
            this._orbHoldRecognition = new speechRec();
            this._orbHoldRecognition.lang = 'es-ES';
            this._orbHoldRecognition.continuous = true;
            this._orbHoldRecognition.interimResults = true;

            this._orbHoldRecognition.onresult = (evt) => {
              let str = '';
              for (let i = evt.resultIndex; i < evt.results.length; ++i) {
                str += evt.results[i][0].transcript;
              }
              if (str) {
                activeTranscript = str;
                const hudText = document.getElementById('orb-recording-transcript');
                if (hudText) hudText.textContent = str;
              }
            };

            this._orbHoldRecognition.onerror = (err) => {
              console.warn('Orb speech hold error:', err);
            };

            this._orbHoldRecognition.start();
          } catch(err) {
            console.warn('SpeechRec start failed:', err);
          }
        } else {
          const hudText = document.getElementById('orb-recording-transcript');
          if (hudText) hudText.textContent = 'Dictado no soportado en este navegador. Suelta para escribir tu pensamiento.';
        }
      }, 320);
    };

    const onMove = (e) => {
      const curX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      const curY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
      const dx = curX - startX;
      const dy = curY - startY;

      // Detección de DESLIZAMIENTO HORIZONTAL (SWIPE TOUCH) PARA CAMBIO DE COLOR
      if (!isHoldingVoice && Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        hasSwiped = true;
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        this._suppressOrbClick = true;
        startX = curX; // Evitar disparos múltiples en el mismo swipe
        if (dx > 0) {
          this.cycleOrbColor(-1); // Swipe derecha -> color anterior
        } else {
          this.cycleOrbColor(1);  // Swipe izquierda -> siguiente color
        }
      }
    };

    const onUp = (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      wrapper.style.transform = 'scale(1)';
      const glow = document.getElementById('nexus-orb-glow');
      if (glow) glow.style.opacity = '0.65';

      if (isHoldingVoice) {
        isHoldingVoice = false;
        this.showOrbVoiceRecordingHUD(false);

        if (this._orbHoldRecognition) {
          try { this._orbHoldRecognition.stop(); } catch(err){}
          this._orbHoldRecognition = null;
        }

        if (activeTranscript && activeTranscript.trim()) {
          // Procesar el pensamiento o comando hablado con Nexus IA
          this.processOrbVoiceInput(activeTranscript.trim());
        } else {
          // Si no se captó voz o no hay permisos de micro, abrir gadget rápido para escribir
          this.openOrbeQuickGadget();
        }

        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
    };

    wrapper.addEventListener('pointerdown', onDown);
    wrapper.addEventListener('pointermove', onMove);
    wrapper.addEventListener('pointerup', onUp);
    wrapper.addEventListener('pointercancel', onUp);
    wrapper.addEventListener('pointerleave', onUp);
  },

  // HUD de grabación sobre el orbe
  showOrbVoiceRecordingHUD(show) {
    let hud = document.getElementById('orb-voice-recording-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'orb-voice-recording-hud';
      hud.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-all duration-300 hidden';
      hud.innerHTML = `
        <div class="p-6 rounded-3xl bg-slate-900/95 border border-cyan-500/50 shadow-2xl max-w-sm w-full space-y-4">
          <div class="relative w-16 h-16 mx-auto rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-3xl animate-pulse">
            🎙️
          </div>
          <div>
            <h4 class="text-sm font-display font-bold text-white uppercase tracking-wider">Nexus IA Grabando</h4>
            <p class="text-xs text-cyan-300 mt-1 font-mono">Habla tu pensamiento o indicación...</p>
          </div>
          <div id="orb-recording-transcript" class="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 min-h-[50px] flex items-center justify-center italic">
            (Escuchando en tiempo real...)
          </div>
          <p class="text-[10px] text-slate-400 font-mono">Suelta el orbe cuando termines para depositar</p>
        </div>
      `;
      document.body.appendChild(hud);
    }

    if (show) {
      const transcriptEl = document.getElementById('orb-recording-transcript');
      if (transcriptEl) transcriptEl.textContent = '(Escuchando en tiempo real...)';
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }
  },

  // Procesar voz del orbe (indicación a proyecto o pensamiento libre)
  processOrbVoiceInput(text) {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // Feedback sonoro/háptico
    this.triggerDopamineReward();
    if (this.shaderEngine) {
      this.shaderEngine.pulseShockwave();
    }

    // Verificar si es comando directo a un proyecto existente (ej: "mandar a cytohelix...", "agregar a cytocore...")
    const currentCat = (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all') ? this.pensaderoSmokeFilter : null;
    this.captureThought(clean, { source: 'voz', category: currentCat, voiceRoute: true });
  },

  // Ciclar colores mediante deslizamiento (Swipe)
  cycleOrbColor(direction = 1) {
    const paletteKeys = Object.keys(SMOKE_PALETTE);
    const current = this.pensaderoSmokeFilter || 'humo_general';
    let idx = paletteKeys.indexOf(current);
    if (idx === -1) idx = 0;

    idx = (idx + direction + paletteKeys.length) % paletteKeys.length;
    const nextCategory = paletteKeys[idx];

    if (navigator.vibrate) {
      try { navigator.vibrate(25); } catch(e){}
    }

    this.setOrbeColor(nextCategory);
    if (this.shaderEngine) {
      this.shaderEngine.pulseShockwave();
    }
  },

  setOrbeColor(category) {
    const meta = SMOKE_PALETTE[category] || SMOKE_PALETTE.humo_general;
    this.pensaderoSmokeFilter = category;

    const indicator = document.getElementById('orbe-color-indicator');
    if (indicator) {
      indicator.style.background = meta.hex;
      indicator.style.boxShadow = `0 0 14px ${meta.hex}`;
    }
    const statusLabel = document.getElementById('orbe-status-label');
    if (statusLabel) {
      statusLabel.innerHTML = `<span id="orbe-color-indicator" class="w-2.5 h-2.5 rounded-full inline-block" style="background: ${meta.hex}; box-shadow: 0 0 10px ${meta.hex};"></span> <span>${meta.icon} ${meta.name}: ${meta.title}</span>`;
    }

    // Resplandor Neón de Fondo reactivo
    const orbGlow = document.getElementById('nexus-orb-glow');
    if (orbGlow) {
      orbGlow.style.background = `radial-gradient(circle, ${meta.hex} 0%, transparent 70%)`;
      orbGlow.style.opacity = '0.75';
    }
    const coreWrapper = document.getElementById('nexus-core-wrapper');
    if (coreWrapper) {
      coreWrapper.style.border = 'none';
      coreWrapper.style.boxShadow = 'none';
    }

    // Resaltar botón de reactor seleccionado
    document.querySelectorAll('.smoke-reactor-btn').forEach(btn => {
      if (btn.getAttribute('data-smoke') === category) {
        btn.classList.add('ring-2', 'ring-white', 'scale-105', 'font-bold', 'shadow-lg');
        btn.classList.remove('opacity-75');
      } else {
        btn.classList.remove('ring-2', 'ring-white', 'scale-105', 'font-bold', 'shadow-lg');
        btn.classList.add('opacity-75');
      }
    });

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState(category);
    }

    if (navigator.vibrate) {
      try { navigator.vibrate(20); } catch(e){}
    }
  },

  triggerShockwave() {
    if (this.shaderEngine) {
      this.shaderEngine.pulseShockwave();
    }
  },

  cycleShaderPalette() {
    if (this.shaderEngine) {
      this.shaderEngine.randomizeSmoke();
    }
  },

  filterPensaderoSmoke(smokeType) {
    this.pensaderoSmokeFilter = smokeType;
    if (this.shaderEngine && smokeType !== 'all') {
      this.shaderEngine.setSmokeState(smokeType);
    }
    this.render();
  },

  selectPensaderoCat(cat) {
    const input = document.getElementById('pensadero-cat-val');
    if (input) input.value = cat;
    document.querySelectorAll('.pcat-chip').forEach(btn => {
      if (btn.getAttribute('data-cat') === cat) {
        btn.className = 'pcat-chip px-2.5 py-1 rounded-xl border border-purple-500 bg-purple-500/20 text-purple-300 font-semibold shadow';
      } else {
        btn.className = 'pcat-chip px-2.5 py-1 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white font-semibold';
      }
    });
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState(cat);
    }
  },

  submitPensaderoJARVIS() {
    const input = document.getElementById('pensadero-jarvis-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; // Limpiar de inmediato para prevenir re-envíos por doble evento Enter/Touch
    const chosen = document.getElementById('pensadero-cat-val')?.value || null;
    this.captureThought(text, { source: 'jarvis', category: chosen });
    if (this.shaderEngine) this.shaderEngine.pulseShockwave();
  },

  // --- GRABACIÓN RÁPIDA EN EL GADGET AISLADO ---
  startGadgetHoldRecording() {
    const hint = document.getElementById('gadget-recording-hint');
    const icon = document.getElementById('gadget-orb-icon');
    const glow = document.getElementById('gadget-orb-glow');
    if (hint) hint.textContent = '🔴 Grabando... Suelta para depositar';
    if (icon) icon.textContent = '🔊';
    if (glow) glow.style.opacity = '1';

    if (navigator.vibrate) {
      try { navigator.vibrate(60); } catch(e){}
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._gadgetTranscript = '';
    if (SpeechRec) {
      try {
        this._gadgetRecognition = new SpeechRec();
        this._gadgetRecognition.lang = 'es-ES';
        this._gadgetRecognition.continuous = true;
        this._gadgetRecognition.interimResults = true;
        this._gadgetRecognition.onresult = (e) => {
          let t = '';
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            t += e.results[i][0].transcript;
          }
          if (t) {
            this._gadgetTranscript = t;
            const txt = document.getElementById('gadget-dump-text');
            if (txt) txt.value = t;
          }
        };
        this._gadgetRecognition.start();
      } catch(err) {
        console.warn('Gadget speech start failed:', err);
      }
    } else {
      if (hint) hint.textContent = 'Dictado no activo en Firefox. Escribe abajo:';
      const txt = document.getElementById('gadget-dump-text');
      if (txt) txt.focus();
    }
  },

  stopGadgetHoldRecording() {
    const hint = document.getElementById('gadget-recording-hint');
    const icon = document.getElementById('gadget-orb-icon');
    const glow = document.getElementById('gadget-orb-glow');
    if (hint) hint.textContent = 'Mantén presionado el Orbe para hablar';
    if (icon) icon.textContent = '🎙️';
    if (glow) glow.style.opacity = '0.7';

    if (this._gadgetRecognition) {
      try { this._gadgetRecognition.stop(); } catch(e){}
      this._gadgetRecognition = null;
    }

    const text = (this._gadgetTranscript && this._gadgetTranscript.trim()) || 
                 (document.getElementById('gadget-dump-text')?.value.trim()) || '';
    if (text) {
      const smoke = this.selectedGadgetSmoke || 'humo_general';
      this.captureThought(text, { source: 'gadget-voz', category: smoke });
      this.closeModal('nexus-orbe-quick-gadget-modal');
      const txt = document.getElementById('gadget-dump-text');
      if (txt) txt.value = '';
    }
  },

  // --- GADGET DE VACIADO RÁPIDO DIRECTO AL ORBE ---
  openOrbeQuickGadget() {
    const modal = document.getElementById('nexus-orbe-quick-gadget-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.selectedGadgetSmoke = 'humo_blanco';
    this.selectGadgetSmoke('humo_blanco');
    const input = document.getElementById('gadget-dump-text');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 60);
    }
  },

  selectGadgetSmoke(cat) {
    this.selectedGadgetSmoke = cat;
    document.querySelectorAll('.gadget-smoke-btn').forEach(btn => {
      if (btn.getAttribute('data-smoke') === cat) {
        btn.classList.add('ring-2', 'ring-cyan-400', 'bg-slate-800');
      } else {
        btn.classList.remove('ring-2', 'ring-cyan-400', 'bg-slate-800');
      }
    });
    this.setOrbeColor(cat);
  },

  submitGadgetDump() {
    const input = document.getElementById('gadget-dump-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const smoke = this.selectedGadgetSmoke || 'humo_blanco';
    this.captureThought(text, { source: 'gadget', category: smoke });
    this.closeModal('nexus-orbe-quick-gadget-modal');
    input.value = '';
  },

  // Almacenamiento de bajo nivel de un pensamiento ya interpretado. Usar captureThought().
  quickDumpToOrbe(text, customCategory = null, extra = {}) {
    if (!text || !text.trim()) return null;
    // Sin bloqueo temporal: impedía guardar varias ideas seguidas. Los dobles envíos
    // los filtra captureThought (mismo texto en 10 min) y el control de 3 s de abajo.
    const cleanText = text.trim();

    // Limpiar inputs embebidos inmediatamente
    const directInput = document.getElementById('pensadero-direct-dump-input');
    if (directInput) directInput.value = '';
    const jarvisInput = document.getElementById('pensadero-jarvis-input');
    if (jarvisInput && jarvisInput.value.trim() === cleanText) jarvisInput.value = '';

    // Sin heredar el color del gadget: antes, tras usarlo, todo caía en "Soltar"
    let cat = customCategory || 'humo_general';

    // Prevención de duplicados en ventana corta (3 seg)
    const isDuplicate = (this.state.pensadero || []).some(p => 
      (p.content || '').trim().toLowerCase() === cleanText.toLowerCase() && 
      p.category === cat && 
      (Date.now() - new Date(p.createdAt).getTime() < 3000)
    );
    if (isDuplicate) return;

    const meta = SMOKE_PALETTE[cat] || SMOKE_PALETTE.humo_general;
    const newItem = {
      id: this.uid(),
      content: cleanText,
      category: cat,
      cognitiveWeight: meta.cognitiveWeight || 'libre',
      module: meta.module || 'El Pensadero',
      // Importe y persona salen del texto; antes se inventaban (50 y "Contacto")
      amount: extra.amount ?? null,
      contactName: extra.contactName ?? null,
      dueAt: extra.dueAt || null,
      source: extra.source || null,
      hibernatedUntil: (cat === 'humo_ceniza') ? Date.now() + 14 * 86400000 : null,
      isPinned: false,
      isResolved: false,
      createdAt: new Date().toISOString()
    };

    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.cleanDuplicateThoughts();
    this.saveState();

    // Feedback visual inmediato en el Shader 3D (humo + pulso)
    this.setOrbeColor(cat);
    this.triggerShockwave();

    // Feedback háptico
    if (navigator.vibrate) {
      try { navigator.vibrate([40, 30, 40]); } catch(e){}
    }

    // Asegurar que el filtro no oculte el pensamiento recién creado
    if (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all' && this.pensaderoSmokeFilter !== cat) {
      this.pensaderoSmokeFilter = 'all';
    }

    // Si estamos en la vista Pensadero, actualizar solo tarjetas sin destruir el canvas WebGL
    if (this.currentView === 'pensadero') {
      this.renderPensaderoItemsOnly();
      const list = document.getElementById('pensadero-list');
      if (list && list.firstElementChild) {
        const firstCard = list.firstElementChild;
        firstCard.classList.add('ring-2', 'ring-cyan-400', 'shadow-lg');
        setTimeout(() => {
          firstCard.classList.remove('ring-2', 'ring-cyan-400', 'shadow-lg');
        }, 1200);
        firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Notificaciones en PC y Celular (Pensamientos Rojos / Sin clasificar)
    if (cat === 'humo_rojo') {
      this.sendSystemNotification('🚨 Urgencia Crítica / Fuego Activo', {
        body: `Atención inmediata: "${cleanText.slice(0, 50)}"`,
        tag: 'humo-rojo-' + newItem.id,
        requireInteraction: true
      });
    } else if (cat === 'humo_general' || !cat) {
      this.sendSystemNotification('✨ Pensamiento sin clasificar depositado', {
        body: `Nuevo pensamiento en el Pensadero: "${cleanText.slice(0, 50)}"`,
        tag: 'humo-general-' + newItem.id
      });
    }

    // Sincronizar en backend si está disponible
    const created = this.backendAvailable
      ? fetch(`${this.API_BASE}/pensadero`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          id: newItem.id, content: cleanText, category: cat,
          amount: newItem.amount != null ? String(newItem.amount) : null,
          contactName: newItem.contactName
        })
        }).then(async r => {
          if (r.ok) {
            const saved = await r.json();
            if (saved && saved.id && saved.id !== newItem.id) {
              newItem.id = saved.id;
              this.saveState();
            }
          }
        }).catch(() => {})
      : Promise.resolve();

    return { item: newItem, created };
  },


  // --- ENRUTADO A PROYECTOS POR PALABRAS CLAVE ---
  getProjectKeywords(project) {
    const extra = String(project.keywords || '').split(',');
    return [project.name, ...extra]
      .map(k => (k || '').toLowerCase().trim())
      .filter(k => k.length >= 3);
  },

  // Devuelve el proyecto cuyo nombre o palabra clave aparece en el texto (gana la coincidencia más larga)
  findProjectForText(text) {
    const match = this.findProjectMatch(text);
    return match ? match.project : null;
  },

  // { project, keyword, byName } · byNameOnly: solo cuenta el nombre del proyecto, no sus palabras clave
  findProjectMatch(text, { byNameOnly = false } = {}) {
    const lower = (text || '').toLowerCase();
    let best = null;
    for (const p of (this.state.projects || [])) {
      if (p.inBaul) continue;
      const name = (p.name || '').toLowerCase().trim();
      const candidates = byNameOnly ? [name] : this.getProjectKeywords(p);
      for (const kw of candidates) {
        if (kw.length >= 3 && (!best || kw.length > best.keyword.length) && lower.includes(kw)) {
          best = { project: p, keyword: kw, byName: kw === name };
        }
      }
    }
    return best;
  },

  // Antes estas reglas estaban fijas en el código. Se copian una vez a los proyectos
  // con esos nombres para conservar el comportamiento, y desde entonces se editan en el formulario.
  migrateLegacyRoutingKeywords() {
    const legacy = {
      cytohelix: 'landing, software, web corporativa, frontend, portafolio',
      cytocore: 'célula, celula, mesenquimal, cultivo, dosis, laboratorio, paciente',
      focusflow: 'kanban, ruido marrón, ruido marron, orbe, tdah, spring boot, focus'
    };
    let changed = false;
    for (const p of (this.state.projects || [])) {
      if (p.keywords !== undefined && p.keywords !== null) continue;
      const name = (p.name || '').toLowerCase();
      const key = Object.keys(legacy).find(k => name.includes(k));
      p.keywords = key ? legacy[key] : '';
      changed = true;
    }
    if (changed) this.saveState();
  },

  // --- AUTOCLASIFICACIÓN CON NEXUS IA (POR CÓDIGO & GEMINI) ---
  autoClassifyThought(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const text = item.content.trim();
    const lower = text.toLowerCase();

    // 1. Detección de proyecto por nombre o palabras clave (configurables en cada proyecto)
    const targetProject = this.findProjectForText(text);

    if (targetProject) {
      let cleanTitle = text
        .replace(/^nexus,?\s*/i, '')
        .replace(/^agregar?\s+(al\s+proyecto\s+de\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .replace(/^agregar?\s+(a\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .trim();
      if (cleanTitle.length < 3) cleanTitle = text;
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      if (!targetProject.tasks) targetProject.tasks = [];
      targetProject.tasks.push({
        id: this.uid(),
        title: cleanTitle,
        column: 'buzon',
        effort: 'S',
        originThoughtId: item.id,
        createdAt: new Date().toISOString()
      });

      this.deletePensaderoItem(item.id);
      this.saveState();
      this.render();
      this.triggerDopamineReward();
      this.triggerShockwave();

      this.showToast(`✨ Enviado a ${targetProject.name}: "${cleanTitle.slice(0, 40)}"`, () => this.openKanbanProject(targetProject.id), 'Ver');
      return;
    }

    // 2. Si no es un proyecto, clasificar en categoría/color de humo correspondiente
    const local = CapturaParser.classifyLocal(text, { memory: this.state.settings?.classifierMemory });
    if (!local.matched) {
      this.showToast('🤔 No encontré pistas claras. Elige el color en la tarjeta y lo recordaré.');
      return;
    }
    item.classifiedBy = { by: 'local', reasons: local.reasons, confidence: local.confidence };
    this.changeThoughtCategory(item.id, local.category, { source: 'auto' });
    this.triggerDopamineReward();
    const meta = SMOKE_PALETTE[local.category];
    this.showToast(`✨ ${meta.icon} ${meta.name} · por «${local.reasons.join('», «')}»`);
  },

  // --- CLASIFICACIÓN / TRASLADO POR COMANDO DE VOZ ---
  dispatchThoughtByVoice(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      const choice = prompt(`Dictado por voz no disponible en este navegador.\nEscribe a qué proyecto o color deseas moverlo:\n(Ejemplos: 'CytoHelix', 'CytoCore', 'FocusFlow', 'Urgente', 'Idea')`);
      if (choice) this.processVoiceThoughtDispatch(item.id, choice);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'es-ES';
      rec.continuous = false;
      rec.interimResults = false;

      alert(`🎙️ Habla ahora:\n\nDi a qué proyecto o color deseas mover "${item.content.slice(0, 35)}..."\n\n(Ej: "Mover a CytoHelix", "Agregar a CytoCore", "Marcar como urgente")`);

      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        this.processVoiceThoughtDispatch(item.id, transcript);
      };

      rec.onerror = (e) => {
        console.warn("Speech dispatch error:", e);
      };

      rec.start();
    } catch(err) {
      console.error("SpeechRec start error:", err);
    }
  },

  processVoiceThoughtDispatch(target, voiceText) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const lower = voiceText.toLowerCase();

    const targetProject = this.findProjectForText(voiceText);

    if (targetProject) {
      const isNext = lower.includes('próximo') || lower.includes('proximo') || lower.includes('hoy') || lower.includes('foco');
      const col = isNext ? 'proximo' : 'buzon';
      if (!targetProject.tasks) targetProject.tasks = [];
      targetProject.tasks.push({
        id: this.uid(),
        title: item.content,
        column: col,
        effort: 'S',
        createdAt: new Date().toISOString()
      });

      this.deletePensaderoItem(item.id);
      this.saveState();
      this.render();
      this.triggerDopamineReward();
      alert(`🎙️ Por comando de voz ("${voiceText}"):\n✓ Pensamiento agregado a ${targetProject.emoji || '🎯'} ${targetProject.name} como ${col === 'proximo' ? 'Próximo Paso' : 'Buzón'}.`);
      return;
    }

    let cat = null;
    if (lower.includes('urgente') || lower.includes('rojo') || lower.includes('fuego')) cat = 'humo_rojo';
    else if (lower.includes('idea') || lower.includes('oro') || lower.includes('dorado')) cat = 'humo_dorado';
    else if (lower.includes('deep work') || lower.includes('código') || lower.includes('azul')) cat = 'humo_azul';
    else if (lower.includes('soltar') || lower.includes('blanco') || lower.includes('limpiar')) cat = 'humo_blanco';
    else if (lower.includes('hábito') || lower.includes('verde') || lower.includes('salud')) cat = 'humo_verde';
    else if (lower.includes('crm') || lower.includes('llamar') || lower.includes('púrpura') || lower.includes('morado')) cat = 'humo_purpura';
    else if (lower.includes('dinero') || lower.includes('gasto') || lower.includes('naranja')) cat = 'humo_naranja';
    else if (lower.includes('congelar') || lower.includes('ceniza') || lower.includes('algún día')) cat = 'humo_ceniza';
    else if (lower.includes('tarea') || lower.includes('pendiente') || lower.includes('quehacer') || lower.includes('to-do') || lower.includes('todo') || lower.includes('índigo') || lower.includes('indigo')) cat = 'humo_tarea';
    else if (lower.includes('general') || lower.includes('libre')) cat = 'humo_general';

    if (cat) {
      this.changeThoughtCategory(item.id, cat);
      const meta = SMOKE_PALETTE[cat];
      this.showToast(`🎙️ Por voz: ${meta.icon} ${meta.name}`);
    } else {
      this.autoClassifyThought(item.id);
    }
  },

  // opts.source 'auto' = lo decidió la app; cualquier otro cambio es una corrección del usuario y se aprende
  changeThoughtCategory(target, newCategory, opts = {}) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    if (opts.source !== 'auto' && newCategory !== 'humo_general' && item.content) {
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.classifierMemory = CapturaParser.learn(this.state.settings.classifierMemory || {}, item.content, newCategory);
      item.classifiedBy = { by: 'usuario' };
    }

    const meta = SMOKE_PALETTE[newCategory] || SMOKE_PALETTE.humo_general;
    item.category = newCategory;
    item.cognitiveWeight = meta.cognitiveWeight || 'medio';
    item.module = meta.module || 'El Pensadero';

    this.saveState();
    this.render();
    this.setOrbeColor(newCategory);
    this.triggerShockwave();

    if (this.backendAvailable && item.id) {
      fetch(`${this.API_BASE}/pensadero/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, cognitiveWeight: item.cognitiveWeight })
      }).catch(() => {});
    }
  },

  isAutoClassifyEnabled() {
    return this.state.settings?.autoClassify !== false;
  },

  setAutoClassify(enabled) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.autoClassify = !!enabled;
    this.saveState();
    this.showToast(enabled ? '🧠 Nexus clasificará lo que sueltes sin color.' : 'Auto-clasificación desactivada.');
  },

  async nexusClassifyNewThought(itemId, text) {
    if (!this.isAutoClassifyEnabled()) return;
    let data;
    try {
      const res = await this.fetchNexus('/thought', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) return;
      data = await res.json();
    } catch (e) {
      return; // Sin servicio Nexus: el pensamiento se queda "Sin clasificar", como siempre
    }
    if (!data || data.matched === false) return;
    const cat = ProyectazoApp.NEXUS_TYPE_TO_SMOKE[data.thought_type];
    if (!cat || !SMOKE_PALETTE[cat]) return;

    // No pisar una decisión del usuario tomada mientras esperábamos la respuesta
    const item = (this.state.pensadero || []).find(p => p.id === itemId);
    if (!item || item.category !== 'humo_general') return;

    item.classifiedBy = { by: 'gemini' };
    this.changeThoughtCategory(itemId, cat, { source: 'auto' });
    const meta = SMOKE_PALETTE[cat];
    this.showToast(`🧠 Nexus lo clasificó como ${meta.icon} ${meta.name}`, () => {
      this.changeThoughtCategory(itemId, 'humo_general', { source: 'auto' });
    }, 'Deshacer');
  },

  sendInputDirectToProject() {
    const jarvisInput = document.getElementById('pensadero-jarvis-input');
    const directInput = document.getElementById('pensadero-direct-dump-input');
    let text = (jarvisInput && jarvisInput.value.trim()) || (directInput && directInput.value.trim()) || '';

    if (!text) {
      text = prompt('Escribe el pensamiento, idea o tarea que deseas mandar a un proyecto:');
      if (!text || !text.trim()) return;
      text = text.trim();
    }

    const cat = document.getElementById('pensadero-cat-val')?.value || null;
    const [item] = this.captureThought(text, { source: 'directo', category: cat, skipSplit: true, silent: true });
    if (jarvisInput) jarvisInput.value = '';
    if (directInput) directInput.value = '';
    this.updateBadges();
    this.renderPensaderoDirectItems();
    if (item) this.quickDispatchThoughtToProject(item.id);
  },

  openDispatchThoughtModal(target) {
    this.quickDispatchThoughtToProject(target);
  },

  quickDispatchThoughtToProject(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const modal = document.getElementById('modal-dispatch-thought');
    const body = document.getElementById('dispatch-thought-body');
    if (!modal || !body) return;

    const projects = this.state.projects || [];
    const enEjecucionProjects = projects.filter(p => p.status === 'en_ejecucion');
    const activeProjects = projects.filter(p => p.status === 'activo');
    const otherProjects = projects.filter(p => p.status !== 'en_ejecucion' && p.status !== 'activo');

    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200">
          <span class="text-cyan-400 font-bold block mb-1">Pensamiento a direccionar:</span>
          <p class="font-medium text-sm leading-relaxed">${this.escapeHtml(item.content)}</p>
        </div>

        <!-- Opción: Crear Nuevo Proyecto Formal -->
        <div>
          <button onclick="app.convertPensaderoToProject('${item.id}'); app.closeModal('modal-dispatch-thought')" 
            class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-between transition active:scale-98 shadow-sm">
            <span class="flex items-center gap-2"><span>✨</span> Convertir en Proyecto Nuevo Completo</span>
            <span>→</span>
          </button>
        </div>

        <!-- Proyectos En Ejecución (Máx 3) -->
        ${enEjecucionProjects.length > 0 ? `
          <div>
            <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
              <span>🔥</span> En Ejecución (Foco Inmediato)
            </h4>
            <div class="space-y-2">
              ${enEjecucionProjects.map(p => `
                <div class="p-3 rounded-2xl bg-slate-900 border border-rose-500/40 hover:border-rose-400 transition flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-base shrink-0">${p.emoji || '📁'}</span>
                    <div class="text-left min-w-0">
                      <strong class="text-xs text-white block truncate">${this.escapeHtml(p.name)}</strong>
                      <span class="text-[10px] text-slate-400">${(p.tasks || []).length} tareas</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'buzon')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95" title="Enviar a Buzón de ideas">
                      📥 Buzón
                    </button>
                    <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'proximo')" class="px-2.5 py-1.5 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 text-xs font-semibold transition active:scale-95" title="Enviar como Próximo Paso">
                      🎯 Próximo
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Proyectos Activos (En Radar) -->
        <div>
          <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
            <span>⚡</span> Proyectos Activos (En Radar)
          </h4>
          ${activeProjects.length === 0 && enEjecucionProjects.length === 0 ? `
            <p class="text-xs text-slate-500 italic p-2">No hay proyectos activos en este momento.</p>
          ` : `
            <div class="space-y-2">
              ${activeProjects.map(p => `
                <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-base shrink-0">${p.emoji || '📁'}</span>
                    <div class="text-left min-w-0">
                      <strong class="text-xs text-white block truncate">${this.escapeHtml(p.name)}</strong>
                      <span class="text-[10px] text-slate-400">${(p.tasks || []).length} tareas</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'buzon')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95" title="Enviar a Buzón de ideas">
                      📥 Buzón
                    </button>
                    <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'proximo')" class="px-2.5 py-1.5 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 text-xs font-semibold transition active:scale-95" title="Enviar como Próximo Paso">
                      🎯 Próximo
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Otros Proyectos (Hibernados / En Espera / Ideas) -->
        ${otherProjects.length > 0 ? `
          <div>
            <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
              Otros Proyectos (Incubadora / Ideas)
            </h4>
            <div class="space-y-1.5 max-h-40 overflow-y-auto">
              ${otherProjects.map(p => `
                <div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2">
                  <span class="text-xs text-slate-300 flex items-center gap-1.5 min-w-0 truncate">
                    <span class="shrink-0">${p.emoji || '📁'}</span> <span class="truncate">${this.escapeHtml(p.name)}</span>
                  </span>
                  <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'buzon')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold shrink-0 active:scale-95">
                    📥 Mandar a Buzón
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    modal.classList.remove('hidden');
  },

  executeDispatchThought(target, projectId, column = 'buzon') {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const project = (this.state.projects || []).find(p => p.id === projectId);
    if (!project) return;

    if (!project.tasks) project.tasks = [];
    project.tasks.push({
      id: this.uid(),
      title: item.content,
      column: column,
      effort: 'S',
      originThoughtId: item.id,
      originThoughtContent: item.content,
      createdAt: new Date().toISOString()
    });

    // Eliminar del pensadero
    const idx = this.getPensaderoIndex(item.id);
    if (idx >= 0 && this.state.pensadero) {
      this.state.pensadero.splice(idx, 1);
    }

    if (this.backendAvailable && item && item.id) {
      fetch(`${this.API_BASE}/pensadero/${item.id}`, { method: 'DELETE' }).catch(() => {});
    }

    this.saveState();
    this.closeModal('modal-dispatch-thought');
    this.renderPensaderoItemsOnly();
    this.triggerDopamineReward();

    if (this.shaderEngine) {
      this.shaderEngine.pulseShockwave();
    }

    // Toast moderno no bloqueante con acción
    this.showToast(`🚀 Canalizado a ${project.name} (${column === 'proximo' ? 'Próximo Paso' : 'Buzón'})`, () => {
      this.openKanbanProject(project.id);
    }, 'Ver Tablero ➔');
  },

  // Renderiza únicamente la lista de pensamientos sin reiniciar el canvas WebGL ni causar parpadeo blanco
  renderPensaderoItemsOnly() {
    const list = document.getElementById('pensadero-list');
    if (!list) {
      this.render();
      return;
    }

    const items = this.state.pensadero || [];
    const activeFilter = this.pensaderoSmokeFilter || 'all';
    const nowMs = Date.now();
    const filteredItems = items.filter(it => {
      if (activeFilter === 'all') {
        if (it.category === 'humo_ceniza' && it.hibernatedUntil && it.hibernatedUntil > nowMs) return false;
        return true;
      }
      if (activeFilter === 'humo_general' || activeFilter === 'general') return it.category === 'humo_general' || !it.category;
      if (activeFilter === 'humo_blanco' || activeFilter === 'blanco') return it.category === 'humo_blanco' || it.category === 'descarga';
      if (activeFilter === 'humo_rojo' || activeFilter === 'rojo') return it.category === 'humo_rojo' || it.category === 'duda';
      if (activeFilter === 'humo_dorado' || activeFilter === 'dorado') return it.category === 'humo_dorado' || it.category === 'chispa';
      if (activeFilter === 'humo_azul' || activeFilter === 'azul') return it.category === 'humo_azul';
      if (activeFilter === 'humo_verde' || activeFilter === 'verde') return it.category === 'humo_verde';
      if (activeFilter === 'humo_purpura' || activeFilter === 'purpura') return it.category === 'humo_purpura';
      if (activeFilter === 'humo_naranja' || activeFilter === 'naranja') return it.category === 'humo_naranja';
      if (activeFilter === 'humo_ceniza' || activeFilter === 'ceniza') return it.category === 'humo_ceniza';
      return true;
    });

    list.innerHTML = filteredItems.length === 0 ? `
      <div class="p-8 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
        <span class="text-3xl block mb-2">🔮</span>
        <p class="font-semibold text-sm">Tu Pensadero está despejado en este filtro.</p>
        <p class="text-xs mt-1 text-slate-500">Dicta o escribe arriba para almacenar y luego enviar a proyectos en 1 clic.</p>
      </div>
    ` : filteredItems.map((item, idx) => this.renderPensaderoCard(item, idx)).join('');

    this.updateBadges();
  },

  // Sistema de Toast flotante no-bloqueante
  showToast(message, actionCallback = null, actionText = 'Abrir') {
    let toast = document.getElementById('nexus-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nexus-global-toast';
      toast.className = 'fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-cyan-500/40 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl flex items-center gap-3 transition-all duration-300 opacity-0 translate-y-4 pointer-events-none';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    // textContent: los mensajes incluyen texto del usuario (pensamientos, nombres de proyecto)
    toast.replaceChildren();
    const msgEl = document.createElement('span');
    msgEl.textContent = message;
    toast.appendChild(msgEl);

    if (actionCallback) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'px-2.5 py-1 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition';
      btn.textContent = actionText;
      btn.onclick = () => {
        toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
        actionCallback();
      };
      toast.appendChild(btn);
    }

    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    }, actionCallback ? 6000 : 4000);
  },

  // Borrado con "Deshacer": el borrado en servidor es inmediato y deshacer lo recrea vía sync.
  undoableRestore(restoreFn) {
    restoreFn();
    this.saveState();
    this.render();
    if (this.backendAvailable) this.syncWithBackend(false);
  },

  deletePensaderoItemWithUndo(target) {
    const idx = this.getPensaderoIndex(target);
    const item = idx >= 0 ? this.state.pensadero[idx] : null;
    if (!item) return;
    this.deletePensaderoItem(target);
    this.showToast('🧹 Pensamiento archivado', () => this.undoableRestore(() => {
      this.state.pensadero.splice(Math.min(idx, this.state.pensadero.length), 0, item);
    }), 'Deshacer');
  },

  deleteTaskWithUndo(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    const tasks = project?.tasks || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return;
    const task = tasks[idx];
    this.deleteTask(projectId, taskId);
    this.showToast(`🗑️ Tarea eliminada: "${(task.title || '').slice(0, 30)}"`, () => this.undoableRestore(() => {
      const p = this.state.projects.find(pr => pr.id === projectId);
      if (!p) return;
      if (!p.tasks) p.tasks = [];
      p.tasks.splice(Math.min(idx, p.tasks.length), 0, { ...task, updatedAt: new Date().toISOString() });
    }), 'Deshacer');
  },

  showNotification(message, type = 'info') {
    this.showToast(message);
  },

  renderPensaderoCard(item, idx) {
    const catMeta = SMOKE_PALETTE[item.category] || SMOKE_PALETTE.humo_dorado;
    const weightBadges = {
      ligero: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      medio: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      pesado: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      fuego: 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold animate-pulse'
    };
    const weightClass = weightBadges[item.cognitiveWeight || catMeta.cognitiveWeight] || weightBadges.medio;

    return `
      <div class="p-4 rounded-2xl theme-card border ${item.category === 'humo_rojo' && !item.isResolved ? 'border-rose-500/60 bg-rose-950/10 shadow-rose-950/30' : 'theme-border'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:brightness-105 transition">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border ${catMeta.badgeClass}">
              ${catMeta.icon} ${catMeta.name} · ${catMeta.title}
            </span>
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${weightClass}">
              Peso: ${item.cognitiveWeight || catMeta.cognitiveWeight}
            </span>
            ${item.isPinned ? `<span class="text-xs text-amber-400 font-bold">📌 Fijado</span>` : ''}
            ${item.isResolved ? `<span class="text-xs text-emerald-400 font-bold">✓ Resuelto</span>` : ''}
            <span class="text-[10px] font-mono theme-text-muted">${new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="text-sm font-semibold leading-relaxed">${this.escapeHtml(item.content)}</p>
          ${this.captureChips(item)}
          ${item.amount ? `<p class="text-xs text-orange-400 font-mono mt-1">💳 Importe: $${this.escapeHtml(item.amount)}</p>` : ''}
          ${item.streakCount ? `<p class="text-xs text-emerald-400 font-mono mt-1">🔥 Racha actual: ${item.streakCount} días consecutivos</p>` : ''}
          ${item.contactName ? `<p class="text-xs text-purple-300 font-mono mt-1">👤 Contacto: ${this.escapeHtml(item.contactName)}</p>` : ''}
          ${item.hibernatedUntil ? `<p class="text-xs text-slate-400 font-mono mt-1">❄️ Hibernado hasta: ${new Date(item.hibernatedUntil).toLocaleDateString('es-ES')}</p>` : ''}

          ${item.drawingData ? `
            <div class="mt-2.5 rounded-2xl overflow-hidden border theme-border max-w-sm bg-slate-950/40 p-2 cursor-pointer hover:border-emerald-500/50 transition group" onclick="app.loadDrawingIntoFreeform('${item.id}')" title="Clic para continuar editando en Lienzo Freeform">
              <img src="${item.drawingData}" alt="Boceto Freeform" class="w-full h-36 object-contain rounded-xl bg-slate-900/40" />
              <span class="block text-[10px] theme-text-muted mt-1.5 text-center font-mono group-hover:text-emerald-400">🎨 Clic para abrir y continuar en Lienzo Freeform →</span>
            </div>
          ` : ''}

          <!-- Barra de Clasificación y Asignación Rápida a Proyectos -->
          <div class="mt-3 pt-2.5 border-t theme-border flex flex-wrap items-center justify-between gap-2">
            <!-- Canalizar a Proyecto con 1 Clic -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Mover a:</span>
              ${(this.state.projects || []).filter(p => p.status === 'en_ejecucion' || p.status === 'activo').map(p => `
                <button onclick="app.executeDispatchThought('${item.id}', '${p.id}', 'buzon')" class="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-400 hover:text-cyan-300 text-xs font-semibold text-slate-200 transition flex items-center gap-1 shadow-sm active:scale-95 shrink-0" title="Enviar como tarea al Buzón de ${this.escapeHtml(p.name)}">
                  <span>${p.emoji || '🎯'}</span> <span class="max-w-[80px] sm:max-w-none truncate">${this.escapeHtml(p.name)}</span>
                </button>
              `).join('')}
            </div>

            <!-- Autoclasificar con Nexus IA, Voz y Selector de Color -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Botón Autoclasificar con Nexus IA -->
              <button onclick="app.autoClassifyThought('${item.id}')" class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50 text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95 shrink-0" title="Analizar texto y autoclasificar a proyecto o color con Nexus IA">
                <span>✨</span> <span class="hidden sm:inline">Autoclasificar </span>IA
              </button>
              <!-- Botón Mover por Voz -->
              <button onclick="app.dispatchThoughtByVoice('${item.id}')" class="px-2 py-1 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/40 text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95 shrink-0" title="Decir por voz a qué proyecto o color mover">
                <span>🎙️</span> <span class="hidden sm:inline">Voz</span>
              </button>
              <!-- Selector de Color de Humo -->
              <select onchange="app.changeThoughtCategory('${item.id}', this.value)" class="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono cursor-pointer shrink-0" title="Cambiar color del pensamiento">
                ${Object.keys(SMOKE_PALETTE).map(k => `
                  <option value="${k}" ${item.category === k ? 'selected' : ''}>${SMOKE_PALETTE[k].icon} ${SMOKE_PALETTE[k].name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Botones de Acción Neuroquímica & Despacho a Proyectos -->
        <div class="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">

          <!-- Botón Primario: Mandar a Proyecto -->
          <button onclick="app.quickDispatchThoughtToProject('${item.id}')" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 active:scale-95 transition flex items-center gap-1 shrink-0" title="Mandar directamente a proyectos o convertir">
            <span>🚀</span> <span class="hidden sm:inline">Mandar a </span>Proyecto
          </button>

          <!-- Mover al Baúl Secreto -->
          <button onclick="app.sendThoughtToBaul('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1 shrink-0 transition active:scale-95" title="Mover al Baúl privado protegido por código">
            <span>🔒</span> <span class="hidden sm:inline">Al </span>Baúl
          </button>

          ${(item.category === 'humo_rojo' || item.category === 'duda') ? `
            <button onclick="app.syncRedSmokeToGoogle('${item.id}', '${this.uriArg(item.content)}')" class="px-2.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Sincronizar con Google Tasks y Calendar">
              <span>📅</span> Google
            </button>
            ${!item.isResolved ? `
              <button onclick="app.resolveRedSmoke('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Apagar fuego">
                <span>✓</span> Apagar
              </button>
            ` : ''}
          ` : ''}

          ${(item.category === 'humo_blanco' || item.category === 'descarga') ? `
            <button onclick="app.releaseWhiteSmoke('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-white/10 text-slate-200 border border-white/20 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 shrink-0" title="Soltar y olvidar sin culpa para liberar memoria de trabajo">
              <span>💨</span> Soltar
            </button>
          ` : ''}

          ${(item.category === 'humo_tarea') ? `
            <button onclick="app.openScheduleEmailModal('${item.id}', '${this.uriArg(item.content)}')" class="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Programar recordatorio por Google Mail (Gmail)">
              <span>📧</span> Correo
            </button>
            <button onclick="app.chewGoldSmoke('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Masticar en 3 micro-pasos de 15 min">
              <span>🍴</span> 15m
            </button>
          ` : ''}

          ${(item.category === 'humo_dorado' || item.category === 'chispa') ? `
            <button onclick="app.chewGoldSmoke('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Masticar en 3 micro-pasos de 15 min">
              <span>🍴</span> 15m
            </button>
          ` : ''}

          ${(item.category === 'humo_azul') ? `
            <button onclick="app.scheduleDeepWorkBlock('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Agendar bloque de Deep Work de 2h con buffers">
              <span>💻</span> Deep Work
            </button>
          ` : ''}

          ${(item.category === 'humo_verde') ? `
            <button onclick="app.registerHabitStreak('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Alimentar racha y recargar dopamina">
              <span>🌱</span> +1 Racha
            </button>
          ` : ''}

          ${(item.category === 'humo_purpura') ? `
            <button onclick="app.openPersonalCRM('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Ver avatar de memoria antes de llamar">
              <span>💜</span> Avatar
            </button>
          ` : ''}

          ${(item.category === 'humo_naranja') ? `
            <button onclick="app.registerFinancialFriction('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Evaluar impacto financiero y enfriar compra">
              <span>💳</span> Gasto
            </button>
          ` : ''}

          ${(item.category === 'humo_ceniza') ? `
            ${item.hibernatedUntil ? `
              <button onclick="app.wakeThought('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-semibold shrink-0" title="Despertar pensamiento">
                ☀️ Despertar
              </button>
            ` : `
              <button onclick="app.hibernateThought('${item.id}', 14)" class="px-2.5 py-1.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs font-semibold shrink-0" title="Congelar por 14 días">
                ❄️ 14d
              </button>
            `}
          ` : ''}

          <button onclick="app.openEditThoughtModal('${item.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-cyan-400 text-xs shrink-0" title="Editar Pensamiento (CRUD)">
            ✏️
          </button>
          <button onclick="app.togglePinPensadero('${item.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-amber-400 text-xs shrink-0" title="Fijar">
            📌
          </button>
          <button onclick="app.deletePensaderoItemWithUndo('${item.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-rose-400 text-xs shrink-0" title="Limpiar sin culpa">
            🗑️
          </button>
        </div>
      </div>
    `;
  },

  togglePinPensadero(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.isPinned = !item.isPinned;
    this.state.pensadero.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    this.saveState();
    this.render();
  },

  deletePensaderoItem(target) {
    const idx = this.getPensaderoIndex(target);
    if (idx < 0 || !this.state.pensadero || idx >= this.state.pensadero.length) return;
    const item = this.state.pensadero[idx];
    this.state.pensadero.splice(idx, 1);
    this.saveState();
    this.render();

    if (this.backendAvailable && item && item.id) {
      fetch(`${this.API_BASE}/pensadero/${item.id}`, { method: 'DELETE' }).catch(() => {});
    }
  },

  clearPensaderoPrompts() {
    if (confirm("¿Deseas vaciar todas las notas no fijadas de El Pensadero?")) {
      this.state.pensadero = (this.state.pensadero || []).filter(item => item.isPinned);
      this.saveState();
      this.render();
    }
  },

  convertPensaderoToProject(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    const activeCount = (this.state.projects || []).filter(p => p.status === 'activo').length;
    const initialStatus = activeCount >= 3 ? 'hibernado' : 'activo';

    const pName = prompt("Nombre para el nuevo proyecto:", item.content.slice(0, 35));
    if (!pName || !pName.trim()) return;

    const newProject = {
      id: this.uid(),
      name: pName.trim(),
      emoji: item.category === 'humo_azul' ? '💻' : (item.category === 'humo_verde' ? '🌱' : (item.category === 'humo_purpura' ? '💜' : '✨')),
      color: item.category === 'humo_azul' ? '#3b82f6' : (item.category === 'humo_verde' ? '#10b981' : (item.category === 'humo_purpura' ? '#a855f7' : '#f59e0b')),
      objective: item.content,
      nextAction: `Primer micro-paso de: ${pName.trim()}`,
      nextActionType: 'hacer',
      status: initialStatus,
      energy: 'media',
      originThoughtId: item.id,
      originThoughtContent: item.content,
      lastActivity: new Date().toISOString(),
      logs: [],
      tasks: [
        {
          id: this.uid(),
          title: `Primer micro-paso de: ${pName.trim()}`,
          column: 'proximo',
          effort: 'S',
          isKickstart: true,
          originThoughtId: item.id,
          originThoughtContent: item.content,
          createdAt: new Date().toISOString()
        }
      ]
    };

    if (!this.state.projects) this.state.projects = [];
    this.state.projects.unshift(newProject);
    this.deletePensaderoItem(item.id);
    this.saveState();
    this.render();
    this.triggerDopamineReward();

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState(item.category);
      this.shaderEngine.pulseShockwave();
    }

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      }).catch(() => {});
    }

    const askDeconstruct = confirm(`✨ ¡Proyecto creado a partir del Pensadero!\n\nOrigen trazable: "${item.content}"\n\n¿Deseas desglosarlo con Gemini en micro-pasos de 15 minutos ahora mismo?`);
    if (askDeconstruct) {
      this.deconstructWithGemini(newProject.objective, newProject.id);
    } else {
      this.openKanbanProject(newProject.id);
    }
  },

  assignPensaderoToProjectPrompt(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      alert("No hay proyectos creados.");
      return;
    }

    const options = projects.map((p, i) => `${i + 1}. ${p.emoji || '🎯'} ${p.name}`).join('\n');
    const res = prompt(`Selecciona el número de proyecto al que deseas enviar este pensamiento:\n\n${options}\n\nIngresa número (1-${projects.length}):`, "1");
    if (!res) return;
    const pIndex = parseInt(res, 10) - 1;
    if (!isNaN(pIndex) && projects[pIndex]) {
      const p = projects[pIndex];
      if (!p.tasks) p.tasks = [];
      p.tasks.push({
        id: this.uid(),
        title: item.content,
        column: 'buzon',
        effort: 'S',
        originThoughtId: item.id,
        originThoughtContent: item.content,
        createdAt: new Date().toISOString()
      });
      this.deletePensaderoItem(item.id);
      this.saveState();
      this.render();
      this.triggerDopamineReward();
      alert(`✓ Asignado como tarea al Buzón de "${p.name}" conservando trazabilidad de origen.`);
      this.openKanbanProject(p.id);
    }
  },
});
