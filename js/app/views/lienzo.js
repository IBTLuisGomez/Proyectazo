'use strict';
// Vista "Lienzo libre" (freeform).
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA NUEVA: 🎨 LIENZO LIBRE / FREEFORM TDAH
  // ==========================================
  renderViewFreeform(container) {
    const projects = this.state.projects || [];
    const activeProject = projects.find(p => p.id === this.selectedKanbanProjectId) || projects[0];

    container.innerHTML = `
      <!-- Header del Lienzo Freeform -->
      <div class="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono font-bold uppercase text-purple-400 tracking-wider">Espacio Visual Creativo</span>
            <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Estilo Apple Freeform</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold flex items-center gap-2">
            <span>🎨</span> Lienzo Libre — Freeform TDAH
          </h1>
          <p class="text-xs theme-text-muted mt-0.5">Dibuja a mano alzada, anota, esquematiza o sube bocetos. Soporta lápiz óptico, Apple Pencil y tacto directo.</p>
        </div>

        <!-- Acciones de Exportación e Integración -->
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="document.getElementById('freeform-file-input').click()" class="px-3 py-1.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110 flex items-center gap-1.5 transition" title="Subir imagen o boceto realizado a mano">
            <span>🖼️</span> Subir Imagen
          </button>
          <button onclick="app.addFreeformStickyNote()" class="px-3 py-1.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110 flex items-center gap-1.5 transition" title="Agregar nota adhesiva tipo Post-It en el lienzo">
            <span>📝</span> + Post-it
          </button>
          <button onclick="app.saveFreeformToPensadero()" class="px-3.5 py-1.5 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 font-bold text-xs flex items-center gap-1.5 transition" title="Guardar como idea visual en El Pensadero">
            <span>🧠</span> Enviar a Pensadero
          </button>
          <button onclick="app.assignFreeformToProjectPrompt()" class="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition" title="Vincular este diagrama a un proyecto activo">
            <span>⚡</span> Asignar a Proyecto
          </button>
          <button onclick="app.downloadFreeformPNG()" class="px-3 py-1.5 rounded-xl theme-card border theme-border text-xs font-semibold hover:brightness-110 transition" title="Descargar como archivo de imagen PNG">
            <span>💾</span> PNG
          </button>
        </div>
      </div>

      <!-- Contenedor del Lienzo e interacción táctil / stylus (Menú Freeform Flotante Integrado) -->
      <div class="relative w-full rounded-3xl overflow-hidden border theme-border shadow-2xl bg-slate-950/70 select-none" id="freeform-canvas-container" style="min-height: 580px;">
        <canvas id="freeform-canvas" class="w-full touch-none cursor-crosshair block"></canvas>

        <!-- ISLA DE HERRAMIENTAS FLOTANTE FREEFORM (MOVIBLE, REDIMENSIONABLE Y ADAPTABLE) -->
        <div id="freeform-floating-toolbar" class="absolute top-3 left-3 sm:left-1/2 sm:-translate-x-1/2 z-30 select-none shadow-2xl rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl text-white transition-all duration-200" style="touch-action: none;">
          <!-- Cabecera de Arrastre y Control de Tamaño -->
          <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/70 rounded-t-2xl cursor-grab active:cursor-grabbing text-slate-400 select-none" id="freeform-drag-handle" title="Arrastra para mover el menú por el lienzo">
            <div class="flex items-center gap-1.5 pointer-events-none">
              <span class="text-xs font-mono font-bold tracking-widest text-slate-500">⋮⋮</span>
              <span class="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider">Freeform Island</span>
            </div>
            <div class="flex items-center gap-1">
              <!-- Botón de Redimensionar / Compactar -->
              <button type="button" onclick="app.toggleFreeformToolbarMode()" id="freeform-mode-toggle-btn" class="px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-slate-700 flex items-center gap-1 transition" title="Cambiar tamaño: Modo Compacto / Modo Completo">
                <span id="freeform-mode-icon">⤡</span> <span id="freeform-mode-label" class="hidden sm:inline">Compactar</span>
              </button>
              <!-- Botón de Orientación (Horizontal / Vertical) -->
              <button type="button" onclick="app.toggleFreeformToolbarOrientation()" id="freeform-orient-btn" class="px-1.5 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono text-purple-300 border border-slate-700 transition" title="Cambiar orientación (Horizontal / Vertical)">
                ⇄
              </button>
            </div>
          </div>

          <!-- Paleta Completa (Modo Expandido) -->
          <div id="freeform-tools-expanded" class="p-2 flex flex-wrap items-center gap-2 text-xs">
            <!-- Herramientas de Trazo -->
            <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
              <button onclick="app.setFreeformTool('pen')" id="tool-pen" class="ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Bolígrafo fino">
                <span>✏️</span> <span class="hidden sm:inline">Pluma</span>
              </button>
              <button onclick="app.setFreeformTool('brush')" id="tool-brush" class="ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 text-slate-400 hover:text-white" title="Pincel suave">
                <span>🖌️</span> <span class="hidden sm:inline">Pincel</span>
              </button>
              <button onclick="app.setFreeformTool('highlighter')" id="tool-highlighter" class="ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 text-slate-400 hover:text-white" title="Resaltador">
                <span>🖍️</span>
              </button>
              <button onclick="app.setFreeformTool('eraser')" id="tool-eraser" class="ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 text-slate-400 hover:text-white" title="Borrador">
                <span>🧹</span>
              </button>
              <button onclick="app.addFreeformStickyNote()" class="px-2 py-1 rounded-lg text-amber-300 hover:text-amber-200 transition font-semibold" title="Agregar nota Post-It">
                <span>📝</span>
              </button>
              <label class="px-2 py-1 rounded-lg text-cyan-300 hover:text-cyan-200 transition cursor-pointer" title="Subir imagen al lienzo">
                <span>🖼️</span>
                <input type="file" accept="image/*" class="hidden" onchange="app.handleFreeformImageUpload(event)" />
              </label>
            </div>

            <!-- Paleta de Colores -->
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
              <button onclick="app.setFreeformColor('#10b981')" class="ff-color-btn w-5 h-5 rounded-full border-2 border-white ring-2 ring-emerald-500 transition scale-110" style="background:#10b981;" title="Esmeralda"></button>
              <button onclick="app.setFreeformColor('#06b6d4')" class="ff-color-btn w-5 h-5 rounded-full border border-slate-700 transition hover:scale-105" style="background:#06b6d4;" title="Cian"></button>
              <button onclick="app.setFreeformColor('#a855f7')" class="ff-color-btn w-5 h-5 rounded-full border border-slate-700 transition hover:scale-105" style="background:#a855f7;" title="Púrpura"></button>
              <button onclick="app.setFreeformColor('#eab308')" class="ff-color-btn w-5 h-5 rounded-full border border-slate-700 transition hover:scale-105" style="background:#eab308;" title="Ámbar"></button>
              <button onclick="app.setFreeformColor('#f43f5e')" class="ff-color-btn w-5 h-5 rounded-full border border-slate-700 transition hover:scale-105" style="background:#f43f5e;" title="Rosa"></button>
              <button onclick="app.setFreeformColor('#ffffff')" class="ff-color-btn w-5 h-5 rounded-full border border-slate-400 transition hover:scale-105" style="background:#ffffff;" title="Blanco"></button>
              <label class="w-5 h-5 rounded-full border border-slate-700 overflow-hidden cursor-pointer flex items-center justify-center hover:scale-105 transition" title="Color personalizado">
                <input type="color" id="freeform-custom-color" value="#10b981" onchange="app.setFreeformColor(this.value)" class="opacity-0 w-6 h-6 cursor-pointer" />
                <span class="text-[8px] pointer-events-none">🌈</span>
              </label>
            </div>

            <!-- Grosor del Trazo -->
            <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
              <button onclick="app.setFreeformSize(2)" class="ff-size-btn px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white">2px</button>
              <button onclick="app.setFreeformSize(5)" class="ff-size-btn px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">5px</button>
              <button onclick="app.setFreeformSize(12)" class="ff-size-btn px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white">12px</button>
            </div>

            <!-- Acciones -->
            <div class="flex items-center gap-1">
              <button onclick="app.undoFreeform()" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs" title="Deshacer (Ctrl+Z)">↩️</button>
              <button onclick="app.redoFreeform()" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs" title="Rehacer (Ctrl+Y)">↪️</button>
              <button onclick="app.clearFreeform()" class="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold" title="Limpiar lienzo">🗑️</button>
            </div>
          </div>

          <!-- Vista Compacta (Píldora Minimalista Flotante) -->
          <div id="freeform-tools-compact" class="p-1.5 hidden flex items-center gap-2 text-xs">
            <span id="freeform-compact-tool-icon" class="text-sm">✏️</span>
            <span id="freeform-compact-color-dot" class="w-4 h-4 rounded-full border border-white/60 shadow" style="background:#10b981;"></span>
            <span id="freeform-compact-size-badge" class="text-[10px] font-mono font-bold text-emerald-400">5px</span>
            <button onclick="app.undoFreeform()" class="p-1 rounded bg-slate-800/80 text-xs hover:text-white" title="Deshacer">↩️</button>
            <button onclick="app.toggleFreeformToolbarMode()" class="px-2 py-0.5 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold hover:bg-purple-600/50 transition">
              ⤢ Expandir
            </button>
          </div>
        </div>

        <!-- Capa de Notas Adhesivas Flotantes tipo Post-It -->
        <div id="freeform-notes-layer" class="absolute inset-0 pointer-events-none p-4 overflow-hidden">
          <!-- Post-its inyectados dinámicamente -->
        </div>

        <!-- Input invisible para subir imágenes -->
        <input type="file" id="freeform-file-input" accept="image/*" class="hidden" onchange="app.handleFreeformImageUpload(event)" />
      </div>

      <!-- Sugerencia y Atajos para TDAH -->
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] theme-text-muted">
        <div class="flex items-center gap-2">
          <span>💡 <strong>Consejo TDAH:</strong> El dibujo libre y los mapas mentales espaciales ayudan a desacelerar pensamientos rápidos y activar la memoria de trabajo sin agobio.</span>
        </div>
        <div class="flex items-center gap-2 font-mono text-[10px]">
          <span>Trazos guardados automáticamente en local</span>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.initFreeformCanvas();
    }, 50);
  },

  // --- ENGINE DE DIBUJO FREEFORM ---
  initFreeformCanvas() {
    const container = document.getElementById('freeform-canvas-container');
    const canvas = document.getElementById('freeform-canvas');
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width || (window.innerWidth - 32);
    const height = Math.max(window.innerHeight - 320, 520);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    this.freeform.canvas = canvas;
    this.freeform.ctx = ctx;
    this.freeform.dpr = dpr;
    this.freeform.width = width;
    this.freeform.height = height;

    // Dibujar sutil fondo cuadriculado con puntos (Graph paper TDAH)
    this.drawFreeformGrid(ctx, width, height);

    // Restaurar boceto previo guardado
    const saved = localStorage.getItem('proyectazo_freeform_saved');
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        this.saveFreeformStateToHistory();
      };
      img.src = saved;
    } else {
      this.saveFreeformStateToHistory();
    }

    // Renderizar notas adhesivas
    this.renderFreeformNotes();

    // Listeners de Dibujo con PointerEvents (Stylus, Touch y Mouse)
    const getCoords = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top
      };
    };

    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.freeform.isDrawing = true;
      const { x, y } = getCoords(e);
      this.freeform.lastX = x;
      this.freeform.lastY = y;
      this.drawFreeformDot(x, y, e.pressure);
    };

    canvas.onpointermove = (e) => {
      if (!this.freeform.isDrawing) return;
      const { x, y } = getCoords(e);
      this.drawFreeformStroke(x, y, e.pressure);
    };

    const stopDrawing = (e) => {
      if (this.freeform.isDrawing) {
        this.freeform.isDrawing = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch(err){}
        this.saveFreeformStateToHistory();
        this.autoSaveFreeformCanvas();
      }
    };

    canvas.onpointerup = stopDrawing;
    canvas.onpointercancel = stopDrawing;

    // Inicializar barra flotante integrada tipo Freeform
    this.initDraggableFreeformToolbar();
    this.updateFreeformCompactDisplay();
  },

  drawFreeformGrid(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    const step = 28;
    for (let x = step; x < w; x += step) {
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  drawFreeformDot(x, y, pressure) {
    const ctx = this.freeform.ctx;
    if (!ctx) return;
    ctx.save();
    this.applyFreeformToolStyles(ctx, pressure);
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawFreeformStroke(x, y, pressure) {
    const ctx = this.freeform.ctx;
    if (!ctx) return;

    ctx.save();
    this.applyFreeformToolStyles(ctx, pressure);

    ctx.beginPath();
    ctx.moveTo(this.freeform.lastX, this.freeform.lastY);
    // Suavizado con curva Bézier cuadrática
    const midX = (this.freeform.lastX + x) / 2;
    const midY = (this.freeform.lastY + y) / 2;
    ctx.quadraticCurveTo(this.freeform.lastX, this.freeform.lastY, midX, midY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    this.freeform.lastX = x;
    this.freeform.lastY = y;
  },

  applyFreeformToolStyles(ctx, pressure = 0.5) {
    const { tool, color, size } = this.freeform;
    const pFactor = pressure > 0 && pressure <= 1 ? (0.6 + pressure * 0.8) : 1;
    const effSize = Math.max(1, size * pFactor);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = effSize * 2.5;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = effSize * 2.2;
      ctx.strokeStyle = this.hexToRgba(color, 0.35);
      ctx.fillStyle = this.hexToRgba(color, 0.35);
    } else if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = effSize * 1.6;
      ctx.strokeStyle = this.hexToRgba(color, 0.85);
      ctx.fillStyle = this.hexToRgba(color, 0.85);
    } else {
      // Pen
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = effSize;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }
  },

  hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  },

  setFreeformTool(tool) {
    this.freeform.tool = tool;
    document.querySelectorAll('.ff-tool-btn').forEach(b => {
      b.className = 'ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 theme-text-muted hover:text-white';
    });
    const active = document.getElementById(`tool-${tool}`);
    if (active) {
      active.className = 'ff-tool-btn px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
    this.updateFreeformCompactDisplay();
  },

  setFreeformColor(color) {
    this.freeform.color = color;
    document.querySelectorAll('.ff-color-btn').forEach(b => {
      b.classList.remove('scale-110', 'ring-2', 'ring-emerald-500', 'border-white');
    });
    const customEl = document.getElementById('freeform-custom-color');
    if (customEl) customEl.value = color;
    this.updateFreeformCompactDisplay();
  },

  setFreeformSize(size) {
    this.freeform.size = size;
    document.querySelectorAll('.ff-size-btn').forEach(b => {
      b.className = 'ff-size-btn px-2 py-0.5 rounded text-[11px] font-mono theme-text-muted hover:text-white';
    });
    const activeBtn = Array.from(document.querySelectorAll('.ff-size-btn')).find(b => b.textContent.includes(`${size}px`));
    if (activeBtn) {
      activeBtn.className = 'ff-size-btn px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-400 font-bold';
    }
    this.updateFreeformCompactDisplay();
  },

  // --- CONTROLES Y ARRASTRE DE LA ISLA FLOTANTE FREEFORM ---
  toggleFreeformToolbarMode() {
    const expanded = document.getElementById('freeform-tools-expanded');
    const compact = document.getElementById('freeform-tools-compact');
    const icon = document.getElementById('freeform-mode-icon');
    const label = document.getElementById('freeform-mode-label');
    if (!expanded || !compact) return;

    const isExpanded = !expanded.classList.contains('hidden');
    if (isExpanded) {
      expanded.classList.add('hidden');
      compact.classList.remove('hidden');
      if (icon) icon.textContent = '⤢';
      if (label) label.textContent = 'Expandir';
      this.updateFreeformCompactDisplay();
    } else {
      expanded.classList.remove('hidden');
      compact.classList.add('hidden');
      if (icon) icon.textContent = '⤡';
      if (label) label.textContent = 'Compactar';
    }
  },

  toggleFreeformToolbarOrientation() {
    const expanded = document.getElementById('freeform-tools-expanded');
    if (!expanded) return;
    const isCol = expanded.classList.contains('flex-col');
    if (isCol) {
      expanded.classList.remove('flex-col');
      expanded.classList.add('flex-row', 'flex-wrap');
    } else {
      expanded.classList.remove('flex-row', 'flex-wrap');
      expanded.classList.add('flex-col');
    }
  },

  updateFreeformCompactDisplay() {
    const toolIcons = { pen: '✏️', brush: '🖌️', highlighter: '🖍️', eraser: '🧹' };
    const iconEl = document.getElementById('freeform-compact-tool-icon');
    const dotEl = document.getElementById('freeform-compact-color-dot');
    const badgeEl = document.getElementById('freeform-compact-size-badge');

    if (iconEl) iconEl.textContent = toolIcons[this.freeform.tool] || '✏️';
    if (dotEl) dotEl.style.background = this.freeform.color;
    if (badgeEl) badgeEl.textContent = `${this.freeform.size}px`;
  },

  initDraggableFreeformToolbar() {
    const toolbar = document.getElementById('freeform-floating-toolbar');
    const handle = document.getElementById('freeform-drag-handle');
    const container = document.getElementById('freeform-canvas-container');
    if (!toolbar || !handle || !container) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    handle.onpointerdown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      try { handle.setPointerCapture(e.pointerId); } catch(err) {}
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = toolbar.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      initialLeft = rect.left - cRect.left;
      initialTop = rect.top - cRect.top;

      toolbar.classList.remove('sm:left-1/2', 'sm:-translate-x-1/2');
      toolbar.style.left = `${initialLeft}px`;
      toolbar.style.top = `${initialTop}px`;
      toolbar.style.right = 'auto';
      toolbar.style.bottom = 'auto';
    };

    handle.onpointermove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const cRect = container.getBoundingClientRect();
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = Math.max(8, cRect.width - toolbar.offsetWidth - 8);
      const maxTop = Math.max(8, cRect.height - toolbar.offsetHeight - 8);

      newLeft = Math.max(8, Math.min(newLeft, maxLeft));
      newTop = Math.max(8, Math.min(newTop, maxTop));

      toolbar.style.left = `${newLeft}px`;
      toolbar.style.top = `${newTop}px`;
    };

    const endDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch(err) {}
      }
    };

    handle.onpointerup = endDrag;
    handle.onpointercancel = endDrag;
  },

  saveFreeformStateToHistory() {
    if (!this.freeform.canvas) return;
    const dataUrl = this.freeform.canvas.toDataURL('image/png');
    if (this.freeform.historyStep < this.freeform.history.length - 1) {
      this.freeform.history = this.freeform.history.slice(0, this.freeform.historyStep + 1);
    }
    this.freeform.history.push(dataUrl);
    if (this.freeform.history.length > 25) {
      this.freeform.history.shift();
    }
    this.freeform.historyStep = this.freeform.history.length - 1;
  },

  undoFreeform() {
    if (this.freeform.historyStep > 0) {
      this.freeform.historyStep--;
      this.restoreCanvasFromDataUrl(this.freeform.history[this.freeform.historyStep]);
    }
  },

  redoFreeform() {
    if (this.freeform.historyStep < this.freeform.history.length - 1) {
      this.freeform.historyStep++;
      this.restoreCanvasFromDataUrl(this.freeform.history[this.freeform.historyStep]);
    }
  },

  restoreCanvasFromDataUrl(dataUrl) {
    const ctx = this.freeform.ctx;
    const canvas = this.freeform.canvas;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, this.freeform.width, this.freeform.height);
      this.drawFreeformGrid(ctx, this.freeform.width, this.freeform.height);
      ctx.drawImage(img, 0, 0, this.freeform.width, this.freeform.height);
      this.autoSaveFreeformCanvas();
    };
    img.src = dataUrl;
  },

  clearFreeform() {
    if (!confirm("¿Deseas limpiar todos los trazos del lienzo?")) return;
    const ctx = this.freeform.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.freeform.width, this.freeform.height);
    this.drawFreeformGrid(ctx, this.freeform.width, this.freeform.height);
    this.saveFreeformStateToHistory();
    this.autoSaveFreeformCanvas();
  },

  autoSaveFreeformCanvas() {
    if (!this.freeform.canvas) return;
    try {
      const dataUrl = this.freeform.canvas.toDataURL('image/png');
      localStorage.setItem('proyectazo_freeform_saved', dataUrl);
    } catch(e) {}
  },

  // --- SUBIR DIBUJO O IMAGEN EXTERNA AL LIENZO ---
  handleFreeformImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ctx = this.freeform.ctx;
        if (!ctx) return;

        // Escalar manteniendo proporción centrado
        const maxW = this.freeform.width * 0.85;
        const maxH = this.freeform.height * 0.85;
        let drawW = img.width;
        let drawH = img.height;

        if (drawW > maxW || drawH > maxH) {
          const ratio = Math.min(maxW / drawW, maxH / drawH);
          drawW *= ratio;
          drawH *= ratio;
        }

        const posX = (this.freeform.width - drawW) / 2;
        const posY = (this.freeform.height - drawH) / 2;

        ctx.drawImage(img, posX, posY, drawW, drawH);
        this.saveFreeformStateToHistory();
        this.autoSaveFreeformCanvas();
        alert("✓ Imagen agregada al lienzo. ¡Ahora puedes rayar, anotar o dibujar encima!");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  // --- NOTAS ADHESIVAS FLOTANTES (POST-IT EN EL LIENZO) ---
  addFreeformStickyNote() {
    if (!this.state.freeformNotes) this.state.freeformNotes = [];
    const colors = [
      { bg: 'bg-amber-400 text-slate-950', border: 'border-amber-500' },
      { bg: 'bg-emerald-400 text-slate-950', border: 'border-emerald-500' },
      { bg: 'bg-purple-300 text-slate-950', border: 'border-purple-400' },
      { bg: 'bg-rose-300 text-slate-950', border: 'border-rose-400' }
    ];
    const chosen = colors[Math.floor(Math.random() * colors.length)];

    const note = {
      id: this.uid(),
      text: '',
      colorClass: chosen.bg,
      borderClass: chosen.border,
      x: 40 + (this.state.freeformNotes.length * 20) % 240,
      y: 60 + (this.state.freeformNotes.length * 20) % 200
    };

    this.state.freeformNotes.push(note);
    this.saveState();
    this.renderFreeformNotes();
  },

  renderFreeformNotes() {
    const layer = document.getElementById('freeform-notes-layer');
    if (!layer) return;

    const notes = this.state.freeformNotes || [];
    layer.innerHTML = notes.map((note) => `
      <div class="absolute pointer-events-auto w-48 p-3 rounded-2xl shadow-xl border ${note.colorClass} ${note.borderClass} transition-shadow select-none group"
           style="left: ${note.x}px; top: ${note.y}px;" id="fnote-${note.id}">
        <div class="flex items-center justify-between pb-1.5 mb-1 border-b border-black/15">
          <span class="text-[10px] font-mono font-bold tracking-wider uppercase opacity-80 cursor-grab active:cursor-grabbing"
                onpointerdown="app.startDragNote(event, '${note.id}')">
            📌 Post-it
          </span>
          <button onclick="app.deleteFreeformStickyNote('${note.id}')" class="text-xs font-bold opacity-60 hover:opacity-100 transition">✕</button>
        </div>
        <textarea placeholder="Escribe aquí tu pensamiento visual..." 
          oninput="app.updateFreeformStickyNote('${note.id}', this.value)"
          class="w-full bg-transparent border-none text-xs font-semibold focus:outline-none resize-none leading-relaxed placeholder-slate-800/50"
          rows="3">${note.text || ''}</textarea>
      </div>
    `).join('');
  },

  startDragNote(e, id) {
    e.preventDefault();
    const el = document.getElementById(`fnote-${id}`);
    if (!el) return;

    const note = (this.state.freeformNotes || []).find(n => n.id === id);
    if (!note) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = note.x;
    const origY = note.y;

    const onPointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      note.x = Math.max(10, origX + dx);
      note.y = Math.max(10, origY + dy);
      el.style.left = `${note.x}px`;
      el.style.top = `${note.y}px`;
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.saveState();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  },

  updateFreeformStickyNote(id, text) {
    const note = (this.state.freeformNotes || []).find(n => n.id === id);
    if (note) {
      note.text = text;
      this.saveState();
    }
  },

  deleteFreeformStickyNote(id) {
    if (!this.state.freeformNotes) return;
    this.state.freeformNotes = this.state.freeformNotes.filter(n => n.id !== id);
    this.saveState();
    this.renderFreeformNotes();
  },

  // --- INTEGRACIONES CON EL PENSADERO Y PROYECTOS ---
  saveFreeformToPensadero() {
    if (!this.freeform.canvas) return;

    // Comprimir miniatura a máx 600px en formato JPEG ligero para no colapsar la cuota de localStorage
    const origCanvas = this.freeform.canvas;
    const maxDim = 600;
    let w = origCanvas.width;
    let h = origCanvas.height;
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = w;
    thumbCanvas.height = h;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.fillStyle = '#0f172a';
    thumbCtx.fillRect(0, 0, w, h);
    thumbCtx.drawImage(origCanvas, 0, 0, w, h);
    const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);

    const desc = prompt("Breve título o nota para este dibujo en El Pensadero:", "Boceto / Mapa Mental en Freeform");
    if (desc === null) return;

    const item = {
      id: this.uid(),
      content: desc.trim() || "Boceto / Mapa Mental en Freeform",
      category: 'humo_azul',
      cognitiveWeight: 'medio',
      isPinned: true,
      drawingData: dataUrl,
      createdAt: new Date().toISOString()
    };

    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(item);
    this.saveState();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/pensadero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content, category: 'humo_azul' })
      }).catch(() => {});
    }

    this.triggerSensoryVictory();
    this.showToast('🎨 Boceto guardado en El Pensadero con éxito');
  },

  assignFreeformToProjectPrompt() {
    if (!this.freeform.canvas) return;
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      alert("No hay proyectos activos.");
      return;
    }

    const options = projects.map((p, i) => `${i + 1}. ${p.emoji || '🎯'} ${p.name}`).join('\n');
    const res = prompt(`¿A qué proyecto deseas vincular este diagrama/boceto?\n${options}`);
    const pIndex = parseInt(res, 10) - 1;
    if (!isNaN(pIndex) && projects[pIndex]) {
      const p = projects[pIndex];
      const taskTitle = prompt("Título para la tarea o entregable asociado:", "Diagrama visual y arquitectura");
      if (!taskTitle) return;

      if (!p.tasks) p.tasks = [];
      p.tasks.push({
        id: this.uid(),
        title: `🎨 ${taskTitle}`,
        column: 'proximo',
        effort: 'M',
        isMicroStep: false,
        createdAt: new Date().toISOString()
      });

      this.saveState();
      this.triggerSensoryVictory();
      alert(`✓ Diagrama vinculado como tarea en '${p.name}'.`);
    }
  },

  downloadFreeformPNG() {
    if (!this.freeform.canvas) return;
    const a = document.createElement('a');
    a.href = this.freeform.canvas.toDataURL('image/png');
    a.download = `proyectazo_freeform_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  loadDrawingIntoFreeform(pensaderoItemId) {
    const item = (this.state.pensadero || []).find(x => x.id === pensaderoItemId);
    if (!item || !item.drawingData) return;

    localStorage.setItem('proyectazo_freeform_saved', item.drawingData);
    this.navigate('freeform');
  },
});
