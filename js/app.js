// Aplicación principal. Expone `app` como global para los onclick="app.…" del HTML.

/**
 * Proyectazo — FocusFlow OS
 * Sistema Unificado de Gestión Multiproyecto para TDAH
 * Con El Pensadero, Ruido Marrón Sintetizado, Modo Zen y Soporte Spring Boot
 */
class ProyectazoApp {
  constructor() {
    this.STORAGE_KEY = 'nexus_orb_v3';
    const isHttp = window.location.protocol.startsWith('http');
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const host = window.location.hostname || 'localhost';

    // Si se ejecuta en la web (cualquier dominio o proxy HTTP/HTTPS), usar rutas relativas /api y /nexus/api/nexus
    // Si se ejecuta en desarrollo directo sin proxy (puerto 3000/5173) o archivo local (file://), usar puertos directos
    const isDevDirect = port === '3000' || port === '5173' || (!isHttp);

    this.API_BASE = (isHttp && !isDevDirect) 
      ? '/api' 
      : `http://${host}:8081/api`;

    this.NEXUS_API_BASE = (isHttp && !isDevDirect)
      ? '/nexus/api/nexus'
      : `http://${host}:8002/api/nexus`;
    this.installAuthFetch();
    this.currentView = 'soltar';
    this.hacerMode = 'lista'; // 'lista' | 'tablero'
    this.activeFilterEnergy = 'all'; // 'all' | 'baja' | 'media' | 'alta'
    this.batteryLevel = 100; // 100 | 50 | 20
    this.selectedKanbanProjectId = null;
    this.backendAvailable = false;
    this.tareasFilter = 'all'; // 'all' | 'enfoco' | 'proximo' | 'buzon' | 'cooling' | 'victorias'
    this.tareasProjectFilter = 'all';
    this.tareasSearchQuery = '';

    // Brown noise audio generator state
    this.audioCtx = null;
    this.brownNoiseNode = null;
    this.isNoisePlaying = false;

    this.timer = {
      durationMinutes: 25,
      secondsLeft: 25 * 60,
      isRunning: false,
      intervalId: null
    };
    this.colors = ['#10b981', '#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#64748b'];

    // Freeform canvas state
    this.freeform = {
      tool: 'pen', // 'pen' | 'brush' | 'highlighter' | 'eraser'
      color: '#10b981',
      size: 4,
      isDrawing: false,
      history: [],
      historyStep: -1,
      canvas: null,
      ctx: null,
      lastX: 0,
      lastY: 0
    };
    this.deferredPrompt = null;
    this.kanbanViewMode = 'columns'; // 'columns' | 'tinder'
    this.tinderCardIndex = 0;
    this.showIcebox = false;
    this.currentOneThingTask = null;
    this.currentDeepWork = { projectId: null, taskId: null };
    this.speechRecognition = null;
    this.isNexusListening = false;
    this.pendingNexusAction = null;
    this.pensaderoSmokeFilter = 'all';
    this.shaderEngine = new PensaderoShaderEngine();
    this.freeMoneyMonthly = 450; // Buffer mensual de dinero libre para fricción financiera TDAH

    this.loadState();
    this.captureEntitySignatures();
    this.ensureDeviceIdentity();
    this.initTheme();
    this.initEventListeners();
    this.renderColorPickers();
    this.navigate(this.currentView);
    this.checkBackendConnection();
    this.initGoogleMailStatus();
    this.initNotifications();
    this.initDesktopInstallPrompt();
  }

  // --- STATE & PERSISTENCE ---
  loadState() {
    const DEMO_PROJECT_IDS = new Set([
      'p-focusflow', 'p-cytohelix', 'p-cytocore', 
      'proj_focusflow', 'proj_cytohelix', 'proj_cytocore'
    ]);

    // Eliminar claves legacy de versiones anteriores que contenían datos mock/demo
    ['nexus_orb_v2', 'nexus_orb_v1', 'proyectazo_unified_v1', 'proyectazo_unified_v2', 'proyectazo_data'].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
      } else {
        this.state = this.getSeedData();
        this.saveState();
      }
    } catch (e) {
      console.error("Error al cargar estado, cargando seed:", e);
      this.state = this.getSeedData();
    }

    // Filtro riguroso: Eliminar cualquier proyecto o pensamiento de demostración heredado
    if (this.state.projects && Array.isArray(this.state.projects)) {
      this.state.projects = this.state.projects.filter(p => 
        p && !DEMO_PROJECT_IDS.has(p.id)
      );
    } else {
      this.state.projects = [];
    }

    if (this.state.pensadero && Array.isArray(this.state.pensadero)) {
      this.state.pensadero = this.state.pensadero.filter(item => 
        item && (!item.id || (!item.id.startsWith('pens_init_') && !item.id.startsWith('demo_')))
      );
      this.cleanDuplicateThoughts();
    } else {
      this.state.pensadero = [];
    }

    if (!this.state.settings) {
      this.state.settings = { sound: true, vibration: true, theme: 'theme-dark-soft', userName: 'Usuario' };
    }
    this.migrateLegacyRoutingKeywords();
    if (!this.state.inbox) {
      this.state.inbox = [];
    }
    if (!this.state.freeformNotes) {
      this.state.freeformNotes = [];
    }
    this.saveState();
  }

  cleanDuplicateThoughts() {
    if (!this.state.pensadero || !Array.isArray(this.state.pensadero)) return;
    const seen = new Set();
    this.state.pensadero = this.state.pensadero.filter(item => {
      if (!item || !item.content) return false;
      const contentKey = `${(item.content || '').trim().toLowerCase()}__${item.category || ''}`;
      if (seen.has(contentKey)) {
        return false;
      }
      seen.add(contentKey);
      return true;
    });
  }

  // --- SEGURIDAD: SANITIZACIÓN DEFENSIVA CONTRA XSS ---
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // --- NOTIFICACIONES EN COMPUTADORA Y MÓVIL ---
  async initNotifications() {
    if (!('Notification' in window)) {
      console.warn('Este dispositivo/navegador no soporta Notification API.');
      return;
    }
    if (Notification.permission === 'granted') {
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.notificationsEnabled = true;
    }
    // Iniciar centinela inteligente en segundo plano
    this.startNotificationSentinel();
    this.updateNotificationUI();
  }

  async requestNotificationPermission(userInitiated = false) {
    if (!('Notification' in window)) {
      alert('Tu navegador actual no admite notificaciones de escritorio/móvil.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateNotificationUI();
      if (permission === 'granted') {
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.notificationsEnabled = true;
        this.saveState();
        this.showToast('✓ Notificaciones activadas en computadora y celular');
        this.sendSystemNotification('🔔 Nexus OS — Notificaciones Activas', {
          body: 'Recibirás avisos de pensamientos críticos (Fuego) y recordatorios de ideas sin clasificar.',
          tag: 'nexus-welcome-notice'
        });
        return true;
      } else {
        if (userInitiated) {
          alert('Permiso de notificaciones no concedido. Puedes habilitarlo en el icono de candado o configuración de tu navegador.');
        }
        return false;
      }
    } catch (e) {
      console.error('Error solicitando permisos de notificación:', e);
      return false;
    }
  }

  async sendSystemNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const defaultOpts = {
      icon: './assets/logo_icon_sin_bk.png',
      badge: './favicon.svg',
      vibrate: [200, 100, 200],
      data: { url: './index.html#pensadero' }
    };
    const finalOpts = Object.assign(defaultOpts, options);

    // Prioridad 1: Notificaciones a través de Service Worker (PWA móvil y desktop con soporte en segundo plano)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, finalOpts);
          return true;
        }
      } catch (e) {
        console.warn('Fallback a Notification API estándar:', e);
      }
    }

    // Prioridad 2: API de Notificaciones estándar de navegador
    try {
      const n = new Notification(title, finalOpts);
      n.onclick = () => {
        window.focus();
        window.location.hash = 'pensadero';
      };
      return true;
    } catch (err) {
      console.warn('No se pudo desplegar notificación nativa:', err);
      return false;
    }
  }

  startNotificationSentinel() {
    if (this._sentinelTimer) clearInterval(this._sentinelTimer);
    // Centinela periódico cada 15 minutos
    this._sentinelTimer = setInterval(() => {
      this.checkThoughtsForNotifications();
    }, 15 * 60 * 1000);

    // Verificación inicial no intrusiva a los 8 segundos
    setTimeout(() => this.checkThoughtsForNotifications(true), 8000);
  }

  checkThoughtsForNotifications(initialCheck = false) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const items = this.state.pensadero || [];
    const redUrgent = items.filter(p => p.category === 'humo_rojo' && !p.isResolved);
    const unclassified = items.filter(p => (!p.category || p.category === 'humo_general') && !p.isResolved);

    if (redUrgent.length > 0) {
      this.sendSystemNotification(`🚨 Alerta Fuego: ${redUrgent.length} tarea(s) crítica(s)`, {
        body: `Hay ${redUrgent.length} pensamiento(s) urgente(s) sin resolver: "${redUrgent[0].content.slice(0, 50)}..."`,
        tag: 'sentinel-rojo',
        requireInteraction: true
      });
    } else if (unclassified.length >= 3 && !initialCheck) {
      this.sendSystemNotification(`✨ Pensadero: ${unclassified.length} ideas sin clasificar`, {
        body: `Tienes ${unclassified.length} pensamientos en el Orbe listos para canalizar a tus proyectos.`,
        tag: 'sentinel-unclassified'
      });
    }
  }

  updateNotificationUI() {
    const badge = document.getElementById('notification-permission-badge');
    const btn = document.getElementById('notification-toggle-btn');
    if (!badge) return;
    const granted = ('Notification' in window && Notification.permission === 'granted');
    if (granted) {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      badge.textContent = '✓ Activadas';
      if (btn) btn.innerHTML = '<span>🔔</span> <span>Enviar Notificación de Prueba</span>';
    } else {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
      badge.textContent = 'Pendiente';
      if (btn) btn.innerHTML = '<span>🔔</span> <span>Activar Notificaciones</span>';
    }
  }

  testNotificationNow() {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de sistema.');
      return;
    }
    if (Notification.permission !== 'granted') {
      this.requestNotificationPermission(true);
      return;
    }
    this.sendSystemNotification('🧪 Prueba de Notificación Exitosa', {
      body: '¡Excelente! Tu equipo y móvil están configurados para recibir alertas de pensamientos críticos e ideas sin clasificar.',
      tag: 'nexus-test-notification'
    });
    this.showToast('🔔 Notificación de prueba enviada a tu sistema');
  }

  // --- INSTALACIÓN Y DESCARGA A ESCRITORIO Y MÓVIL ---
  initDesktopInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredDesktopPrompt = e;
      this.deferredPrompt = e;
      const installBtns = document.querySelectorAll('.desktop-install-btn');
      installBtns.forEach(btn => btn.classList.remove('hidden'));
      const directBtn = document.getElementById('pwa-direct-install-btn');
      if (directBtn) directBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      this._deferredDesktopPrompt = null;
      this.deferredPrompt = null;
      this.showToast('🎉 ¡Nexus Orb instalado con éxito en tu dispositivo!');
      const lbl = document.getElementById('pwa-btn-label');
      if (lbl) lbl.textContent = '✓ App Instalada';
    });
  }

  downloadDesktopShortcut() {
    try {
      const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://nexus.cytohelix.com';
      const content = `[InternetShortcut]\r\nURL=${origin}/\r\nIconFile=${origin}/favicon.svg\r\nIconIndex=0\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,11\r\n`;
      const blob = new Blob([content], { type: 'application/internet-shortcut' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Nexus Cognitive OS.url';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.showToast('📥 ¡Descarga iniciada! Mueve Nexus Cognitive OS.url a tu escritorio');
    } catch (err) {
      console.error('Error al descargar acceso directo:', err);
      this.showToast('⚠️ No se pudo generar la descarga automática');
    }
  }

  downloadWindowsBat() {
    try {
      const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://nexus.cytohelix.com';
      const content = `@echo off\r\nchcp 65001 >nul\r\ntitle Nexus Cognitive OS\r\necho ========================================================\r\necho        🔮 Nexus Cognitive OS - Lanzador de Escritorio\r\necho ========================================================\r\necho Iniciando aplicacion en ventana independiente...\r\nwhere msedge >nul 2>nul && (start msedge --app="${origin}/" --enable-features=OverlayScrollbar && exit)\r\nwhere chrome >nul 2>nul && (start chrome --app="${origin}/" && exit)\r\nstart "" "${origin}/"\r\nexit\r\n`;
      const blob = new Blob([content], { type: 'application/x-bat' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'iniciar_nexus.bat';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.showToast('📥 Descargando iniciar_nexus.bat para Windows');
    } catch (err) {
      console.error('Error al descargar lanzador .bat:', err);
      this.showToast('⚠️ No se pudo descargar el archivo .bat');
    }
  }

  async installPWA() {
    const promptEvent = this.deferredPrompt || this._deferredDesktopPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          this.deferredPrompt = null;
          this._deferredDesktopPrompt = null;
          this.showToast('🎉 ¡Nexus Orb instalado con éxito en tu dispositivo!');
          const lbl = document.getElementById('pwa-btn-label');
          if (lbl) lbl.textContent = '✓ App Instalada';
          this.closeModal('modal-mobile-app');
          this.closeModal('modal-desktop-download');
          return;
        }
      } catch (e) {
        console.warn('Error en prompt de instalación:', e);
      }
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      this.showToast('✓ Nexus Orb ya está instalado y ejecutándose como app nativa');
      const lbl = document.getElementById('pwa-btn-label');
      if (lbl) lbl.textContent = '✓ App Instalada';
      return;
    }

    const ua = navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);

    if (isIos) {
      this.showToast('📱 En Safari (iPhone/iPad): Toca Compartir (⎋) y luego "Agregar a inicio" (➕)');
      this.openModal('modal-mobile-app');
    } else if (isAndroid) {
      this.showToast('📱 En Chrome (Android): Toca Menú (⋮) y selecciona "Instalar aplicación"');
      this.openModal('modal-mobile-app');
    } else {
      this.showToast('💻 Para escritorio: acceso directo descargado. También puedes usar ⊕ en la barra del navegador');
      this.downloadDesktopShortcut();
    }
  }

  async triggerDesktopInstall() {
    if (this._deferredDesktopPrompt) {
      try {
        this._deferredDesktopPrompt.prompt();
        const { outcome } = await this._deferredDesktopPrompt.userChoice;
        if (outcome === 'accepted') {
          this._deferredDesktopPrompt = null;
          this.showToast('🎉 ¡Nexus Orb instalado con éxito!');
          return;
        }
      } catch (e) {
        console.warn('Fallo al invocar prompt:', e);
      }
    }
    this.openModal('modal-desktop-download');
  }

  clearAllUserData() {
    if (confirm("¿Deseas reiniciar todos los datos a cero para empezar completamente limpio? Se borrarán proyectos y pensamientos locales y en el servidor.")) {
      this.state = this.getSeedData();
      this.saveState();
      if (this.backendAvailable) {
        fetch(`${this.API_BASE}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Confirm-Wipe': 'BORRAR-TODO' },
          body: JSON.stringify({ wipe: true, projects: [], inbox: [], pensadero: [] })
        }).catch(() => {});
      }
      window.location.reload();
    }
  }

  saveState() {
    try {
      this.stampChangedEntities();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
      this.captureEntitySignatures();
      this.updateBadges();
    } catch (e) {
      console.error("Error al guardar estado:", e);
    }
  }

  entitySignatureMap() {
    const map = {};
    (this.state?.projects || []).forEach(p => {
      if (!p || !p.id) return;
      map['p:' + p.id] = JSON.stringify([p.name, p.status, p.energy, p.nextAction, p.objective, p.context]);
      (p.tasks || []).forEach(t => {
        if (!t || !t.id) return;
        map['t:' + t.id] = JSON.stringify([t.title, t.column, t.effort, t.notes, t.isBureaucratic]);
      });
    });
    (this.state?.pensadero || []).forEach(item => {
      if (!item || !item.id) return;
      map['n:' + item.id] = JSON.stringify([item.content, item.category, item.isResolved, item.isPinned]);
    });
    return map;
  }

  captureEntitySignatures() {
    this._entitySig = this.entitySignatureMap();
  }

  stampChangedEntities() {
    if (!this._entitySig || !this.state) return;
    const now = new Date().toISOString();
    const prev = this._entitySig;
    (this.state.projects || []).forEach(p => {
      if (!p || !p.id) return;
      const sig = JSON.stringify([p.name, p.status, p.energy, p.nextAction, p.objective, p.context]);
      if (prev['p:' + p.id] && prev['p:' + p.id] !== sig) p.updatedAt = now;
      (p.tasks || []).forEach(t => {
        if (!t || !t.id) return;
        const ts = JSON.stringify([t.title, t.column, t.effort, t.notes, t.isBureaucratic]);
        if (prev['t:' + t.id] && prev['t:' + t.id] !== ts) {
          t.updatedAt = now;
          p.updatedAt = now;
        }
      });
    });
    (this.state.pensadero || []).forEach(item => {
      if (!item || !item.id) return;
      const sig = JSON.stringify([item.content, item.category, item.isResolved, item.isPinned]);
      if (prev['n:' + item.id] && prev['n:' + item.id] !== sig) item.updatedAt = now;
    });
  }

  getDefaultPensadero() {
    return [];
  }

  getSeedData() {
    return {
      settings: { sound: true, vibration: true, theme: 'theme-dark-soft', userName: 'Usuario' },
      pensadero: [],
      inbox: [],
      projects: [],
      freeformNotes: []
    };
  }

  uid() {
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  getPensaderoItem(target) {
    if (!this.state.pensadero || !target) return null;
    if (typeof target === 'object' && target.id) {
      return this.state.pensadero.find(x => x.id === target.id) || target;
    }
    if (typeof target === 'string') {
      return this.state.pensadero.find(x => x.id === target) || null;
    }
    if (typeof target === 'number') {
      return this.state.pensadero[target] || null;
    }
    return null;
  }

  getPensaderoIndex(target) {
    if (!this.state.pensadero) return -1;
    if (typeof target === 'string') {
      return this.state.pensadero.findIndex(x => x.id === target);
    }
    if (typeof target === 'number') {
      return target;
    }
    return -1;
  }

  daysSince(dateStr) {
    if (!dateStr) return 999;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  getFreshness(project) {
    if (project.nextActionType === 'esperar') return { class: 'sem-gray', label: 'Esperando respuesta', color: 'text-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    if (project.nextActionType === 'explorar') return { class: 'sem-blue', label: 'Explorando', color: 'text-sky-400', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
    if (project.nextActionType === 'decidir') return { class: 'sem-yellow', label: 'Decisión pendiente', color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

    const d = this.daysSince(project.lastActivity);
    if (d === 0) return { class: 'sem-green', label: 'Tocado hoy 🔥', color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (d === 1) return { class: 'sem-green', label: 'Ayer', color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (d < 4) return { class: 'sem-green', label: `Hace ${d} días`, color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (d < 8) return { class: 'sem-yellow', label: `Hace ${d} días`, color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { class: 'sem-red', label: `Hace ${d} días (fresco)`, color: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  }

  // --- THEME SYSTEM: CLARO / OSCURO SUAVE / NOCHE ---
  initTheme() {
    const saved = this.state.settings?.theme || 'theme-dark-soft';
    this.setTheme(saved);
  }

  setTheme(themeName) {
    const html = document.documentElement;
    html.classList.remove('theme-light', 'theme-dark-soft', 'theme-dark-deep', 'dark');

    const icon = document.getElementById('theme-icon');
    const themeColorMeta = document.getElementById('theme-color-meta');

    const isLight = (themeName === 'theme-light');
    const activeLogo = isLight ? 'assets/logo_icon_sin_bk.png' : 'assets/logo_dark.png';
    document.querySelectorAll('.app-logo-dynamic').forEach(img => {
      img.src = activeLogo;
    });

    const themeBtn = document.getElementById('theme-btn');

    if (isLight) {
      html.classList.add('theme-light');
      if (icon) icon.textContent = '☀️';
      if (themeBtn) themeBtn.title = 'Tema: Versión Clara (Stitch)';
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#f0f4f9');
    } else if (themeName === 'theme-dark-deep') {
      html.classList.add('theme-dark-deep', 'dark');
      if (icon) icon.textContent = '🌌';
      if (themeBtn) themeBtn.title = 'Tema: Noche Profunda (Void)';
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#0a0e18');
    } else {
      html.classList.add('theme-dark-soft', 'dark');
      if (icon) icon.textContent = '🌙';
      if (themeBtn) themeBtn.title = 'Tema: Versión Media (Cyber-Slate)';
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#171b26');
      themeName = 'theme-dark-soft';
    }

    if (this.state.settings) {
      this.state.settings.theme = themeName;
      this.saveState();
    }
  }

  cycleTheme() {
    const current = this.state.settings?.theme || 'theme-dark-soft';
    if (current === 'theme-light') {
      this.setTheme('theme-dark-soft');
    } else if (current === 'theme-dark-soft') {
      this.setTheme('theme-dark-deep');
    } else {
      this.setTheme('theme-light');
    }
  }

  initEventListeners() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openQuickCapture();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.logout();
      }
      if (e.key === 'Escape') {
        this.closeZenMode();
        this.closeAllModals();
      }
    });

    window.addEventListener('resize', () => this.applyFormFactor());
    this.applyFormFactor();

    // Escritorio: el atajo global de Electron abre el gadget de captura
    if (window.electronAPI?.onQuickCapture) {
      window.electronAPI.onQuickCapture(() => this.openOrbeQuickGadget());
    }

    // Estado de conexión: reflejarlo al instante y sincronizar al volver la red
    window.addEventListener('online', () => {
      this.checkBackendConnection();
      this.showToast('🌐 Conexión recuperada. Sincronizando…');
    });
    window.addEventListener('offline', () => {
      this.checkBackendConnection();
      this.showToast('📴 Sin conexión. Todo se sigue guardando en este equipo.');
    });

    // Pestaña oculta: pausar el orbe (GPU/batería). Al volver: reanudar y revisar el servidor.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Solo reanudar después si estaba girando (en vistas sin orbe ya está parado a propósito)
        this._orbPausedByVisibility = !!(this.shaderEngine && this.shaderEngine.animId);
        if (this._orbPausedByVisibility) this.shaderEngine.stopLoop();
      } else {
        if (this._orbPausedByVisibility && this.shaderEngine) this.shaderEngine.startLoop();
        this._orbPausedByVisibility = false;
        this.checkBackendConnection();
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('SW registration (normal en file://):', err);
      });
    }

    window.addEventListener('popstate', (e) => {
      // If any modal or zen mode is open, close it first
      const openModal = document.querySelector('.fixed.inset-0:not(.hidden)');
      if (openModal && openModal.id !== 'confetti-canvas') {
        this.closeZenMode();
        this.closeAllModals();
        return;
      }
      if (e.state && e.state.view) {
        this.navigate(e.state.view, false);
      } else {
        // Default to main entrance view: El Orbe
        this.navigate('soltar', false);
      }
    });

    // Initialize history state on first landing
    if (!window.location.hash) {
      window.history.replaceState({ view: this.currentView }, '', `#${this.currentView}`);
    } else {
      const hashView = window.location.hash.replace('#', '');
      if (hashView === 'zen' || hashView === 'ahora') {
        this.currentView = 'ahora';
      } else if (hashView === 'pensadero' || hashView === 'soltar' || hashView === 'gadget' || hashView === 'orbe') {
        this.currentView = 'soltar';
      } else if (hashView === 'kanban' || hashView === 'tareas' || hashView === 'pendientes' || hashView === 'hacer') {
        this.currentView = 'hacer';
      } else if (hashView === 'mas') {
        this.currentView = 'mas';
      } else if (hashView) {
        this.currentView = hashView;
      }
    }

    // Initialize Splash Intro on mobile if not seen yet
    setTimeout(() => this.initSplash(), 100);

    // Inicializar botón flotante Nexus IA arrastrable
    setTimeout(() => this.initDraggableNexusFab(), 120);
  }

  // --- DOCK FLOTANTE DUAL [ORBE + NEXUS IA] ARRASTRABLE (TOUCH & MOUSE CON PERSISTENCIA) ---
  initDraggableNexusFab() {
    const fab = document.getElementById('universal-nexus-fab');
    const handle = document.getElementById('nexus-fab-handle') || fab;
    if (!fab) return;

    // Restaurar posición previa guardada si es válida
    const saved = localStorage.getItem('nexus_fab_pos');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        if (typeof pos.left === 'number' && typeof pos.top === 'number') {
          const maxLeft = Math.max(16, window.innerWidth - (fab.offsetWidth || 180) - 16);
          const maxTop = Math.max(16, window.innerHeight - (fab.offsetHeight || 50) - 16);
          const clampLeft = Math.max(16, Math.min(pos.left, maxLeft));
          const clampTop = Math.max(16, Math.min(pos.top, maxTop));
          fab.style.left = `${clampLeft}px`;
          fab.style.top = `${clampTop}px`;
          fab.style.right = 'auto';
          fab.style.bottom = 'auto';
        }
      } catch(err) {}
    }

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    handle.onpointerdown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      try { handle.setPointerCapture(e.pointerId); } catch(err) {}
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = fab.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
    };

    handle.onpointermove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const maxLeft = Math.max(16, window.innerWidth - fab.offsetWidth - 16);
        const maxTop = Math.max(16, window.innerHeight - fab.offsetHeight - 16);

        newLeft = Math.max(16, Math.min(newLeft, maxLeft));
        newTop = Math.max(16, Math.min(newTop, maxTop));

        fab.style.left = `${newLeft}px`;
        fab.style.top = `${newTop}px`;
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
      }
    };

    const endFabDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch(err) {}
        if (hasMoved) {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem('nexus_fab_pos', JSON.stringify({ left: rect.left, top: rect.top }));
        }
      }
    };

    handle.onpointerup = endFabDrag;
    handle.onpointercancel = endFabDrag;

    // Auto-clamp en caso de rotación o redimensionamiento de pantalla
    window.addEventListener('resize', () => {
      const rect = fab.getBoundingClientRect();
      const maxLeft = Math.max(16, window.innerWidth - fab.offsetWidth - 16);
      const maxTop = Math.max(16, window.innerHeight - fab.offsetHeight - 16);
      if (rect.left > maxLeft || rect.top > maxTop) {
        fab.style.left = `${Math.min(rect.left, maxLeft)}px`;
        fab.style.top = `${Math.min(rect.top, maxTop)}px`;
      }
    });
  }

  openDualWidgetModal() {
    const modal = document.getElementById('modal-dual-widget');
    if (modal) modal.classList.remove('hidden');
  }

  // --- EQUIPO, FORMA Y SESIÓN ---
  ensureDeviceIdentity() {
    let id = localStorage.getItem('nexus_device_id');
    if (!id) {
      const rand = (crypto.randomUUID && crypto.randomUUID()) || ('dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
      id = rand.startsWith('dev-') ? rand : ('dev-' + rand);
      localStorage.setItem('nexus_device_id', id);
    }
    this.deviceId = id;
    return id;
  }

  detectFormFactor() {
    if (window.electronAPI && window.electronAPI.isElectron) return 'desktop';
    try {
      if (window.NexusNative && typeof window.NexusNative.isTablet === 'function' && window.NexusNative.isTablet()) {
        return 'tablet';
      }
      if (window.NexusNative && typeof window.NexusNative.getFormFactor === 'function') {
        const nativeForm = window.NexusNative.getFormFactor();
        if (nativeForm === 'tablet' || nativeForm === 'phone') return nativeForm;
      }
    } catch (e) {}
    const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const longSide = Math.max(window.innerWidth, window.innerHeight);
    if (coarse && shortSide >= 600) return 'tablet';
    if (coarse) return 'phone';
    if (window.innerWidth < 720) return 'phone';
    return 'desktop';
  }

  applyFormFactor() {
    const form = this.detectFormFactor();
    document.documentElement.dataset.form = form;
    const labels = { phone: 'Teléfono', tablet: 'Tablet', desktop: 'Escritorio' };
    const chip = document.getElementById('header-device-chip');
    if (chip) chip.textContent = labels[form] || form;
    if (window.electronAPI && window.electronAPI.isElectron) {
      document.documentElement.dataset.electron = '1';
      document.querySelectorAll('.desktop-install-btn').forEach(btn => btn.classList.add('hidden'));
    }
    const deviceLabel = document.getElementById('settings-device-label');
    if (deviceLabel) {
      const id = (this.deviceId || localStorage.getItem('nexus_device_id') || '').slice(0, 18);
      deviceLabel.textContent = `${labels[form] || form} · ${id}`;
    }
  }

  randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  pinRecord() {
    try { return JSON.parse(localStorage.getItem('nexus_pin_record') || 'null'); }
    catch (e) { return null; }
  }

  hasPin() {
    return !!(this.pinRecord() && this.pinRecord().hash);
  }

  bytesToB64(bytes) {
    let raw = '';
    for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
    return btoa(raw);
  }

  sha256Bytes(bytes) {
    const K = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const hi = Math.floor(bitLen / 0x100000000);
    view.setUint32(padded.length - 8, hi, false);
    view.setUint32(padded.length - 4, bitLen >>> 0, false);
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Uint32Array(64);
    for (let i = 0; i < padded.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let t = 0; t < 64; t++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d + temp1) >>> 0; d=c; c=b; b=a; a=(temp1 + temp2) >>> 0;
      }
      h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
      h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
    }
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v, idx) => outView.setUint32(idx * 4, v, false));
    return out;
  }

  hmacSha256(keyBytes, message) {
    let key = keyBytes;
    if (key.length > 64) key = this.sha256Bytes(key);
    const ipad = new Uint8Array(64);
    const opad = new Uint8Array(64);
    ipad.set(key);
    opad.set(key);
    for (let i = 0; i < 64; i++) {
      ipad[i] ^= 0x36;
      opad[i] ^= 0x5c;
    }
    const innerMsg = new Uint8Array(64 + message.length);
    innerMsg.set(ipad);
    innerMsg.set(message, 64);
    const inner = this.sha256Bytes(innerMsg);
    const outerMsg = new Uint8Array(64 + inner.length);
    outerMsg.set(opad);
    outerMsg.set(inner, 64);
    return this.sha256Bytes(outerMsg);
  }

  async pbkdf2Bytes(password, salt, iterations) {
    const block = new Uint8Array(salt.length + 4);
    block.set(salt);
    block[salt.length + 3] = 1;
    let u = this.hmacSha256(password, block);
    const out = new Uint8Array(u);
    for (let i = 1; i < iterations; i++) {
      u = this.hmacSha256(password, u);
      for (let j = 0; j < out.length; j++) out[j] ^= u[j];
      if (i % 250 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return out;
  }

  async hashPin(pin, saltB64, iterations) {
    const password = new TextEncoder().encode(String(pin));
    const salt = saltB64
      ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
      : crypto.getRandomValues(new Uint8Array(16));
    const rounds = iterations || (crypto.subtle ? 100000 : 8000);
    let digest = null;
    if (crypto.subtle && rounds >= 50000) {
      try {
        const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, key, 256);
        digest = new Uint8Array(bits);
      } catch (e) {
        digest = null;
      }
    }
    if (!digest) digest = await this.pbkdf2Bytes(password, salt, rounds);
    return { salt: this.bytesToB64(salt), hash: this.bytesToB64(digest), rounds };
  }

  async storePin(pin) {
    const record = await this.hashPin(pin);
    localStorage.setItem('nexus_pin_record', JSON.stringify(record));
  }

  async verifyPin(pin) {
    const record = this.pinRecord();
    if (!record) return true;
    const next = await this.hashPin(pin, record.salt, record.rounds);
    if (next.hash.length !== record.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < next.hash.length; i++) diff |= next.hash.charCodeAt(i) ^ record.hash.charCodeAt(i);
    return diff === 0;
  }

  lockoutRemaining() {
    const until = parseInt(localStorage.getItem('nexus_pin_lock_until') || '0', 10);
    return Math.max(0, until - Date.now());
  }

  registerPinFailure() {
    const fails = parseInt(localStorage.getItem('nexus_pin_fails') || '0', 10) + 1;
    localStorage.setItem('nexus_pin_fails', String(fails));
    if (fails >= 5) {
      const wait = Math.min(300, 15 * Math.pow(2, fails - 5)) * 1000;
      localStorage.setItem('nexus_pin_lock_until', String(Date.now() + wait));
    }
    return fails;
  }

  clearPinFailures() {
    localStorage.removeItem('nexus_pin_fails');
    localStorage.removeItem('nexus_pin_lock_until');
  }

  setLoginError(message) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = message;
    el.classList.remove('hidden');
  }

  // --- SISTEMA DE AUTENTICACIÓN, CREDENCIALES & SEGURIDAD ESCRITORIO ---
  // El cliente ya no guarda contraseñas: el backend valida con bcrypt y emite un token de sesión.
  installAuthFetch() {
    if (window.__nexusAuthFetchInstalled) return;
    window.__nexusAuthFetchInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    const ownHosts = new Set([window.location.hostname || 'localhost', 'localhost', '127.0.0.1']);
    const isOwnApi = (url) => {
      try {
        const u = new URL(url, window.location.href);
        return ownHosts.has(u.hostname) && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/nexus/'));
      } catch (e) { return false; }
    };
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const ours = isOwnApi(url);
      const isLogin = ours && url.includes('/api/auth/login');
      const token = localStorage.getItem('nexus_session_token');
      if (ours && !isLogin && token) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        init = { ...init, headers };
      }
      const res = await nativeFetch(input, init);
      if (ours && !isLogin && res.status === 401) this.handleSessionExpired();
      return res;
    };
  }

  clearLocalSession() {
    localStorage.removeItem('nexus_session_token');
    localStorage.removeItem('nexus_session_expires');
  }

  handleSessionExpired() {
    if (this._sessionExpiredShown) return;
    this._sessionExpiredShown = true;
    this.clearLocalSession();
    this.baulUnlocked = false;
    this.showLogin();
    this.showToast('🔐 Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
  }

  // PIN del Baúl: solo se guarda un hash SHA-256 con sal, nunca el código.
  hasBaulCode() {
    return !!localStorage.getItem('nexus_baul_hash');
  }

  async hashBaulCode(code, salt) {
    const data = new TextEncoder().encode(`${salt}:${code}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  async setBaulCode(code) {
    const salt = this.randomToken();
    localStorage.setItem('nexus_baul_salt', salt);
    localStorage.setItem('nexus_baul_hash', await this.hashBaulCode(code, salt));
    localStorage.removeItem('nexus_baul_code');
  }

  async verifyBaulCode(code) {
    const salt = localStorage.getItem('nexus_baul_salt') || '';
    const hash = localStorage.getItem('nexus_baul_hash');
    return !!hash && (await this.hashBaulCode(code, salt)) === hash;
  }

  async migrateLegacySecrets() {
    // Versiones anteriores guardaban la contraseña y el PIN en claro.
    localStorage.removeItem('nexus_auth_pass');
    localStorage.removeItem('nexus_auth_user');
    const legacyPin = localStorage.getItem('nexus_baul_code');
    if (legacyPin && !this.hasBaulCode()) {
      await this.setBaulCode(legacyPin);
    } else {
      localStorage.removeItem('nexus_baul_code');
    }
  }

  isDesktopApp() {
    const factor = this.detectFormFactor();
    return factor === 'desktop' || !!window.electronAPI?.isElectron || window.innerWidth >= 1024;
  }

  toggleLoginPasswordVisibility() {
    const input = document.getElementById('login-password-input');
    const text = document.getElementById('login-pwd-toggle-text');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (text) text.textContent = 'Ocultar';
    } else {
      input.type = 'password';
      if (text) text.textContent = 'Ver';
    }
  }

  // --- GESTIÓN DE SESIÓN PERSISTENTE (MULTIDÍA) & INTRO VIDEO ---
  initSplash() {
    this.migrateLegacySecrets().catch(() => {});
    const sessionToken = localStorage.getItem('nexus_session_token');
    const sessionExpires = parseInt(localStorage.getItem('nexus_session_expires') || '0', 10);
    const hasValidSession = sessionToken && sessionToken.length >= 20 && Date.now() < sessionExpires;
    const introSeen = localStorage.getItem('nexus_intro_seen_v1');

    if (hasValidSession) {
      this.applyUserSession();
      return;
    }

    if (!introSeen) {
      this.showSplash();
    } else {
      this.showLogin();
    }
  }

  showSplash() {
    const overlay = document.getElementById('nexus-splash-overlay');
    const video = document.getElementById('nexus-splash-video');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0', 'pointer-events-none');
      overlay.classList.add('opacity-100');
    }, 20);

    if (video) {
      video.currentTime = 0;
      video.muted = true;
      video.play().catch(e => console.log('Video autoplay:', e));
      video.onended = () => {
        this.dismissSplash();
      };
    }
  }

  dismissSplash() {
    const overlay = document.getElementById('nexus-splash-overlay');
    const video = document.getElementById('nexus-splash-video');
    if (video) {
      video.pause();
    }
    if (overlay) {
      overlay.classList.add('opacity-0', 'pointer-events-none');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 700);
    }
    localStorage.setItem('nexus_intro_seen_v1', 'true');

    // Si no hay sesión válida, pasar a la pantalla de login
    const sessionToken = localStorage.getItem('nexus_session_token');
    const sessionExpires = parseInt(localStorage.getItem('nexus_session_expires') || '0', 10);
    const sessionOk = sessionToken && sessionToken.length >= 20 && Date.now() < sessionExpires;
    if (!sessionOk) setTimeout(() => this.showLogin(), 250);
  }

  showLogin() {
    const overlay = document.getElementById('nexus-login-overlay');
    if (!overlay) return;
    const userInput = document.getElementById('login-username-input');
    const passInput = document.getElementById('login-password-input');
    if (userInput) {
      userInput.value = localStorage.getItem('nexus_session_user') || '';
    }
    if (passInput) passInput.value = '';
    this.setLoginError('');
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0', 'pointer-events-none');
      overlay.classList.add('opacity-100');
      if (passInput) passInput.focus();
    }, 20);
  }

  async handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const userInput = document.getElementById('login-username-input');
    const passInput = document.getElementById('login-password-input');
    const remember = document.getElementById('login-remember-session')?.checked ?? true;
    const userName = (userInput && userInput.value.trim()) || '';
    const password = (passInput && passInput.value) || '';

    let session;
    try {
      const res = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username: userName, password, remember })
      });
      if (res.status === 401) {
        session = null;
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        session = await res.json();
      }
    } catch (err) {
      this.setLoginError('No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }

    if (!session || !session.token) {
      this.setLoginError('Usuario o contraseña incorrectos.');
      if (passInput) {
        passInput.value = '';
        passInput.focus();
      }
      if ('vibrate' in navigator && this.state?.settings?.vibration) {
        try { navigator.vibrate([40, 60, 40]); } catch(err) {}
      }
      return;
    }

    localStorage.setItem('nexus_session_token', session.token);
    localStorage.setItem('nexus_session_expires', String(session.expiresAt));
    localStorage.setItem('nexus_session_user', session.username);
    localStorage.setItem('nexus_intro_seen_v1', 'true');
    this._sessionExpiredShown = false;
    if (passInput) passInput.value = '';

    if (!this.state.settings) this.state.settings = {};
    this.state.settings.userName = session.username;
    this.saveState();

    this.setLoginError('');
    this.hideLogin();
    this.applyUserSession();
    this.checkBackendConnection();
    this.triggerDopamineReward();
    if (this.shaderEngine) this.shaderEngine.pulseShockwave();
    this.showToast(`Bienvenido, ${session.username}. Sesión activa.`);
  }

  hideLogin() {
    const overlay = document.getElementById('nexus-login-overlay');
    if (!overlay) return;
    overlay.classList.add('opacity-0', 'pointer-events-none');
    overlay.classList.remove('opacity-100');
    setTimeout(() => overlay.classList.add('hidden'), 500);
  }

  // --- GUÍA DE BIENVENIDA ---
  maybeStartOnboarding() {
    if (localStorage.getItem('nexus_tour_done_v1')) return;
    setTimeout(() => this.startOnboarding(), 700);
  }

  startOnboarding() {
    // Se marca al abrir: aparece una sola vez y se puede repetir desde Ajustes
    localStorage.setItem('nexus_tour_done_v1', 'true');
    this._onboardingStep = 0;
    this.renderOnboardingStep();
    this.openModal('modal-onboarding');
  }

  getOnboardingSteps() {
    const legend = Object.values(SMOKE_PALETTE).map(c => `
      <li class="flex items-start gap-2">
        <span class="w-3 h-3 mt-0.5 rounded-full shrink-0 border border-white/20" style="background:${c.hex}"></span>
        <span><strong>${c.icon} ${c.name}</strong> <span class="theme-text-muted">— ${c.desc}</span></span>
      </li>`).join('');
    return [
      {
        title: '🫧 Vacía la mente',
        html: `<p>Mantén pulsado el orbe para <strong>hablar</strong>, o escribe abajo y pulsa <strong>Soltar</strong>.</p>
               <p class="theme-text-muted">No tienes que ordenar nada ahora. Primero sacarlo de la cabeza; clasificar viene después.</p>
               ${window.electronAPI?.quickCaptureShortcut ? `<p class="text-xs">⌨️ Desde cualquier aplicación: <kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">${window.electronAPI.quickCaptureShortcut}</kbd> abre la captura rápida.</p>` : ''}`
      },
      {
        title: '🎨 Cada color dice qué es',
        html: `<p>Desliza sobre el orbe o toca un color para clasificar el pensamiento.</p>
               <ul class="space-y-1.5 text-xs max-h-64 overflow-y-auto pr-1">${legend}</ul>`
      },
      {
        title: '🎯 Un paso, no una lista',
        html: `<p>En <strong>Hacer</strong> ves solo el siguiente micro-paso de 15 minutos. Como máximo hay <strong>3 tareas en foco</strong> a la vez.</p>
               <p class="theme-text-muted">Al terminar, haz <strong>Checkout</strong>: anota qué avanzaste y dónde retomar mañana.</p>`
      }
    ];
  }

  renderOnboardingStep() {
    const steps = this.getOnboardingSteps();
    const i = Math.max(0, Math.min(this._onboardingStep || 0, steps.length - 1));
    const body = document.getElementById('onboarding-body');
    if (body) body.innerHTML = `<h3 class="text-lg font-display font-bold">${steps[i].title}</h3>${steps[i].html}`;
    const progress = document.getElementById('onboarding-progress');
    if (progress) progress.textContent = `Paso ${i + 1} de ${steps.length}`;
    const prev = document.getElementById('onboarding-prev');
    if (prev) prev.classList.toggle('invisible', i === 0);
    const next = document.getElementById('onboarding-next');
    if (next) next.textContent = i === steps.length - 1 ? 'Empezar' : 'Siguiente';
  }

  nextOnboardingStep() {
    if ((this._onboardingStep || 0) >= this.getOnboardingSteps().length - 1) {
      this.finishOnboarding();
      return;
    }
    this._onboardingStep = (this._onboardingStep || 0) + 1;
    this.renderOnboardingStep();
  }

  prevOnboardingStep() {
    this._onboardingStep = Math.max(0, (this._onboardingStep || 0) - 1);
    this.renderOnboardingStep();
  }

  finishOnboarding() {
    localStorage.setItem('nexus_tour_done_v1', 'true');
    this.closeModal('modal-onboarding');
  }

  applyUserSession() {
    const userName = localStorage.getItem('nexus_session_user') || this.state.settings?.userName || '';
    const userBadge = document.getElementById('header-username-badge');
    if (userBadge) userBadge.textContent = userName;
    this.maybeStartOnboarding();
  }

  logout() {
    if (localStorage.getItem('nexus_session_token')) {
      fetch(`${this.API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
    }
    this.clearLocalSession();
    localStorage.removeItem('nexus_session_user');
    this.baulUnlocked = false;
    this.closeModal('modal-settings');
    this.showLogin();
  }

  // --- CONFIGURACIÓN DE SEGURIDAD (SOLO ESCRITORIO) ---
  async saveLoginCredentialsFromSettings() {
    if (!this.isDesktopApp()) {
      this.showToast('🔒 Acción bloqueada: Solo puedes modificar credenciales desde la aplicación web de escritorio.');
      return;
    }
    const userEl = document.getElementById('settings-auth-user');
    const newPassEl = document.getElementById('settings-auth-new-pass');
    const currentPassEl = document.getElementById('settings-auth-current-pass');

    const newUser = (userEl && userEl.value.trim()) || '';
    const newPass = (newPassEl && newPassEl.value) || '';
    const currentPass = (currentPassEl && currentPassEl.value) || '';

    if (!currentPass) {
      this.showToast('Escribe tu contraseña actual para autorizar el cambio.');
      if (currentPassEl) currentPassEl.focus();
      return;
    }

    if (!newUser || newUser.length < 2) {
      this.showToast('El usuario debe tener al menos 2 caracteres.');
      return;
    }

    if (newPass && newPass.length < 8) {
      this.showToast('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      const res = await fetch(`${this.API_BASE}/auth/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newUsername: newUser, newPassword: newPass || null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.showToast(`⚠️ ${data.error || 'No se pudieron actualizar las credenciales.'}`);
        return;
      }
      localStorage.setItem('nexus_session_token', data.token);
      localStorage.setItem('nexus_session_expires', String(data.expiresAt));
      localStorage.setItem('nexus_session_user', data.username);
      this.applyUserSession();
    } catch (err) {
      this.showToast('⚠️ Sin conexión con el servidor. Inténtalo de nuevo.');
      return;
    }

    if (newPassEl) newPassEl.value = '';
    if (currentPassEl) currentPassEl.value = '';
    this.showToast('✓ Credenciales actualizadas. Las demás sesiones se cerraron.');
  }

  async saveBaulCodeFromSettings() {
    if (!this.isDesktopApp()) {
      this.showToast('🔒 Acción bloqueada: Solo puedes cambiar el código del Baúl desde la aplicación web de escritorio.');
      return;
    }
    const currentCodeEl = document.getElementById('settings-baul-current-code');
    const newCodeEl = document.getElementById('settings-baul-new-code');

    const currentCode = (currentCodeEl && currentCodeEl.value.trim()) || '';
    const newCode = (newCodeEl && newCodeEl.value.trim()) || '';

    if (this.hasBaulCode() && !(await this.verifyBaulCode(currentCode))) {
      this.showToast('⚠️ El código actual del Baúl no coincide.');
      if (currentCodeEl) currentCodeEl.focus();
      return;
    }

    if (!/^\d{4,6}$/.test(newCode)) {
      this.showToast('El nuevo código debe ser de 4 a 6 números.');
      if (newCodeEl) newCodeEl.focus();
      return;
    }

    await this.setBaulCode(newCode);
    if (currentCodeEl) currentCodeEl.value = '';
    if (newCodeEl) newCodeEl.value = '';
    this.showToast('✓ Nuevo código del Baúl guardado.');
  }

  refreshSecuritySettings() {
    const isDesk = this.isDesktopApp();
    const badge = document.getElementById('settings-desktop-badge');
    const warning = document.getElementById('settings-desktop-only-warning');
    const saveLoginBtn = document.getElementById('settings-save-login-btn');
    const saveBaulBtn = document.getElementById('settings-save-baul-btn');
    const userInp = document.getElementById('settings-auth-user');
    if (userInp) userInp.value = localStorage.getItem('nexus_session_user') || '';

    if (badge) {
      badge.textContent = isDesk ? 'Escritorio (Habilitado)' : 'Móvil (Solo Lectura)';
      badge.className = isDesk
        ? 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
        : 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }

    if (warning) {
      warning.classList.toggle('hidden', isDesk);
    }

    const inputs = [
      'settings-auth-user',
      'settings-auth-new-pass',
      'settings-auth-current-pass',
      'settings-baul-current-code',
      'settings-baul-new-code'
    ];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = !isDesk;
        if (!isDesk) el.classList.add('opacity-50', 'cursor-not-allowed');
        else el.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });

    if (saveLoginBtn) {
      saveLoginBtn.disabled = !isDesk;
      if (!isDesk) saveLoginBtn.classList.add('opacity-50', 'cursor-not-allowed');
      else saveLoginBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    if (saveBaulBtn) {
      saveBaulBtn.disabled = !isDesk;
      if (!isDesk) saveBaulBtn.classList.add('opacity-50', 'cursor-not-allowed');
      else saveBaulBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  refreshPinSettings() {
    this.refreshSecuritySettings();
  }

  // --- SECCIÓN "BAÚL" (PENSAMIENTOS Y PROYECTOS CONFIDENCIALES) ---
  openBaul() {
    if (this.baulUnlocked) {
      this.navigate('baul');
      return;
    }
    const pinInp = document.getElementById('baul-pin-input');
    if (pinInp) pinInp.value = '';
    const err = document.getElementById('baul-unlock-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    const hint = document.getElementById('baul-unlock-hint');
    if (hint) {
      hint.textContent = this.hasBaulCode()
        ? 'Ingresa el código numérico de seguridad para acceder a tus pensamientos y proyectos privados.'
        : 'Primera vez: elige un código de 4 a 6 números. Será el PIN de tu Baúl.';
    }
    this.openModal('modal-baul-unlock');
    setTimeout(() => { if (pinInp) pinInp.focus(); }, 100);
  }

  baulKeypadPress(digit) {
    const pinInp = document.getElementById('baul-pin-input');
    if (!pinInp) return;
    if (pinInp.value.length < 6) {
      pinInp.value += digit;
    }
  }

  baulKeypadClear() {
    const pinInp = document.getElementById('baul-pin-input');
    if (pinInp) pinInp.value = '';
  }

  async submitBaulUnlock() {
    const pinInp = document.getElementById('baul-pin-input');
    const err = document.getElementById('baul-unlock-error');
    const typed = (pinInp && pinInp.value.trim()) || '';

    if (!this.hasBaulCode()) {
      if (!/^\d{4,6}$/.test(typed)) {
        if (err) {
          err.textContent = 'El PIN debe tener de 4 a 6 números.';
          err.classList.remove('hidden');
        }
        return;
      }
      await this.setBaulCode(typed);
      this.showToast('🔐 PIN del Baúl creado.');
    }

    if (await this.verifyBaulCode(typed)) {
      this.baulUnlocked = true;
      this.closeModal('modal-baul-unlock');
      this.showToast('🔓 Baúl Confidencial desbloqueado.');
      this.navigate('baul');
    } else {
      if (err) {
        err.textContent = 'Código incorrecto. Intenta de nuevo.';
        err.classList.remove('hidden');
      }
      if (pinInp) {
        pinInp.value = '';
        pinInp.focus();
      }
      if ('vibrate' in navigator && this.state?.settings?.vibration) {
        try { navigator.vibrate([40, 60, 40]); } catch(e) {}
      }
    }
  }

  lockBaul() {
    this.baulUnlocked = false;
    this.showToast('🔒 Baúl bloqueado de forma segura.');
    this.navigate('ahora');
  }

  setBaulTab(tab) {
    this.baulTab = tab;
    const container = document.getElementById('app-view');
    if (container) this.renderViewBaul(container);
  }

  saveBaulThought() {
    const inp = document.getElementById('baul-thought-input');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';

    const newItem = {
      id: this.uid(),
      content: text,
      category: 'humo_dorado',
      cognitiveWeight: 'medio',
      inBaul: true,
      createdAt: new Date().toISOString(),
      isPinned: false
    };

    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.saveState();
    this.showToast('🔒 Pensamiento guardado en el Baúl.');
    const container = document.getElementById('app-view');
    if (container) this.renderViewBaul(container);
  }

  deleteBaulThought(id) {
    if (!confirm('¿Eliminar esta nota privada del Baúl?')) return;
    this.state.pensadero = (this.state.pensadero || []).filter(x => x.id !== id);
    this.saveState();
    this.showToast('Nota eliminada del Baúl.');
    const container = document.getElementById('app-view');
    if (container) this.renderViewBaul(container);
  }

  unbaulThought(id) {
    const item = (this.state.pensadero || []).find(x => x.id === id);
    if (item) {
      item.inBaul = false;
      this.saveState();
      this.showToast('📤 Pensamiento desclasificado al Pensadero público.');
      const container = document.getElementById('app-view');
      if (container) this.renderViewBaul(container);
    }
  }

  sendThoughtToBaul(id) {
    const item = (this.state.pensadero || []).find(x => x.id === id);
    if (item) {
      item.inBaul = true;
      this.saveState();
      this.render();
      this.showToast('🔒 Pensamiento enviado al Baúl Confidencial.');
    }
  }

  createBaulProjectPrompt() {
    const name = prompt("Nombre del Proyecto Secreto para el Baúl:");
    if (!name || !name.trim()) return;
    const objective = prompt("Objetivo confidencial del proyecto (opcional):", "") || "";

    const newP = {
      id: this.uid(),
      name: name.trim(),
      emoji: '🔒',
      color: '#d97706',
      status: 'activo',
      energy: 'alta',
      objective: objective.trim(),
      nextAction: 'Definir primera tarea secreta',
      inBaul: true,
      createdAt: new Date().toISOString(),
      tasks: []
    };

    if (!this.state.projects) this.state.projects = [];
    this.state.projects.push(newP);
    this.saveState();
    this.showToast(`🔒 Proyecto "${name.trim()}" creado en el Baúl.`);
    const container = document.getElementById('app-view');
    if (container) this.renderViewBaul(container);
  }

  unbaulProject(id) {
    const p = (this.state.projects || []).find(x => x.id === id);
    if (p) {
      p.inBaul = false;
      this.saveState();
      this.showToast('📤 Proyecto desclasificado a proyectos públicos.');
      const container = document.getElementById('app-view');
      if (container) this.renderViewBaul(container);
    }
  }

  sendProjectToBaul(id) {
    const p = (this.state.projects || []).find(x => x.id === id);
    if (p) {
      p.inBaul = true;
      this.saveState();
      this.render();
      this.showToast(`🔒 Proyecto "${p.name}" enviado al Baúl.`);
    }
  }

  addBaulProjectTaskPrompt(projectId) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (!p) return;
    const title = prompt("Nueva tarea secreta:");
    if (!title || !title.trim()) return;

    if (!p.tasks) p.tasks = [];
    p.tasks.push({
      id: this.uid(),
      title: title.trim(),
      column: 'buzon',
      createdAt: new Date().toISOString()
    });
    this.saveState();
    const container = document.getElementById('app-view');
    if (container) this.renderViewBaul(container);
  }

  toggleBaulTaskDone(projectId, taskId, isDone) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (!p || !p.tasks) return;
    const t = p.tasks.find(x => x.id === taskId);
    if (t) {
      t.column = isDone ? 'victorias' : 'buzon';
      t.updatedAt = new Date().toISOString();
      this.saveState();
      if (isDone) this.triggerDopamineReward();
      const container = document.getElementById('app-view');
      if (container) this.renderViewBaul(container);
    }
  }

  renderViewBaul(container) {
    if (!this.baulUnlocked) {
      this.openBaul();
      return;
    }

    if (!this.baulTab) this.baulTab = 'pensamientos';

    const baulThoughts = (this.state.pensadero || []).filter(x => x.inBaul);
    const baulProjects = (this.state.projects || []).filter(p => p.inBaul);

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 py-2">

        <!-- Encabezado del Baúl -->
        <div class="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-amber-500/20">
              🔒
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl sm:text-2xl font-display font-extrabold text-white">Baúl Confidencial</h1>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Desbloqueado</span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Espacio privado y aislado de la vista pública para pensamientos, notas y proyectos confidenciales.</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button onclick="app.lockBaul()" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95">
              <span>🔒</span> <span>Bloquear y Salir</span>
            </button>
          </div>
        </div>

        <!-- Navegación interna del Baúl (Pestañas) -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onclick="app.setBaulTab('pensamientos')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${this.baulTab === 'pensamientos' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow' : 'text-slate-400 hover:text-white bg-slate-900/60'}">
            <span>📝</span> <span>Notas & Pensamientos Secretos (${baulThoughts.length})</span>
          </button>
          <button onclick="app.setBaulTab('proyectos')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${this.baulTab === 'proyectos' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow' : 'text-slate-400 hover:text-white bg-slate-900/60'}">
            <span>💼</span> <span>Proyectos Confidenciales (${baulProjects.length})</span>
          </button>
        </div>

        <!-- TAB 1: PENSAMIENTOS DEL BAÚL -->
        ${this.baulTab === 'pensamientos' ? `
          <div class="space-y-3">
            <!-- Captura directa al Baúl -->
            <div class="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-md flex gap-2">
              <input type="text" id="baul-thought-input" placeholder="Escribe un pensamiento confidencial o nota secreta..." 
                onkeydown="if(event.key==='Enter') app.saveBaulThought()"
                class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400" />
              <button onclick="app.saveBaulThought()" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0 transition flex items-center gap-1">
                <span>🔒</span> <span>Guardar en Baúl</span>
              </button>
            </div>

            <!-- Lista de Notas del Baúl -->
            <div class="space-y-2.5">
              ${baulThoughts.length === 0 ? `
                <div class="p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
                  <span class="text-3xl block mb-2">🔒</span>
                  <p class="font-semibold text-sm">Tu baúl de notas está vacío.</p>
                  <p class="text-xs mt-1 text-slate-500">Todo lo que guardes aquí estará protegido por tu código y oculto del resto de la app.</p>
                </div>
              ` : baulThoughts.map(item => `
                <div class="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[9px] font-mono px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">🔒 Confidencial</span>
                      <span class="text-[10px] font-mono text-slate-400">${new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-sm font-semibold text-slate-200 leading-relaxed">${this.escapeHtml(item.content)}</p>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0 justify-end">
                    <button onclick="app.unbaulThought('${item.id}')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition" title="Mover a Soltar público">
                      📤 Desclasificar
                    </button>
                    <button onclick="app.deleteBaulThought('${item.id}')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 text-xs transition" title="Eliminar permanentemente">
                      🗑️
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <!-- TAB 2: PROYECTOS CONFIDENCIALES DEL BAÚL -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Proyectos privados que no aparecen en el inicio ni en el radar público.</span>
              <button onclick="app.createBaulProjectPrompt()" class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition flex items-center gap-1">
                <span>+</span> Nuevo Proyecto Secreto
              </button>
            </div>

            <div class="space-y-3">
              ${baulProjects.length === 0 ? `
                <div class="p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
                  <span class="text-3xl block mb-2">💼</span>
                  <p class="font-semibold text-sm">No hay proyectos en el Baúl.</p>
                  <p class="text-xs mt-1 text-slate-500">Crea proyectos privados con sus propias metas y tareas protegidas por código.</p>
                </div>
              ` : baulProjects.map(p => `
                <div class="p-4 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-md space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">${p.emoji || '💼'}</span>
                      <div>
                        <h3 class="font-display font-bold text-base text-white">${this.escapeHtml(p.name)}</h3>
                        <p class="text-xs text-amber-200/80 mt-0.5">${this.escapeHtml(p.objective || 'Sin objetivo definido')}</p>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <button onclick="app.unbaulProject('${p.id}')" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition" title="Mover a proyectos públicos">
                        📤 Desclasificar
                      </button>
                      <button onclick="app.deleteProject('${p.id}')" class="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs border border-slate-700 transition" title="Eliminar proyecto">
                        🗑️
                      </button>
                    </div>
                  </div>

                  <!-- Tareas del Proyecto Secreto -->
                  <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-mono font-bold text-slate-300">Tareas Secretas (${(p.tasks || []).length})</span>
                      <button onclick="app.addBaulProjectTaskPrompt('${p.id}')" class="text-amber-400 hover:text-amber-300 font-bold text-[11px]">
                        + Agregar Tarea
                      </button>
                    </div>
                    <div class="space-y-1.5 pt-1">
                      ${(p.tasks || []).length === 0 ? `
                        <p class="text-xs text-slate-500 italic">Sin tareas aún en este proyecto privado.</p>
                      ` : (p.tasks || []).map(t => `
                        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                          <div class="flex items-center gap-2">
                            <input type="checkbox" ${t.column === 'victorias' ? 'checked' : ''} onchange="app.toggleBaulTaskDone('${p.id}', '${t.id}', this.checked)" class="rounded bg-slate-950 border-slate-700 text-amber-500" />
                            <span class="${t.column === 'victorias' ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}">${this.escapeHtml(t.title)}</span>
                          </div>
                          <button onclick="app.deleteTaskWithUndo('${p.id}', '${t.id}')" class="text-slate-500 hover:text-rose-400 text-[10px]">✕</button>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}

      </div>
    `;
  }

  // --- SÍNTESIS DE RUIDO MARRÓN FOCUS (WEB AUDIO API) ---
  toggleBrownNoise() {
    if (this.isNoisePlaying) {
      this.stopBrownNoise();
    } else {
      this.playBrownNoise();
    }
  }

  playBrownNoise() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Optimizado: buffer de 3 segundos en loop (ahorra 70% de memoria y sample calculations)
      const bufferSize = 3 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate volume
      }

      this.brownNoiseNode = this.audioCtx.createBufferSource();
      this.brownNoiseNode.buffer = noiseBuffer;
      this.brownNoiseNode.loop = true;

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.08, this.audioCtx.currentTime);

      this.brownNoiseNode.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      this.brownNoiseNode.start();
      this.isNoisePlaying = true;
      this.updateNoiseUI(true);
    } catch (e) {
      console.error("Error al iniciar audio:", e);
    }
  }

  stopBrownNoise() {
    if (this.brownNoiseNode) {
      try {
        this.brownNoiseNode.stop();
        this.brownNoiseNode.disconnect();
      } catch (e) {}
      this.brownNoiseNode = null;
    }
    this.isNoisePlaying = false;
    this.updateNoiseUI(false);
  }

  updateNoiseUI(playing) {
    const stateText = playing ? 'ON 🟢' : 'OFF';
    const barBtn = document.getElementById('bar-noise-state');
    const zenBtn = document.getElementById('zen-noise-state');
    if (barBtn) {
      barBtn.textContent = stateText;
      barBtn.className = playing ? 'font-bold text-emerald-400' : 'font-bold text-slate-400';
    }
    if (zenBtn) {
      zenBtn.textContent = stateText;
      zenBtn.className = playing ? 'font-bold text-emerald-400' : 'font-bold text-slate-400';
    }
    // Animated Frequency Wave bars in Stitch Zen view
    const waveBars = document.getElementById('zen-wave-bars');
    if (waveBars) {
      waveBars.querySelectorAll('span').forEach(sp => {
        if (playing) {
          sp.classList.add('animate-pulse');
          sp.classList.remove('opacity-30');
        } else {
          sp.classList.remove('animate-pulse');
          sp.classList.add('opacity-30');
        }
      });
    }
  }

  // --- MODO ZEN / HIPERFOCO ---
  openZenMode(project, taskTitle) {
    this.zenProjectId = project?.id || null;
    const overlay = document.getElementById('zen-overlay');
    document.getElementById('zen-project-tag').textContent = `${project.emoji || '🎯'} ${project.name}`;
    document.getElementById('zen-task-title').textContent = taskTitle || project.nextAction || 'Enfoque en tarea';
    overlay.classList.add('active');

    // Sincronizar temporizador
    this.updateTimerDisplay();
    if (!this.timer.isRunning) {
      this.startPauseTimer();
    }
  }

  closeZenMode() {
    const overlay = document.getElementById('zen-overlay');
    if (overlay) overlay.classList.remove('active');
    if (this.isNoisePlaying) {
      this.toggleBrownNoise();
    }
  }

  completeZenTask() {
    this.closeZenMode();
    this.triggerDopamineReward();
    const projectId = this.getFocusProjectId();
    if (projectId) this.openCheckout(projectId);
  }

  // --- DESCOMPONEDOR DE TAREAS (MASTICADOR) ---
  promptMasticarTask(taskTitle) {
    const text = prompt("¿Qué tarea sientes abrumadora?", taskTitle || "");
    if (!text || !text.trim()) return;

    const p = this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0];
    if (!p) return;

    const step1 = `1. Preparar recursos para: ${text.slice(0, 30)}`;
    const step2 = `2. Primer borrador / estructura de: ${text.slice(0, 30)}`;
    const step3 = `3. Revisión rápida y conclusión de: ${text.slice(0, 30)}`;

    if (!p.tasks) p.tasks = [];
    p.tasks.push(
      { id: this.uid(), title: step1, column: 'proximo', effort: 'S', createdAt: new Date().toISOString() },
      { id: this.uid(), title: step2, column: 'proximo', effort: 'S', createdAt: new Date().toISOString() },
      { id: this.uid(), title: step3, column: 'proximo', effort: 'S', createdAt: new Date().toISOString() }
    );

    this.saveState();
    this.render();
    alert(`✓ ¡Tarea masticada! Se crearon 3 micro-pasos ligeros en 'Próximo Paso' de ${p.name}.`);
  }

  // --- BACKEND SPRING BOOT SYNC ---
  async checkBackendConnection() {
    if (!navigator.onLine) {
      this.setOfflineStatus();
      return;
    }
    const badge = document.getElementById('backend-status-badge');
    const pill = document.getElementById('sync-status-pill');
    const text = document.getElementById('sync-status-text');

    try {
      const res = await fetch(`${this.API_BASE}/projects`, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        this.backendAvailable = true;
        if (badge) {
          badge.textContent = '🟢 Conectado';
          badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
        if (text) text.textContent = 'Nube';
        if (pill) {
          pill.className = 'text-[9px] font-mono font-bold px-2 py-0.2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1';
          pill.title = 'Conectado a la API: Los datos se sincronizan con la nube';
        }

        if (!this._syncing) this.syncWithBackend(false);
        return;
      }
    } catch (e) {}

    this.setOfflineStatus();
  }

  setOfflineStatus() {
    const badge = document.getElementById('backend-status-badge');
    const pill = document.getElementById('sync-status-pill');
    const text = document.getElementById('sync-status-text');
    this.backendAvailable = false;
    if (badge) {
      badge.textContent = '🟡 Local Offline';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
    if (text) text.textContent = 'Local';
    if (pill) {
      pill.className = 'text-[9px] font-mono font-bold px-2 py-0.2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-1';
      pill.title = 'Guardado de forma segura en este aparato (offline)';
    }
  }

  isoTime(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  mergeRemoteIntoLocal(data) {
    if (!data) return;
    const demoIds = new Set(['p-focusflow', 'p-cytohelix', 'p-cytocore', 'proj_focusflow', 'proj_cytohelix', 'proj_cytocore']);
    if (!this.state.projects) this.state.projects = [];
    if (!this.state.pensadero) this.state.pensadero = [];
    if (!this.state.inbox) this.state.inbox = [];

    for (const remote of data.projects || []) {
      if (!remote || !remote.id) continue;
      if (demoIds.has(remote.id)) continue;
      let local = this.state.projects.find(p => p.id === remote.id);
      if (!local) {
        this.state.projects.push(remote);
        continue;
      }
      const remoteNewer = this.isoTime(remote.updatedAt || remote.lastActivity) > this.isoTime(local.updatedAt || local.lastActivity);
      if (remoteNewer) {
        const tasks = local.tasks || [];
        Object.assign(local, remote, { tasks });
      }
      const byId = new Map((local.tasks || []).filter(t => t && t.id).map(t => [t.id, t]));
      for (const remoteTask of remote.tasks || []) {
        if (!remoteTask || !remoteTask.id) continue;
        const localTask = byId.get(remoteTask.id);
        if (!localTask) {
          if (!local.tasks) local.tasks = [];
          local.tasks.push(remoteTask);
        } else if (this.isoTime(remoteTask.updatedAt) > this.isoTime(localTask.updatedAt)) {
          Object.assign(localTask, remoteTask);
        }
      }
    }

    for (const remote of data.pensadero || []) {
      if (!remote || !remote.id || remote.id.startsWith('pens_init_') || remote.id.startsWith('demo_')) continue;
      const content = (remote.content || '').trim();
      if (!content) continue;
      const local = this.state.pensadero.find(item => item.id === remote.id);
      if (!local) this.state.pensadero.push(remote);
      else if (this.isoTime(remote.updatedAt) > this.isoTime(local.updatedAt)) Object.assign(local, remote);
    }

    for (const remote of data.inbox || []) {
      if (!remote || !remote.id) continue;
      if (!this.state.inbox.some(item => item.id === remote.id)) this.state.inbox.push(remote);
    }
    if (typeof this.cleanDuplicateThoughts === 'function') this.cleanDuplicateThoughts();
  }

  async syncWithBackend(showNotification = true) {
    if (this._syncing) return;
    this._syncing = true;
    if (!this.backendAvailable) {
      await this.checkBackendConnection();
      if (!this.backendAvailable) {
        this._syncing = false;
        if (showNotification) this.showToast('El servidor no está disponible. Todo sigue guardado en este equipo.');
        return;
      }
    }

    const pillText = document.getElementById('sync-status-text');
    if (pillText) pillText.textContent = 'Sincronizando';
    try {
      const pull = await fetch(`${this.API_BASE}/sync`, { headers: { 'Accept': 'application/json' } });
      if (pull.ok) this.mergeRemoteIntoLocal(await pull.json());

      const payload = {
        deviceId: this.deviceId || localStorage.getItem('nexus_device_id'),
        deviceLabel: document.documentElement.dataset.form || 'unknown',
        projects: this.state.projects || [],
        inbox: this.state.inbox || [],
        pensadero: this.state.pensadero || []
      };
      const res = await fetch(`${this.API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('sync ' + res.status);
      const data = await res.json();
      this.mergeRemoteIntoLocal(data);
      this.saveState();
      this.render();
      if (pillText) pillText.textContent = 'En todos';
      if (showNotification) this.showToast('Listo. Este equipo quedó al día con los demás.');
    } catch (err) {
      console.warn('Fallo al sincronizar con backend:', err);
      if (pillText) pillText.textContent = 'Solo aquí';
      if (showNotification) this.showToast('Sigue guardado en este equipo. La red falló un momento.');
    } finally {
      this._syncing = false;
    }
  }

  renderColorPickers() {
    const container = document.getElementById('project-color-picker');
    if (!container) return;
    container.innerHTML = this.colors.map(c => `
      <button type="button" onclick="app.selectProjectColor('${c}')" class="color-chip w-6 h-6 rounded-full border-2 transition-all ${c === '#10b981' ? 'scale-110 border-white' : 'border-transparent'}" style="background-color: ${c};" data-color="${c}"></button>
    `).join('');
  }

  selectProjectColor(color) {
    document.getElementById('project-form-color').value = color;
    document.querySelectorAll('.color-chip').forEach(btn => {
      if (btn.getAttribute('data-color') === color) {
        btn.classList.add('scale-110', 'border-white');
        btn.classList.remove('border-transparent');
      } else {
        btn.classList.remove('scale-110', 'border-white');
        btn.classList.add('border-transparent');
      }
    });
  }

  updateBadges() {
    const thoughts = (this.state.pensadero || []).filter(x => !x.inBaul).length;
    let pending = 0;
    (this.state.projects || []).filter(p => !p.inBaul).forEach(p => {
      pending += (p.tasks || []).filter(t => t.column !== 'victorias').length;
    });
    const paint = (id, count) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = count;
      el.classList.toggle('hidden', count <= 0);
    };
    const deskThoughts = document.getElementById('pensadero-count-badge');
    const deskTasks = document.getElementById('tareas-count-badge');
    if (deskThoughts) deskThoughts.textContent = thoughts;
    if (deskTasks) deskTasks.textContent = pending;
    paint('pensadero-count-mobile', thoughts);
    paint('tareas-count-mobile', pending);
    this.renderStickyRedAlert();
  }

  renderStickyRedAlert() {
    const bar = document.getElementById('sticky-red-alert-bar');
    if (!bar) return;
    const redItems = (this.state.pensadero || []).filter(item => 
      !item.inBaul && (item.category === 'humo_rojo' || item.category === 'duda') && !item.isResolved
    );

    if (redItems.length === 0) {
      bar.className = 'hidden';
      bar.innerHTML = '';
      return;
    }

    const topRed = redItems[0];
    bar.className = 'sticky top-16 z-40 bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 border-b border-rose-500/50 px-4 py-2.5 shadow-xl shadow-rose-950/40 text-xs flex flex-wrap items-center justify-between gap-3 text-rose-100 animate-pulse';
    bar.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider shadow">🚨 FUEGO ACTIVO (${redItems.length})</span>
        <span class="font-bold text-white text-xs sm:text-sm line-clamp-1">${topRed.content}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="app.syncRedSmokeToGoogle('${topRed.id}', '${encodeURIComponent(topRed.content)}')" class="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition flex items-center gap-1" title="Sincronizar con Google Calendar">
          <span>📅</span> Google Sync
        </button>
        <button onclick="app.resolveRedSmoke('${topRed.id}')" class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1" title="Marcar como atendido">
          <span>✓</span> Apagar Fuego
        </button>
        <button onclick="app.navigate('pensadero'); app.filterPensaderoSmoke('humo_rojo');" class="px-2.5 py-1 rounded-xl bg-slate-800 text-rose-300 hover:text-white text-xs font-semibold">
          Ver todos (${redItems.length}) →
        </button>
      </div>
    `;
  }

  resolveRedSmoke(id) {
    const item = (this.state.pensadero || []).find(it => it.id === id);
    if (item) {
      item.isResolved = true;
      this.saveState();
      this.render();
      if (this.shaderEngine) {
        this.shaderEngine.setSmokeState('humo_blanco');
        this.shaderEngine.pulseShockwave();
      }
      this.showToast("✓ Fuego atendido y apagado.");
    }
  }

  // --- NAVIGATION (4 DESTINOS TDAH) ---
  navigate(viewName, pushHistory = true) {
    // Normalizar alias a las 4 vistas principales
    if (viewName === 'zen') viewName = 'ahora';
    if (viewName === 'pensadero' || viewName === 'orbe') viewName = 'soltar';
    if (viewName === 'kanban' || viewName === 'tareas' || viewName === 'pendientes') viewName = 'hacer';

    // Auto-bloqueo del Baúl al salir a cualquier otra pantalla
    if (viewName !== 'baul') {
      this.baulUnlocked = false;
    }

    if (this.currentView !== viewName && pushHistory) {
      window.history.pushState({ view: viewName }, '', `#${viewName}`);
    }
    this.currentView = viewName;

    // Si salimos de soltar, detener el loop del shader para ahorrar 85% de GPU y batería
    if (viewName !== 'soltar' && viewName !== 'pensadero' && viewName !== 'orbe' && this.shaderEngine) {
      this.shaderEngine.stopLoop();
    }

    // Subtítulo dinámico en el Header
    const sub = document.getElementById('header-view-subtitle');
    if (sub) {
      const titles = {
        soltar: '🔮 Orbe',
        ahora: '🎯 Ahora',
        hacer: '⚡ Hacer',
        mas: '⋯ Más',
        baul: '🔒 Baúl Confidencial',
        hoy: '💼 Proyectos',
        freeform: '🎨 Lienzo Freeform',
        bitacora: '📜 Bitácora',
        radar: '📡 Radar de Enfoque'
      };
      sub.textContent = titles[viewName] || 'Proyectazo';
    }

    // Destacar botones en Desktop Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const v = btn.getAttribute('data-view');
      if (v === viewName) {
        btn.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
        btn.classList.remove('theme-text-muted');
      } else {
        btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
        btn.classList.add('theme-text-muted');
      }
    });

    // Destacar botones en Barra Inferior Móvil (4 destinos TDAH)
    document.querySelectorAll('.bnav-btn').forEach(btn => {
      const v = btn.getAttribute('data-view');
      if (v === viewName) {
        btn.classList.add('text-cyan-400', 'font-bold');
        btn.classList.remove('text-slate-400', 'opacity-70');
      } else {
        btn.classList.remove('text-cyan-400', 'font-bold');
        btn.classList.add('text-slate-400', 'opacity-70');
      }
    });

    // Vibración háptica en móvil
    if ('vibrate' in navigator && this.state?.settings?.vibration) {
      try { navigator.vibrate(12); } catch(e) {}
    }

    this.render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  render() {
    const container = document.getElementById('app-view');
    if (!container) return;

    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      if (this.currentView === 'soltar' || this.currentView === 'pensadero') {
        mainContainer.className = "flex-1 w-full max-w-full min-w-0 p-2 sm:p-4 pb-28 xl:pb-6 min-h-[calc(100dvh-4.25rem)] flex flex-col";
        container.className = "flex-1 flex flex-col h-full w-full max-w-full min-w-0 fade-enter";
      } else if (this.currentView === 'ahora' || this.currentView === 'zen') {
        mainContainer.className = "flex-1 max-w-2xl w-full mx-auto min-w-0 p-3 sm:p-6 pb-28 xl:pb-8";
        container.className = "w-full max-w-full min-w-0 fade-enter";
      } else {
        mainContainer.className = "flex-1 max-w-7xl w-full mx-auto min-w-0 p-3 sm:p-6 pb-28 xl:pb-8";
        container.className = "w-full max-w-full min-w-0 fade-enter";
      }
    }

    this.updateBadges();

    switch (this.currentView) {
      case 'ahora':
      case 'zen':
        this.renderViewAhora(container);
        break;
      case 'soltar':
      case 'pensadero':
        this.renderViewSoltar(container);
        break;
      case 'hacer':
      case 'kanban':
      case 'tareas':
      case 'pendientes':
        this.renderViewHacer(container);
        break;
      case 'mas':
        this.renderViewMas(container);
        break;
      case 'hoy':
        this.renderViewHoy(container);
        break;
      case 'freeform':
        this.renderViewFreeform(container);
        break;
      case 'bitacora':
        this.renderViewBitacora(container);
        break;
      case 'radar':
        this.renderViewRadar(container);
        break;
      case 'baul':
        this.renderViewBaul(container);
        break;
      default:
        this.renderViewAhora(container);
    }
  }

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

    const pendingTasks = (activeProject.tasks || []).filter(t => t.column !== 'victorias');
    const activeTask = pendingTasks.find(t => t.column === 'enfoco') || pendingTasks.find(t => t.column === 'proximo') || pendingTasks[0] || {
      id: 'task-temp',
      title: activeProject.nextAction || 'Avanzar en el micro-paso de 15 minutos',
      notes: ''
    };

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
            <span class="font-bold text-white">${activeProject.name}</span>
            <span class="text-slate-600">•</span>
            <button onclick="app.navigate('hacer')" class="text-cyan-400 hover:text-cyan-300 font-medium text-[11px] underline" title="Ver lista de tareas de este proyecto">
              Cambiar tarea
            </button>
          </div>

          <!-- Título de la Única Tarea (15 min) -->
          <div class="flex flex-col items-center px-2 max-w-lg">
            <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-semibold">¿Cuál es el micro-paso de 15 minutos?</span>
            <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight leading-snug mt-1">
              ${activeTask.title}
            </h1>
            ${activeTask.notes ? `<p class="text-xs text-slate-400 mt-1 max-w-md italic truncate">"${activeTask.notes}"</p>` : ''}
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
          <button onclick="app.completeSprintAndRegisterVictory('${activeProject.id}', '${activeTask.id}', '${encodeURIComponent(activeTask.title)}')"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm shadow-md active:scale-95 transition">
            <span>✓</span>
            <span>Listo, registrar el avance</span>
          </button>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="app.breakdownTaskWithAI('${encodeURIComponent(activeTask.title)}', '${activeProject.id}')"
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
  }

  renderViewZen(container) {
    this.renderViewAhora(container);
  }

  addTimerMinutes(min) {
    this.timer.secondsLeft += min * 60;
    this.updateTimerDisplay();
    this.updateZenViewProgress();
  }

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
  }

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
  }

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
  }

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
  }

  setNoiseVolume(val) {
    if (this.audioCtx && this.brownGainNode) {
      this.brownGainNode.gain.setValueAtTime(parseFloat(val) * 0.12, this.audioCtx.currentTime);
    }
  }

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
  }

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

      ${this.renderStalledProjectsCard()}

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
                <button onclick="app.promptMasticarTask('${heroProject.nextAction}')" class="text-[10px] theme-text-muted hover:text-white px-2 py-0.5 rounded border theme-border hover:brightness-110" title="Desglosar en 3 micro-pasos de 5 min">
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
            <button onclick="app.openZenMode(app.state.projects.find(p=>p.id==='${heroProject.id}'), '${heroProject.nextAction}')" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition">
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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  setBattery(level) {
    this.batteryLevel = level;
    this.render();
  }

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
          <button onclick="app.launchZenForTask('${project.id}', '', '${encodeURIComponent(project.nextAction || project.name)}')" class="py-2 px-2.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 font-semibold text-xs transition" title="Llevar a Modo Zen">
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
  }

  skipProjectWithoutGuilt(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.render();
    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projectId}/skip`, { method: 'POST' }).catch(() => {});
    }
  }

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
                🔵 Hacer (${blueCount})
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
  }

  renderViewPensadero(container) {
    this.renderViewSoltar(container);
  }

  quickSoltar() {
    const inp = document.getElementById('soltar-input') || document.getElementById('pensadero-direct-dump-input');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';
    const selectedColor = (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all') ? this.pensaderoSmokeFilter : 'humo_general';
    this.quickDumpToOrbe(text, selectedColor);
    const meta = SMOKE_PALETTE[selectedColor] || SMOKE_PALETTE.humo_general;
    this.showToast(`✓ Depositado en Orbe (${meta.icon} ${meta.name}): "${text.slice(0, 30)}..."`);
    if (this.shaderEngine) this.shaderEngine.pulseShockwave();
    this.triggerDopamineReward();
    setTimeout(() => {
      const reInp = document.getElementById('soltar-input') || document.getElementById('pensadero-direct-dump-input');
      if (reInp) reInp.focus();
    }, 100);
  }

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
  }

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
  }

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
  }

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
    const projects = this.state.projects || [];
    for (const p of projects) {
      const pNameLower = p.name.toLowerCase();
      if (lower.includes(pNameLower) || lower.includes(pNameLower.replace(' ', ''))) {
        // Asignar directo a este proyecto
        const cleanTitle = clean.replace(new RegExp('(mandar|agregar|mover|pasar)\s+(a|al\s+proyecto)\s+' + pNameLower, 'i'), '').trim() || clean;
        if (!p.tasks) p.tasks = [];
        p.tasks.push({
          id: this.uid(),
          title: cleanTitle,
          column: 'buzon',
          effort: 'S',
          createdAt: new Date().toISOString()
        });
        this.saveState();
        this.showToast(`🚀 Tarea enviada por voz a ${p.name}`, () => this.openKanbanProject(p.id));
        return;
      }
    }

    // Si no es comando de proyecto, depositar como pensamiento con autoclasificación
    const currentCat = (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all') ? this.pensaderoSmokeFilter : 'humo_general';
    this.quickDumpToOrbe(clean, currentCat);
    this.showToast(`✨ Pensamiento depositado en el Orbe: "${clean.slice(0, 30)}..."`);
  }

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
  }

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
  }

  triggerShockwave() {
    if (this.shaderEngine) {
      this.shaderEngine.pulseShockwave();
    }
  }

  cycleShaderPalette() {
    if (this.shaderEngine) {
      this.shaderEngine.randomizeSmoke();
    }
  }

  filterPensaderoSmoke(smokeType) {
    this.pensaderoSmokeFilter = smokeType;
    if (this.shaderEngine && smokeType !== 'all') {
      this.shaderEngine.setSmokeState(smokeType);
    }
    this.render();
  }

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
  }

  submitPensaderoJARVIS() {
    if (this._isSubmittingThought) return;
    const input = document.getElementById('pensadero-jarvis-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    this._isSubmittingThought = true;
    setTimeout(() => { this._isSubmittingThought = false; }, 400);

    const cat = document.getElementById('pensadero-cat-val')?.value || 'humo_dorado';
    input.value = ''; // Limpiar de inmediato para prevenir re-envíos por doble evento Enter/Touch

    // Protección contra duplicados en ventana corta (3 seg)
    const isDuplicate = (this.state.pensadero || []).some(p => 
      (p.content || '').trim().toLowerCase() === text.toLowerCase() && 
      p.category === cat && 
      (Date.now() - new Date(p.createdAt).getTime() < 3000)
    );
    if (isDuplicate) return;

    const meta = SMOKE_PALETTE[cat] || SMOKE_PALETTE.humo_dorado;
    const newItem = {
      id: this.uid(),
      content: text,
      category: cat,
      cognitiveWeight: meta.cognitiveWeight || 'medio',
      module: meta.module || 'El Pensadero',
      amount: (cat === 'humo_naranja') ? 50 : null,
      contactName: (cat === 'humo_purpura') ? 'Contacto' : null,
      hibernatedUntil: (cat === 'humo_ceniza') ? Date.now() + 14 * 86400000 : null,
      isPinned: false,
      isResolved: false,
      createdAt: new Date().toISOString()
    };

    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.cleanDuplicateThoughts();
    this.saveState();

    // Asegurar que el filtro no oculte el pensamiento recién creado
    if (this.pensaderoSmokeFilter && this.pensaderoSmokeFilter !== 'all' && this.pensaderoSmokeFilter !== cat) {
      this.pensaderoSmokeFilter = 'all';
    }

    // Renderizado ultra-rápido abajo sin recarga total
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
    } else {
      this.render();
    }

    // Notificaciones en PC y Celular (Pensamientos Rojos / Sin clasificar)
    if (cat === 'humo_rojo') {
      this.sendSystemNotification('🚨 Urgencia Crítica / Fuego Activo', {
        body: `Atención inmediata: "${text.slice(0, 50)}"`,
        tag: 'humo-rojo-' + newItem.id,
        requireInteraction: true
      });
    } else if (cat === 'humo_general' || !cat) {
      this.sendSystemNotification('✨ Pensamiento sin clasificar depositado', {
        body: `Nuevo pensamiento en el Pensadero: "${text.slice(0, 50)}"`,
        tag: 'humo-general-' + newItem.id
      });
    }

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState(cat);
      this.shaderEngine.pulseShockwave();
    }

    if (cat === 'humo_rojo' && navigator.vibrate) {
      try { navigator.vibrate([200, 100, 200]); } catch(e){}
    }

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/pensadero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newItem.id, content: text, category: cat })
      }).then(async r => {
        if (r.ok) {
          const saved = await r.json();
          if (saved && saved.id && saved.id !== newItem.id) {
            newItem.id = saved.id;
            this.saveState();
          }
        }
      }).catch(() => {});
    }
  }

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
  }

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
      this.quickDumpToOrbe(text, smoke);
      this.closeModal('nexus-orbe-quick-gadget-modal');
      const txt = document.getElementById('gadget-dump-text');
      if (txt) txt.value = '';
      this.showToast(`✓ Pensamiento depositado desde Gadget: "${text.slice(0, 30)}..."`);
    }
  }

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
  }

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
  }

  submitGadgetDump() {
    const input = document.getElementById('gadget-dump-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const smoke = this.selectedGadgetSmoke || 'humo_blanco';
    this.quickDumpToOrbe(text, smoke);
    this.closeModal('nexus-orbe-quick-gadget-modal');
    input.value = '';
  }

  quickDumpToOrbe(text, customCategory = null) {
    if (!text || !text.trim()) return;
    if (this._isSubmittingThought) return;

    const cleanText = text.trim();
    this._isSubmittingThought = true;
    setTimeout(() => { this._isSubmittingThought = false; }, 400);

    // Limpiar inputs embebidos inmediatamente
    const directInput = document.getElementById('pensadero-direct-dump-input');
    if (directInput) directInput.value = '';
    const jarvisInput = document.getElementById('pensadero-jarvis-input');
    if (jarvisInput && jarvisInput.value.trim() === cleanText) jarvisInput.value = '';

    let cat = customCategory || this.selectedGadgetSmoke || 'humo_general';

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
      amount: (cat === 'humo_naranja') ? 50 : null,
      contactName: (cat === 'humo_purpura') ? 'Contacto' : null,
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
          body: JSON.stringify({ id: newItem.id, content: cleanText, category: cat })
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

    // Sin color elegido: pedir a Nexus que lo clasifique (tras crearlo en el servidor, para que el PUT lo encuentre)
    if (cat === 'humo_general') {
      created.then(() => this.nexusClassifyNewThought(newItem.id, cleanText));
    }
  }


  // --- ENRUTADO A PROYECTOS POR PALABRAS CLAVE ---
  getProjectKeywords(project) {
    const extra = String(project.keywords || '').split(',');
    return [project.name, ...extra]
      .map(k => (k || '').toLowerCase().trim())
      .filter(k => k.length >= 3);
  }

  // Devuelve el proyecto cuyo nombre o palabra clave aparece en el texto (gana la coincidencia más larga)
  findProjectForText(text) {
    const lower = (text || '').toLowerCase();
    let best = null;
    let bestLen = 0;
    for (const p of (this.state.projects || [])) {
      if (p.inBaul) continue;
      for (const kw of this.getProjectKeywords(p)) {
        if (kw.length > bestLen && lower.includes(kw)) {
          best = p;
          bestLen = kw.length;
        }
      }
    }
    return best;
  }

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
  }

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
    const contract = this.classifyThoughtWithGeminiContract(text);
    item.category = contract.category;
    item.cognitiveWeight = contract.cognitive_weight;
    item.module = contract.module;
    this.saveState();
    this.render();

    const meta = SMOKE_PALETTE[contract.category] || SMOKE_PALETTE.humo_dorado;
    this.setOrbeColor(contract.category);
    this.triggerShockwave();
    this.triggerDopamineReward();

    this.showToast(`✨ Clasificado como ${meta.icon} ${meta.name} · peso ${contract.cognitive_weight}`);
  }

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
  }

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
      alert(`🎙️ Por comando de voz ("${voiceText}"):\n✓ Pensamiento clasificado como ${meta.name} (${meta.title}).`);
    } else {
      this.autoClassifyThought(item.id);
    }
  }

  changeThoughtCategory(target, newCategory) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

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
  }

  // --- AUTO-CLASIFICACIÓN NEXUS ---
  // Tipos que devuelve /thought (Gemini o heurístico) -> color del Pensadero
  static get NEXUS_TYPE_TO_SMOKE() {
    return {
      intrusivo: 'humo_blanco',
      urgente: 'humo_rojo',
      idea_proyecto: 'humo_dorado',
      deep_work: 'humo_azul',
      habito: 'humo_verde',
      contacto: 'humo_purpura',
      finanzas: 'humo_naranja',
      hibernacion: 'humo_ceniza',
      tarea: 'humo_tarea'
    };
  }

  isAutoClassifyEnabled() {
    return this.state.settings?.autoClassify !== false;
  }

  setAutoClassify(enabled) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.autoClassify = !!enabled;
    this.saveState();
    this.showToast(enabled ? '🧠 Nexus clasificará lo que sueltes sin color.' : 'Auto-clasificación desactivada.');
  }

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

    this.changeThoughtCategory(itemId, cat);
    const meta = SMOKE_PALETTE[cat];
    this.showToast(`🧠 Nexus lo clasificó como ${meta.icon} ${meta.name}`, () => {
      this.changeThoughtCategory(itemId, 'humo_general');
    }, 'Deshacer');
  }

  sendInputDirectToProject() {
    const jarvisInput = document.getElementById('pensadero-jarvis-input');
    const directInput = document.getElementById('pensadero-direct-dump-input');
    let text = (jarvisInput && jarvisInput.value.trim()) || (directInput && directInput.value.trim()) || '';

    if (!text) {
      text = prompt('Escribe el pensamiento, idea o tarea que deseas mandar a un proyecto:');
      if (!text || !text.trim()) return;
      text = text.trim();
    }

    const cat = document.getElementById('pensadero-cat-val')?.value || 'humo_general';
    const newItem = {
      id: this.uid(),
      content: text,
      category: cat,
      cognitiveWeight: 'medio',
      module: 'Proyectos Oro',
      isPinned: false,
      isResolved: false,
      createdAt: new Date().toISOString()
    };
    if (!this.state.pensadero) this.state.pensadero = [];
    this.state.pensadero.unshift(newItem);
    this.cleanDuplicateThoughts();
    if (jarvisInput) jarvisInput.value = '';
    if (directInput) directInput.value = '';
    this.saveState();
    this.updateBadges();
    this.renderPensaderoDirectItems();

    // Lanzar dispatcher para este item recién creado por su ID
    this.quickDispatchThoughtToProject(newItem.id);
  }

  openDispatchThoughtModal(target) {
    this.quickDispatchThoughtToProject(target);
  }

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
  }

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
  }

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
  }

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
  }

  // Borrado con "Deshacer": el borrado en servidor es inmediato y deshacer lo recrea vía sync.
  undoableRestore(restoreFn) {
    restoreFn();
    this.saveState();
    this.render();
    if (this.backendAvailable) this.syncWithBackend(false);
  }

  deletePensaderoItemWithUndo(target) {
    const idx = this.getPensaderoIndex(target);
    const item = idx >= 0 ? this.state.pensadero[idx] : null;
    if (!item) return;
    this.deletePensaderoItem(target);
    this.showToast('🧹 Pensamiento archivado', () => this.undoableRestore(() => {
      this.state.pensadero.splice(Math.min(idx, this.state.pensadero.length), 0, item);
    }), 'Deshacer');
  }

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
  }

  showNotification(message, type = 'info') {
    this.showToast(message);
  }

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
          ${item.amount ? `<p class="text-xs text-orange-400 font-mono mt-1">💳 Monto registrado: $${this.escapeHtml(item.amount)} USD</p>` : ''}
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
            <button onclick="app.syncRedSmokeToGoogle('${item.id}', '${encodeURIComponent(item.content)}')" class="px-2.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Sincronizar con Google Tasks y Calendar">
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
            <button onclick="app.openScheduleEmailModal('${item.id}', '${encodeURIComponent(item.content)}')" class="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1 shrink-0" title="Programar recordatorio por Google Mail (Gmail)">
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
  }

  togglePinPensadero(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.isPinned = !item.isPinned;
    this.state.pensadero.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    this.saveState();
    this.render();
  }

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
  }

  clearPensaderoPrompts() {
    if (confirm("¿Deseas vaciar todas las notas no fijadas de El Pensadero?")) {
      this.state.pensadero = (this.state.pensadero || []).filter(item => item.isPinned);
      this.saveState();
      this.render();
    }
  }

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
  }

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
  }

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
  }

  // ==========================================
  // VISTA 3: ⚡ HACER (UNIFICACIÓN TAREAS + KANBAN TDAH)
  // La vista por defecto muestra el siguiente paso y en foco.
  // Las 5 columnas quedan detrás de 'Ver tablero'.
  // El límite de 3 se dice en frase humana.
  // ==========================================
  renderViewHacer(container) {
    if (!this.hacerMode) this.hacerMode = 'lista';
    if (!this.hacerProjectFilter) this.hacerProjectFilter = 'all';

    const projects = (this.state.projects || []).filter(p => !p.inBaul);
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-10 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4 my-8">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl">
            ⚡
          </div>
          <div>
            <h3 class="text-xl font-display font-extrabold text-white">Sin proyectos aún</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Crea tu primer proyecto para organizar tus tareas y activar el límite protector de 3 tareas en foco.</p>
          </div>
          <button onclick="app.openProjectModal()" class="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 mx-auto">
            <span>+</span> Crear Primer Proyecto
          </button>
        </div>
      `;
      return;
    }

    // Si está en modo tablero de 5 columnas
    if (this.hacerMode === 'tablero') {
      this.renderHacerTableroCompleto(container);
      return;
    }

    // Modo Lista de Enfoque (Por defecto)
    this.renderHacerListaEnfoque(container);
  }

  setHacerMode(mode) {
    this.hacerMode = mode;
    this.render();
  }

  renderHacerListaEnfoque(container) {
    const projects = this.state.projects || [];
    let allTasks = [];
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        allTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji || '📁',
          projectColor: p.color || '#3b82f6',
          projectStatus: p.status
        });
      });
    });

    let tasks = allTasks;
    if (this.hacerProjectFilter && this.hacerProjectFilter !== 'all') {
      tasks = tasks.filter(t => t.projectId === this.hacerProjectFilter);
    }

    const enfocoTasks = tasks.filter(t => t.column === 'enfoco');
    const proximoTasks = tasks.filter(t => t.column === 'proximo');
    const buzonTasks = tasks.filter(t => t.column === 'buzon');
    const victoriasCount = tasks.filter(t => t.column === 'victorias').length;
    const totalEnfoco = enfocoTasks.length;

    // Frase protectora TDAH del límite de 3
    let focusBanner = '';
    if (totalEnfoco === 0) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">💡</span>
            <span><strong>Memoria de trabajo despejada:</strong> No tienes tareas en foco. Elige una de tus próximas acciones para arrancar sin estrés.</span>
          </div>
        </div>`;
    } else if (totalEnfoco === 1) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">🎯</span>
            <span><strong>1 tarea en foco:</strong> Excelente para tu atención. Una sola cosa a la vez previene la sobrecarga.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 transition">
            Ir a Ahora ➔
          </button>
        </div>`;
    } else if (totalEnfoco === 2) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">⚡</span>
            <span><strong>2 de 3 tareas en foco:</strong> Buen ritmo. Mantén un máximo de 3 para proteger tu claridad mental.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 transition">
            Ir a Ahora ➔
          </button>
        </div>`;
    } else {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">⚠️</span>
            <span><strong>Foco completo (3 de 3 tareas):</strong> Termina una o muévela a 'después' antes de meter otra para no saturarte.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0 transition">
            Enfocar en Ahora ➔
          </button>
        </div>`;
    }

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 py-2">

        <!-- Barra Superior Hacer -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-display font-extrabold text-white flex items-center gap-2">
              <span>⚡</span> Hacer
            </h1>
            <p class="text-xs text-slate-400 mt-0.5">Tus acciones inmediatas organizadas para arrancar sin parálisis.</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Selector de Proyecto -->
            <select onchange="app.setHacerProjectFilter(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 font-semibold focus:outline-none">
              <option value="all" ${this.hacerProjectFilter === 'all' ? 'selected' : ''}>Todos los proyectos</option>
              ${projects.map(p => `
                <option value="${p.id}" ${p.id === this.hacerProjectFilter ? 'selected' : ''}>
                  ${p.emoji || '🎯'} ${p.name}
                </option>
              `).join('')}
            </select>

            <!-- Botón de Tablero 5 Columnas -->
            <button onclick="app.setHacerMode('tablero')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition flex items-center gap-1.5">
              <span>📋</span> Ver tablero completo
            </button>

            <!-- Nueva Tarea -->
            <button onclick="app.openCreateTaskModal()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1">
              <span>+</span> Nueva Tarea
            </button>
          </div>
        </div>

        <!-- Banner Límite de 3 TDAH -->
        ${focusBanner}

        <!-- SECCIÓN 1: EN FOCO AHORA (MÁXIMO 3) -->
        <section class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2 font-display">
              <span>🔥</span> En Foco Ahora
              <span class="text-xs font-mono px-2 py-0.2 rounded-full ${totalEnfoco >= 3 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'}">${totalEnfoco}/3</span>
            </h2>
          </div>

          ${enfocoTasks.length === 0 ? `
            <div class="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
              <p class="text-xs">No hay tareas en foco ahora. Elige un próximo paso abajo y haz clic en "Poner en Foco".</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${enfocoTasks.map(t => this.renderHacerCard(t, true)).join('')}
            </div>
          `}
        </section>

        <!-- SECCIÓN 2: PRÓXIMOS PASOS (LISTOS PARA ARRANCAR) -->
        <section class="space-y-2 pt-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2 font-display">
              <span>🎯</span> Próximos Pasos (${proximoTasks.length})
            </h2>
          </div>

          ${proximoTasks.length === 0 ? `
            <div class="p-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
              <p class="text-xs">No hay próximos pasos definidos en este filtro.</p>
            </div>
          ` : `
            <div class="space-y-2">
              ${proximoTasks.map(t => this.renderHacerCard(t, false)).join('')}
            </div>
          `}
        </section>

        <!-- SECCIÓN 3: BUZÓN E IDEAS (PLEGABLE O SECUNDARIO) -->
        ${buzonTasks.length > 0 ? `
          <details class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <summary class="font-bold text-slate-400 cursor-pointer hover:text-white select-none">
              📥 Buzón / Ideas pendientes (${buzonTasks.length})
            </summary>
            <div class="space-y-2 mt-3 pt-2 border-t border-slate-800">
              ${buzonTasks.map(t => this.renderHacerCard(t, false)).join('')}
            </div>
          </details>
        ` : ''}

        <!-- Victorias acumuladas -->
        <div class="text-center pt-2">
          <span class="text-xs text-slate-500 font-mono">🏆 ${victoriasCount} micro-victorias registradas</span>
        </div>

      </div>
    `;
  }

  renderHacerCard(t, isEnFoco = false) {
    return `
      <div class="p-3.5 rounded-2xl bg-slate-900 border ${isEnFoco ? 'border-cyan-500/40 shadow-md ring-1 ring-cyan-500/20' : 'border-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs">${t.projectEmoji}</span>
            <span class="text-[11px] font-bold text-slate-400 truncate">${t.projectName}</span>
            ${isEnFoco ? `<span class="text-[9px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">En Foco</span>` : ''}
          </div>
          <h3 class="text-sm font-bold text-white hover:text-cyan-300 transition cursor-pointer" onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')">
            ${this.escapeHtml(t.title)}
          </h3>
          ${t.notes ? `<p class="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">${this.escapeHtml(t.notes)}</p>` : ''}
        </div>

        <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          ${isEnFoco ? `
            <button onclick="app.setHeroTaskAndFocus('${t.projectId}', '${t.id}')" class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
              <span>▶</span> Enfocar
            </button>
          ` : `
            <button onclick="app.promoteTaskToFoco('${t.projectId}', '${t.id}')" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition" title="Poner en foco (máx 3)">
              ⚡ Poner en foco
            </button>
          `}

          <button onclick="app.completeTaskAsVictory('${t.projectId}', '${t.id}', '${encodeURIComponent(t.title)}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition flex items-center gap-1" title="Marcar como Victoria">
            <span>✓</span> Victoria
          </button>

          <button onclick="app.breakdownTaskWithAI('${encodeURIComponent(t.title)}', '${t.projectId}')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs transition" title="Desglose Atómico Gemini (micro-pasos de 15m)">
            🪄
          </button>

          <button onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition" title="Editar Tarea">
            ✏️
          </button>

          <button onclick="app.moveTaskToColumn('${t.projectId}', '${t.id}', 'congelador')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-700 text-xs transition" title="Mover a después (congelador)">
            ❄️
          </button>
        </div>
      </div>
    `;
  }

  setHacerProjectFilter(projId) {
    this.hacerProjectFilter = projId;
    this.render();
  }

  setHeroTaskAndFocus(projectId, taskId) {
    this.selectedKanbanProjectId = projectId;
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p && p.tasks) {
      const t = p.tasks.find(x => x.id === taskId);
      if (t && t.column !== 'enfoco') {
        t.column = 'enfoco';
        this.saveState();
      }
    }
    this.navigate('ahora');
  }

  promoteTaskToFoco(projectId, taskId) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (!p || !p.tasks) return;
    const currentEnfoco = (p.tasks || []).filter(t => t.column === 'enfoco').length;
    if (currentEnfoco >= 3) {
      this.showToast("⚠️ Ya tienes 3 tareas en foco. Concluye una antes de agregar otra.");
      return;
    }
    const t = p.tasks.find(x => x.id === taskId);
    if (t) {
      t.column = 'enfoco';
      t.updatedAt = new Date().toISOString();
      this.saveState();
      this.showToast(`⚡ "${t.title.slice(0, 25)}..." puesta en foco`);
      this.render();
    }
  }

  completeTaskAsVictory(projectId, taskId, taskTitle) {
    const decoded = decodeURIComponent(taskTitle || 'Tarea');
    this.completeSprintAndRegisterVictory(projectId, taskId, decoded);
  }

  renderHacerTableroCompleto(container) {
    this.renderViewKanbanTablero(container);
  }

  renderViewKanban(container) {
    this.setHacerMode('tablero');
  }

  renderViewTareas(container) {
    this.setHacerMode('lista');
  }

  // ==========================================
  // VISTA KANBAN COMPLETA (5 COLUMNAS TRADICIONALES)
  // ==========================================
  renderViewKanbanTablero(container) {
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-10 text-center theme-card rounded-3xl border theme-border space-y-4 my-8">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-3xl">
            ⚡
          </div>
          <div>
            <h3 class="text-xl font-display font-extrabold text-white">Sin proyectos aún</h3>
            <p class="text-xs theme-text-muted mt-1 max-w-xs mx-auto">Crea tu primer proyecto para desbloquear el tablero Kanban, descomponer metas con IA y activar el límite WIP de 3 tarjetas.</p>
          </div>
          <button onclick="app.openProjectModal()" class="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 active:scale-95 transition flex items-center gap-2 mx-auto">
            <span>+</span> Crear Primer Proyecto
          </button>
        </div>
      `;
      return;
    }

    if (!this.selectedKanbanProjectId || !projects.find(p => p.id === this.selectedKanbanProjectId)) {
      this.selectedKanbanProjectId = projects[0].id;
    }

    const project = projects.find(p => p.id === this.selectedKanbanProjectId);
    const tasks = project.tasks || [];

    // Si está en modo Tarjetas (Tinder-like para Celular)
    if (this.kanbanViewMode === 'tinder') {
      this.renderKanbanTinderMode(project, tasks, container);
      return;
    }

    const iceboxTasks = tasks.filter(t => t.column === 'congelador');

    const baseColumns = [
      { key: 'buzon', title: '📥 Buzón / Ideas', limit: null, desc: 'Todo lo que llega sin procesar' },
      { key: 'proximo', title: '🎯 Próximo Paso', limit: null, desc: 'Priorizadas para arrancar' },
      { key: 'enfoco', title: '⚡ En Foco (Máx 3)', limit: 3, desc: 'Máximo 3 para proteger tu mente' },
      { key: 'esperando', title: '⏳ En Espera', limit: null, desc: 'Bloqueado por un tercero' },
      { key: 'victorias', title: '🏆 Victorias', limit: null, desc: 'Logros que generan dopamina' }
    ];

    let columns = [...baseColumns];
    if (this.showIcebox) {
      columns.unshift({ key: 'congelador', title: '❄️ Congelador (Icebox)', limit: null, desc: 'Ideas guardadas para el futuro sin agobiar' });
    }

    const enfocoCount = tasks.filter(t => t.column === 'enfoco').length;

    container.innerHTML = `
      <!-- Header del Kanban con Selector y Checkpoints Cognitivos -->
      <div class="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Tablero Adaptativo TDAH</span>
            ${enfocoCount >= 3 ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">⚠️ Foco Completo (3/3)</span>` : ''}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border" style="border-color: ${project.color || '#10b981'}; color: ${project.color || '#10b981'}; background: ${project.color ? project.color + '15' : '#10b98115'}">Color Maestro</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-2xl">${project.emoji || '🎯'}</span>
            <select onchange="app.changeKanbanProject(this.value)" class="text-xl sm:text-2xl font-display font-extrabold bg-transparent border-b theme-border pb-0.5 focus:outline-none cursor-pointer">
              ${projects.map(p => `
                <option value="${p.id}" ${p.id === project.id ? 'selected' : ''} class="theme-card text-sm">
                  ${p.emoji || '🎯'} ${p.name} (${p.status})
                </option>
              `).join('')}
            </select>
          </div>
          ${project.objective ? `<p class="text-xs theme-text-muted mt-1">${project.objective}</p>` : ''}
          ${project.originThoughtContent ? `
            <div class="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 max-w-xl truncate" title="Pensamiento original de El Pensadero">
              <span>🔮 Origen Pensadero:</span>
              <span class="truncate italic font-mono">"${project.originThoughtContent}"</span>
            </div>
          ` : ''}
        </div>

        <!-- Toolbar con Botones de Checkpoints Cognitivos y TDAH -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Volver a Lista de Enfoque -->
          <button onclick="app.setHacerMode('lista')" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 shadow-sm">
            <span>←</span> Volver a Lista
          </button>

          <!-- El Despegue -->
          <button onclick="app.openDespegue('${project.id}')" class="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition" title="Restaurar contexto: ¿Qué logré? y Próximo micro-paso">
            <span>🚀</span> Despegue
          </button>

          <!-- El Aterrizaje: Botón Gigante de Pausar Proyecto -->
          <button onclick="app.openCheckout('${project.id}')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5" title="El Cierre TDAH: Bitácora rápida + El Hilo de Ariadna + Timeblocking">
            <span>⏸️</span> Pausar Proyecto (Aterrizaje)
          </button>

          <!-- Modo One Thing (Filtro de Ruido) -->
          <button onclick="app.openOneThingMode('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-bold text-xs flex items-center gap-1.5 transition" title="Pantalla negra enfocada en una sola tarea">
            <span>👁️</span> Solo 1 Cosa
          </button>

          <!-- Desglose Atómico Gemini -->
          <button onclick="app.openDeconstructModal('${project.id}')" class="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition flex items-center gap-1" title="Desglosar meta con Gemini en micro-pasos de 15m y Kickstart Action">
            <span>🪄</span> Desglosar
          </button>

          <!-- Reactivación Anti-Abandono con IA -->
          <button onclick="app.reactivateProjectWithGemini('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold text-xs transition flex items-center gap-1" title="Resumen Ejecutivo de Reactivación: ¿En qué te quedaste y por qué era importante?">
            <span>🌱</span> Reactivar
          </button>

          <!-- Alternador de Congelador (Icebox) -->
          <button onclick="app.toggleIcebox()" class="px-3 py-2 rounded-xl theme-card-subtle border ${this.showIcebox ? 'border-sky-500/50 text-sky-400 bg-sky-500/10' : 'theme-border theme-text-muted'} font-semibold text-xs transition" title="Ver u ocultar el congelador de ideas complejas">
            <span>❄️</span> Congelador (${iceboxTasks.length})
          </button>

          <!-- Selector de Vista Celular (Tarjetas Tinder) vs Panorámica (Tableta/PC) -->
          <button onclick="app.toggleKanbanViewMode()" class="px-3 py-2 rounded-xl theme-card-subtle border theme-border font-semibold text-xs hover:brightness-110 transition flex items-center gap-1" title="Alternar entre feed de tarjetas y columnas">
            <span>📱</span> Tarjetas
          </button>

          <!-- Captura Rápida en Contexto al Ideario/Pensadero -->
          <button onclick="app.openNexusInContext('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold text-xs transition flex items-center gap-1" title="Captura rápida por voz al Ideario en el contexto de este proyecto">
            <span>🎙️</span> Capturar
          </button>

          <!-- Modo Zen Hiperfoco -->
          <button onclick="app.openZenMode(app.state.projects.find(p=>p.id==='${project.id}'), '${project.nextAction}')" class="p-2 rounded-xl theme-card-subtle text-emerald-400 hover:brightness-110 text-xs border theme-border transition" title="Modo Zen Hiperfoco">
            🎯
          </button>

          <button onclick="app.openProjectModal('${project.id}')" class="p-2 rounded-xl theme-card-subtle theme-text-muted hover:brightness-110 text-xs border theme-border transition" title="Configurar proyecto">
            ⚙️
          </button>
        </div>
      </div>

      <!-- Columnas del Kanban con Drag and Drop y Recordador Cromático -->
      <div class="kanban-board" style="--kb-cols:${columns.length}">
        ${columns.map(col => {
          const colTasks = tasks.filter(t => t.column === col.key);
          const isOverLimit = col.limit && colTasks.length >= col.limit;

          return `
            <div class="theme-card-subtle rounded-2xl p-3 border theme-border flex flex-col min-h-[440px] transition-all kanban-col ${col.key === 'congelador' ? 'bg-slate-900/30 border-dashed border-sky-500/30' : ''}"
                 ondragover="app.handleDragOver(event)"
                 ondragleave="app.handleDragLeave(event)"
                 ondrop="app.handleDrop(event, '${col.key}')"
                 data-col="${col.key}">

              <div class="flex items-center justify-between pb-2 mb-2 border-b theme-border">
                <div>
                  <h4 class="text-xs font-bold">${col.title}</h4>
                  <p class="text-[10px] theme-text-muted font-mono">${col.desc}</p>
                </div>
                <span class="text-xs font-mono px-2 py-0.5 rounded-full ${isOverLimit ? 'bg-amber-500 text-white font-bold' : 'theme-card border theme-border theme-text-muted'}">
                  ${colTasks.length}${col.limit ? '/' + col.limit : ''}
                </span>
              </div>

              <div class="flex-1 space-y-2">
                ${colTasks.map(t => this.renderTaskCard(project, t, col.key)).join('')}
                ${colTasks.length === 0 ? `
                  <div class="p-6 text-center rounded-xl border border-dashed theme-border text-[11px] theme-text-muted">
                    ${col.key === 'congelador' ? 'Arrastra aquí tareas complejas para no saturar el presente' : 'Sin tarjetas'}
                  </div>
                ` : ''}
              </div>

              <div class="pt-2 mt-2 border-t theme-border">
                <button onclick="app.promptAddTask('${project.id}', '${col.key}')" class="w-full py-1.5 rounded-lg text-xs font-semibold theme-text-muted hover:brightness-125 transition flex items-center justify-center gap-1">
                  <span>+</span> Añadir tarea
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- MODO TARJETAS TINDER-LIKE PARA CELULAR (VERTICAL) ---
  renderKanbanTinderMode(project, tasks, container) {
    const pendingTasks = tasks.filter(t => t.column !== 'victorias');
    const total = pendingTasks.length;

    if (total === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-8 rounded-3xl theme-card border theme-border text-center">
          <span class="text-4xl block mb-2">🎉</span>
          <h3 class="text-lg font-bold">¡Sin tareas pendientes en este proyecto!</h3>
          <p class="text-xs theme-text-muted mt-1">Todas las tareas están en victorias o en el congelador.</p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <button onclick="app.promptAddTask('${project.id}', 'buzon')" class="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs">
              + Nueva Tarea
            </button>
            <button onclick="app.toggleKanbanViewMode()" class="px-4 py-2 rounded-xl theme-card-subtle border theme-border font-bold text-xs">
              Ver columnas clásicas
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (this.tinderCardIndex >= total) this.tinderCardIndex = 0;
    if (this.tinderCardIndex < 0) this.tinderCardIndex = total - 1;

    const task = pendingTasks[this.tinderCardIndex];
    const ageDays = this.daysSince(task.createdAt);
    const isCooling = (task.column === 'enfoco' || task.column === 'proximo') && ageDays >= 7;

    container.innerHTML = `
      <!-- Header Selector y Cambio de Modo -->
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">${project.emoji || '🎯'}</span>
          <select onchange="app.changeKanbanProject(this.value)" class="text-lg font-extrabold bg-transparent border-b theme-border focus:outline-none">
            ${(this.state.projects || []).map(p => `
              <option value="${p.id}" ${p.id === project.id ? 'selected' : ''} class="theme-card text-xs">${p.emoji || '🎯'} ${p.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="app.toggleKanbanViewMode()" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            📋 Modo Columnas
          </button>
        </div>
      </div>

      <!-- TARJETA TINDER-LIKE (STITCH FOCUS CARD) -->
      <div class="max-w-md mx-auto relative select-none" id="dopamine-canvas-wrapper">
        <div id="active-tinder-card" class="p-6 rounded-3xl bg-slate-900/90 border-2 shadow-2xl transition-all relative overflow-hidden backdrop-blur-xl ${isCooling ? 'task-cooling' : ''}"
             style="border-color: ${project.color || '#4cd7f6'}; min-height: 380px; display: flex; flex-direction: column; justify-content: space-between;">

          <div>
            <!-- Tags de Cabecera (Stitch Style) -->
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-cyan-500/30">
                ${project.emoji || '🎯'} ${this.escapeHtml(project.name)} • ${task.column.toUpperCase()}
              </span>
              <div class="flex items-center gap-1.5">
                <button onclick="app.openEditTaskModal('${project.id}', '${task.id}')" class="text-xs text-slate-400 hover:text-cyan-300 p-1 transition" title="Editar tarea (CRUD)">✏️</button>
                <span class="text-xs font-mono font-bold text-emerald-400">
                  ${this.tinderCardIndex + 1} de ${total}
                </span>
              </div>
            </div>

            ${isCooling ? `<div class="mb-2"><span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">❄️ Perdiendo inercia (${ageDays} días estancada)</span></div>` : ''}
            ${task.isBureaucratic ? `<div class="mb-2"><span class="badge-bureaucracy text-[10px] font-bold px-2 py-0.5 rounded-md">📑 Tarea Administrativa (Doble recompensa)</span></div>` : ''}

            <h2 class="text-xl sm:text-2xl font-display font-black text-white leading-snug mb-3 cursor-pointer hover:text-cyan-300 transition" onclick="app.openDeepWork('${project.id}', '${task.id}')">
              ${this.escapeHtml(task.title)}
            </h2>

            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 mb-3">
              <span>⏱️</span> <span>Micro-paso: ~10 min</span>
              <span class="text-slate-600">•</span>
              <span class="text-emerald-400 font-semibold">Dificultad Mínima</span>
            </div>

            ${task.notes ? `<p class="text-xs text-slate-300 line-clamp-3 mb-2 font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">${this.escapeHtml(task.notes)}</p>` : ''}
            ${task.codeSnippet ? `<p class="text-[11px] text-emerald-400 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800 truncate">💻 Snippet de código adjunto</p>` : ''}
          </div>

          <!-- Acciones Táctiles Dopamínicas (Stitch Screen 2) -->
          <div class="pt-4 border-t border-slate-800 space-y-2.5">
            <div class="grid grid-cols-3 gap-2">
              <!-- Saltar sin culpa -->
              <button onclick="app.nextTinderCard()" class="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold flex flex-col items-center gap-1 transition active:scale-95" title="Saltar sin culpa: Cero remordimientos, conserva momentum">
                <span class="text-lg">⏭️</span>
                <span class="text-[10px] whitespace-nowrap">Sin culpa</span>
              </button>
              <!-- Llevar a Modo Zen -->
              <button onclick="app.launchZenForTask('${project.id}', '${task.id}', '${encodeURIComponent(task.title)}')" class="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold flex flex-col items-center gap-1 transition active:scale-95 border border-cyan-500/40 plasma-glow" title="Entrar en Modo Zen Hiperfoco">
                <span class="text-lg">🧘</span>
                <span class="text-[10px] whitespace-nowrap">Modo Zen</span>
              </button>
              <!-- ¡Victoria lograda! -->
              <button onclick="app.completeTinderVictory('${project.id}', '${task.id}', '${encodeURIComponent(task.title)}')" class="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-display font-extrabold flex flex-col items-center gap-1 transition active:scale-95 shadow-lg shadow-emerald-500/25 pulse-glow-tertiary" title="Marcar como Victoria y recibir dopamina">
                <span class="text-lg">🎉</span>
                <span class="text-[10px] whitespace-nowrap">¡Victoria!</span>
              </button>
            </div>

            <div class="flex items-center justify-between text-xs theme-text-muted pt-1">
              <button onclick="app.prevTinderCard()" class="px-2.5 py-1 rounded-lg hover:text-white">← Anterior</button>
              <button onclick="app.openDeepWork('${project.id}', '${task.id}')" class="text-sky-400 font-semibold hover:underline">💻 Notas & Detalle</button>
              <button onclick="app.swipeTinderAction('icebox', '${project.id}', '${task.id}')" class="text-slate-400 hover:text-cyan-300">❄️ Congelar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  toggleKanbanViewMode() {
    this.kanbanViewMode = (this.kanbanViewMode === 'tinder') ? 'columns' : 'tinder';
    this.tinderCardIndex = 0;
    this.render();
  }

  toggleIcebox() {
    this.showIcebox = !this.showIcebox;
    this.render();
  }

  swipeTinderAction(action, projectId, taskId) {
    if (action === 'icebox') {
      this.moveTaskToColumn(projectId, taskId, 'congelador');
    } else if (action === 'enfoco') {
      this.moveTaskToColumn(projectId, taskId, 'enfoco');
    } else if (action === 'done') {
      const p = this.state.projects.find(x => x.id === projectId);
      const t = (p?.tasks || []).find(x => x.id === taskId);
      if (t?.isBureaucratic) {
        this.completeBureaucraticTask(projectId, taskId);
      } else {
        this.moveTaskToColumn(projectId, taskId, 'victorias');
      }
    }
    this.tinderCardIndex++;
    this.render();
  }

  launchZenForTask(projectId, taskId, taskTitle) {
    this.selectedKanbanProjectId = projectId;
    const decoded = decodeURIComponent(taskTitle || '');
    this.currentOneThingTask = { projectId, taskId, title: decoded };
    this.navigate('zen');
  }

  completeTinderVictory(projectId, taskId, taskTitle) {
    const decoded = decodeURIComponent(taskTitle || '');

    // Acorde dopamínico C Major
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

    const p = this.state.projects.find(x => x.id === projectId);
    const t = (p?.tasks || []).find(x => x.id === taskId);
    if (t?.isBureaucratic) {
      this.completeBureaucraticTask(projectId, taskId);
    } else {
      this.moveTaskToColumn(projectId, taskId, 'victorias');
    }
    this.tinderCardIndex++;
    this.render();
  }

  nextTinderCard() {
    this.tinderCardIndex++;
    this.render();
  }

  prevTinderCard() {
    this.tinderCardIndex--;
    this.render();
  }

  // --- RENDER DE TARJETA KANBAN (CON RECORDADOR CROMÁTICO & ENFRIAMIENTO) ---
  renderTaskCard(project, task, currentColumn) {
    const projectId = typeof project === 'object' ? project.id : project;
    const projObj = (typeof project === 'object') ? project : this.state.projects.find(p => p.id === projectId);
    const masterColor = projObj ? projObj.color : '#10b981';

    // Lógica de degradado por enfriamiento (Stagnation >= 7 días)
    const ageDays = this.daysSince(task.createdAt);
    const isCooling = (task.column === 'enfoco' || task.column === 'proximo') && ageDays >= 7;

    return `
      <div class="p-3 rounded-xl theme-card border theme-border shadow-sm hover:border-brand-500/50 cursor-grab active:cursor-grabbing transition-all select-none group relative ${isCooling ? 'task-cooling' : ''}"
           style="border-left: 4px solid ${masterColor};"
           draggable="true"
           ondragstart="app.handleDragStart(event, '${task.id}')"
           ondragend="app.handleDragEnd(event)">

        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 cursor-pointer" onclick="app.openDeepWork('${projectId}', '${task.id}')">
            <p class="text-xs font-semibold leading-snug hover:text-emerald-400 transition">${this.escapeHtml(task.title)}</p>
            ${task.notes ? `<p class="text-[10px] theme-text-muted truncate mt-0.5">${this.escapeHtml(task.notes)}</p>` : ''}
            ${task.originThoughtContent ? `
              <div class="mt-1 text-[9px] text-amber-300/85 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 truncate border border-amber-500/20" title="Pensadero: ${this.escapeHtml(task.originThoughtContent)}">
                <span>🔮</span> <span class="truncate italic">${this.escapeHtml(task.originThoughtContent)}</span>
              </div>
            ` : ''}
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button onclick="app.openEditTaskModal('${projectId}', '${task.id}')" class="theme-text-muted hover:text-cyan-400 text-xs p-0.5" title="Editar tarea (CRUD)">✏️</button>
            <button onclick="app.deleteTaskWithUndo('${projectId}', '${task.id}')" class="theme-text-muted hover:text-rose-400 text-[10px] p-0.5" title="Eliminar">✕</button>
          </div>
        </div>

        <!-- Badges de Tarea: Enfriamiento & Administrativa -->
        <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
          ${isCooling ? `
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50" title="Lleva ${ageDays} días sin avance. Sin alarmas estridentes.">
              ❄️ Perdiendo inercia (${ageDays}d)
            </span>
          ` : ''}

          ${task.isBureaucratic ? `
            <span class="badge-bureaucracy text-[9px] font-bold px-1.5 py-0.2 rounded-md" title="Tarea burocrática / administrativa: otorga doble recompensa al completarse">
              📑 Burocrática
            </span>
          ` : ''}

          ${task.codeSnippet ? `<span class="text-[9px] font-mono text-sky-400">💻 Código</span>` : ''}
        </div>

        <div class="flex items-center justify-between mt-2 pt-2 border-t theme-border">
          <div class="flex items-center gap-1">
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded theme-card-subtle theme-text-muted">
              ${task.effort || 'M'}
            </span>
            <button onclick="app.promptMasticarTask('${task.title}')" class="text-[9px] theme-text-muted hover:text-white px-1 py-0.5 rounded hover:bg-slate-700/50" title="Masticar en micro-pasos de 5 min">
              🍴
            </button>
            <button onclick="app.openOneThingMode('${projectId}', '${task.id}')" class="text-[9px] theme-text-muted hover:text-purple-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Ver en Modo Solo 1 Cosa (Filtro de Ruido)">
              👁️
            </button>
            <button onclick="app.openGapFillingModal('${task.id}', '${task.title.replace(/'/g, "\\'")}', 30, '${projectId}')" class="text-[9px] theme-text-muted hover:text-blue-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Gap Filling: Agendar en Google Calendar con buffers de 15 min y anti-optimismo">
              📅
            </button>
            <button onclick="app.openDeconstructModal('${projectId}', '${task.title.replace(/'/g, "\\'")}')" class="text-[9px] theme-text-muted hover:text-amber-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Desglose Atómico Gemini (micro-pasos de 15m)">
              🪄
            </button>
            <button onclick="app.openScheduleEmailModal('${task.id}', '${task.title.replace(/'/g, "\\'")}', '${projectId}')" class="text-[9px] theme-text-muted hover:text-indigo-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Programar recordatorio por Google Mail (Gmail)">
              📧
            </button>
            <button onclick="app.openDeepWork('${projectId}', '${task.id}')" class="text-[9px] theme-text-muted hover:text-sky-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Abrir notas y fragmentos de código (Deep Work)">
              💻
            </button>
          </div>

          <!-- Botones de Acción Rápida -->
          <div class="flex items-center gap-1">
            ${currentColumn !== 'congelador' ? `
              <button onclick="app.moveTaskToColumn('${projectId}', '${task.id}', 'congelador')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-sky-300 flex items-center justify-center text-[10px]" title="Congelar sin culpa">
                ❄️
              </button>
            ` : ''}

            <button onclick="app.moveTaskPrev('${projectId}', '${task.id}')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-white flex items-center justify-center text-[10px] font-bold" title="Mover columna anterior">
              ←
            </button>
            <button onclick="app.moveTaskNext('${projectId}', '${task.id}')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-white flex items-center justify-center text-[10px] font-bold" title="Avanzar columna">
              →
            </button>

            ${currentColumn !== 'victorias' ? `
              <button onclick="${task.isBureaucratic ? `app.completeBureaucraticTask('${projectId}', '${task.id}')` : `app.moveTaskToColumn('${projectId}', '${task.id}', 'victorias')`}" class="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 flex items-center justify-center text-[10px] font-bold transition" title="Marcar como Victoria">
                ✓
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

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
  }

  closeDespegue() {
    const overlay = document.getElementById('despegue-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  acceptDespegueAndStart() {
    const p = this.state.projects.find(x => x.id === this.selectedKanbanProjectId);
    this.closeDespegue();
    if (p) {
      this.openZenMode(p, p.nextAction);
    }
  }

  acceptDespegueShowKanban() {
    this.closeDespegue();
    this.navigate('kanban');
  }

  skipDespegueWithoutGuilt() {
    this.closeDespegue();
    if (this.selectedKanbanProjectId) {
      this.skipProjectWithoutGuilt(this.selectedKanbanProjectId);
    }
  }

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
  }

  closeOneThingMode() {
    const overlay = document.getElementById('onething-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
    }
    this.currentOneThingTask = null;
  }

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
  }

  postponeOneThing() {
    const cur = this.currentOneThingTask;
    this.closeOneThingMode();
    if (cur) {
      this.openCheckout(cur.projectId);
    }
  }

  freezeOneThing() {
    const cur = this.currentOneThingTask;
    if (cur) {
      this.moveTaskToColumn(cur.projectId, cur.taskId, 'congelador');
    }
    this.closeOneThingMode();
    this.showNotification('❄️ Tarea enviada al congelador para no saturar tu memoria de trabajo.', 'info');
  }

  triggerAIDeconstructFromOneThing() {
    const cur = this.currentOneThingTask;
    if (!cur) return;
    this.closeOneThingMode();
    this.openDeconstructModal(cur.projectId, cur.title);
  }

  breakdownTaskWithAI(taskTitle, projectId) {
    const title = taskTitle ? decodeURIComponent(taskTitle) : '';
    this.openDeconstructModal(projectId, title);
  }

  // ==========================================
  // CAPACIDADES NUCLEARES: IA DECONSTRUCTION, GAP FILLING & REACTIVACIÓN
  // ==========================================
  openDeconstructModal(projectId = null, defaultGoal = '') {
    const p = projectId ? this.state.projects.find(x => x.id === projectId) : (this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0]);
    const targetGoal = defaultGoal || (p ? (p.objective || p.nextAction || p.name) : 'Meta general');
    this.deconstructWithGemini(targetGoal, p ? p.id : null);
  }

  async deconstructWithGemini(goalText, projectId) {
    const body = document.getElementById('ai-deconstruct-body');
    if (!body) return;

    const p = projectId ? this.state.projects.find(x => x.id === projectId) : null;
    const queryGoal = (goalText || (p ? (p.objective || p.name) : 'Meta')).trim();

    body.innerHTML = `
      <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
        <div class="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-bold text-sm text-amber-300">Desarmando la meta con Gemini...</p>
          <p class="text-[11px] theme-text-muted mt-1">Extrayendo Kickstart Action (&lt;10m) y micro-pasos de 15 a 20 minutos.</p>
        </div>
      </div>
    `;
    this.openModal('modal-ai-deconstruction');

    let data = null;
    try {
      const res = await fetch(`${this.NEXUS_API_BASE}/deconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: queryGoal })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn("Nexus service not reached, using heuristic schema fallback", err);
    }

    if (!data || !data.kickstart_action) {
      data = {
        goal_title: queryGoal,
        kickstart_action: `Abrir el bloc de notas y titular "${queryGoal.slice(0, 35)}" (menos de 5 min)`,
        atomic_steps: [
          `Listar los 2 requisitos esenciales de ${queryGoal.slice(0, 25)}`,
          `Crear la estructura inicial sin buscar perfección`,
          `Escribir la primera función o bloque concreto`,
          `Revisar 10 min y registrar logro en Bitácora`
        ],
        estimated_total_minutes: 65,
        anti_optimism_notes: 'Buffer +30% aplicado para contrarrestar la ceguera temporal habitual del TDAH.'
      };
    }

    this.lastDeconstruction = { data, projectId: p ? p.id : null, goalText: queryGoal };
    this.renderAIDeconstructionResult(data, p);
  }

  renderAIDeconstructionResult(data, project) {
    const body = document.getElementById('ai-deconstruct-body');
    if (!body) return;

    const steps = data.atomic_steps || [];
    const firstTwo = steps.slice(0, 2);
    const remaining = steps.slice(2);
    const pId = project ? project.id : (this.selectedKanbanProjectId || (this.state.projects[0] ? this.state.projects[0].id : ''));

    body.innerHTML = `
      <div class="space-y-4">
        <!-- Header Meta -->
        <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border flex items-center justify-between">
          <div>
            <span class="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">Meta Analizada</span>
            <h4 class="font-display font-bold text-sm text-white">${data.goal_title || 'Meta TDAH'}</h4>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              ⏱️ ${data.estimated_total_minutes || 60}m reales (+30%)
            </span>
          </div>
        </div>

        <!-- 1. KICKSTART ACTION OBLIGATORIO (PRIMER PASO CLARO) -->
        <div class="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-mono font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🚀</span> Primer Paso Claro (Kickstart Action)
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              &lt; 5-10 min · Resistencia Cero
            </span>
          </div>
          <p class="text-sm font-bold text-white leading-snug mb-3">
            ${data.kickstart_action}
          </p>
          <button onclick="app.startKickstartInOneThing('${pId}', '${data.kickstart_action.replace(/'/g, "\\'")}')" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2">
            <span>🎯</span> Arrancar YA en Modo Solo 1 Cosa
          </button>
        </div>

        <!-- 2. PASOS ATÓMICOS CON PROGRESSIVE DISCLOSURE (EVITA EL AGOBIO) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>🧩</span> Micro-pasos Inmediatos (15 a 20 min máx)
            </span>
            <span class="text-[10px] font-mono theme-text-muted">Desglose secuencial</span>
          </div>

          <div class="space-y-1.5">
            ${firstTwo.map((st, i) => `
              <div class="p-2.5 rounded-xl theme-card-subtle border theme-border flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-lg bg-slate-800 text-amber-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ${i + 1}
                </span>
                <span class="text-xs text-slate-200 leading-snug flex-1">${st}</span>
                <span class="text-[10px] font-mono theme-text-muted shrink-0">15m</span>
              </div>
            `).join('')}

            ${remaining.length > 0 ? `
              <div id="ai-deconstruct-expanded-steps" class="hidden space-y-1.5 pt-1">
                ${remaining.map((st, i) => `
                  <div class="p-2.5 rounded-xl theme-card-subtle border theme-border flex items-start gap-2.5">
                    <span class="w-5 h-5 rounded-lg bg-slate-800 text-slate-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ${i + 3}
                    </span>
                    <span class="text-xs text-slate-200 leading-snug flex-1">${st}</span>
                    <span class="text-[10px] font-mono theme-text-muted shrink-0">15m</span>
                  </div>
                `).join('')}
              </div>

              <button id="ai-deconstruct-toggle-btn" onclick="app.toggleExpandedDeconstructSteps()" class="w-full py-1.5 text-center text-xs font-semibold theme-text-muted hover:text-white transition">
                👁️ Ver los ${remaining.length} pasos siguientes (ocultos para no saturarte) ↓
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Nota Anti-Optimismo -->
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-center gap-2">
          <span>🛡️</span>
          <span><strong>Consejo Anti-Optimismo:</strong> ${data.anti_optimism_notes || 'Tiempos expandidos un +30% para proteger tu tranquilidad.'}</span>
        </div>

        <!-- Toolbar inferior -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t theme-border">
          <button onclick="app.closeModal('modal-ai-deconstruction')" class="px-4 py-2 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cerrar
          </button>
          <button onclick="app.injectAtomicStepsToProject('${pId}')" class="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5">
            <span>➕</span> Inyectar Micro-pasos al Kanban
          </button>
        </div>
      </div>
    `;
  }

  toggleExpandedDeconstructSteps() {
    const el = document.getElementById('ai-deconstruct-expanded-steps');
    const btn = document.getElementById('ai-deconstruct-toggle-btn');
    if (el && btn) {
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btn.textContent = 'Ocultar pasos profundos ↑';
      } else {
        el.classList.add('hidden');
        btn.textContent = '👁️ Ver pasos siguientes ↓';
      }
    }
  }

  startKickstartInOneThing(projectId, kickstartTitle) {
    let p = this.state.projects.find(x => x.id === projectId) || this.state.projects[0];
    if (!p) return;

    if (!p.tasks) p.tasks = [];
    const kickTask = {
      id: this.uid(),
      title: kickstartTitle,
      column: 'enfoco',
      effort: 'S',
      isKickstart: true,
      createdAt: new Date().toISOString()
    };
    p.tasks.unshift(kickTask);
    p.nextAction = kickstartTitle;
    p.lastActivity = new Date().toISOString();
    this.saveState();

    this.closeModal('modal-ai-deconstruction');
    this.openOneThingMode(p.id, kickTask.id);
  }

  injectAtomicStepsToProject(projectId) {
    const info = this.lastDeconstruction;
    if (!info || !info.data) return;

    let p = this.state.projects.find(x => x.id === projectId) || this.state.projects[0];
    if (!p) return;

    if (!p.tasks) p.tasks = [];

    // Inyectar pasos
    const steps = info.data.atomic_steps || [];
    steps.forEach((st, idx) => {
      p.tasks.push({
        id: this.uid(),
        title: st,
        column: idx === 0 ? 'proximo' : 'buzon',
        effort: 'S',
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();
    this.triggerDopamineReward();
    this.closeModal('modal-ai-deconstruction');
    this.selectedKanbanProjectId = p.id;
    this.navigate('kanban');
    alert(`✓ ¡${steps.length} micro-pasos inyectados en el Kanban de "${p.name}"!`);
  }

  // ==========================================
  // SINCRONIZACIÓN INTELIGENTE CON EL CALENDARIO (GAP FILLING & BUFFERS)
  // ==========================================
  openGapFillingModal(taskId, taskTitle, estimatedMinutes = 30, projectId = null) {
    const p = projectId ? this.state.projects.find(x => x.id === projectId) : (this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0]);
    const task = (p?.tasks || []).find(t => t.id === taskId) || { id: taskId, title: taskTitle || 'Micro-tarea' };

    const rawMinutes = parseInt(estimatedMinutes) || 30;
    const antiOptimismMinutes = Math.round(rawMinutes * 1.3); // +30% anti-optimism
    const bufferPrep = 15;
    const bufferDecomp = 15;

    // Hueco mañana a las 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const startIso = tomorrow.toISOString().slice(0, 16);

    const body = document.getElementById('gap-filling-body');
    if (!body) return;

    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-2xl theme-card-subtle border theme-border">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono font-bold uppercase text-blue-400">Tarea Seleccionada</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">${p.emoji || '🎯'} ${p.name}</span>
          </div>
          <h4 class="font-display font-bold text-base text-white">${task.title}</h4>
        </div>

        <!-- Cálculo Anti-Ceguera Temporal -->
        <div class="grid grid-cols-3 gap-2.5 text-center">
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span class="text-[10px] font-mono theme-text-muted uppercase block">Tu Estimación</span>
            <span class="text-sm font-bold text-slate-300">${rawMinutes} min</span>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span class="text-[10px] font-mono text-amber-300 uppercase block">+30% IA Realista</span>
            <span class="text-sm font-bold text-amber-400">${antiOptimismMinutes} min</span>
          </div>
          <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span class="text-[10px] font-mono text-blue-300 uppercase block">Buffers (15m + 15m)</span>
            <span class="text-sm font-bold text-blue-400">+30 min</span>
          </div>
        </div>

        <!-- Explicación de los Buffers TDAH -->
        <div class="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-200/90 space-y-1.5">
          <div class="flex items-center gap-2 font-bold text-blue-300">
            <span>🛡️</span> Colchón de Transición (Task Switching Protection)
          </div>
          <p>
            • <strong>15 min antes:</strong> Entrada suave, abrir archivos, poner café, sin prisa.<br>
            • <strong>${antiOptimismMinutes} min:</strong> Foco en la tarea con tolerancia anti-optimismo.<br>
            • <strong>15 min después:</strong> Descompresión y bitácora para no saltar quemado a la siguiente actividad.
          </p>
        </div>

        <!-- Configuración del Slot de Calendario (El Veto del Usuario) -->
        <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border space-y-3">
          <div class="flex items-center justify-between">
            <label class="font-bold text-xs">Hueco sugerido en Google Calendar:</label>
            <span class="text-[10px] font-mono text-emerald-400">Algoritmo Gap Filling</span>
          </div>
          <input type="datetime-local" id="gap-filling-datetime" value="${startIso}" class="w-full px-3 py-2 rounded-xl theme-card border theme-border font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          <p class="text-[10px] theme-text-muted">
            El Veto del Usuario: Puedes modificar la fecha/hora libremente antes de sincronizar.
          </p>
        </div>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button onclick="app.closeModal('modal-gap-filling')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cancelar
          </button>
          <button onclick="app.confirmGapFilling('${p.id}', '${task.id}', ${antiOptimismMinutes})" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition flex items-center gap-2">
            <span>📅</span> Añadir a Google Calendar
          </button>
        </div>
      </div>
    `;

    this.openModal('modal-gap-filling');
  }

  confirmGapFilling(projectId, taskId, sessionMinutes) {
    const p = this.state.projects.find(x => x.id === projectId);
    const task = (p?.tasks || []).find(t => t.id === taskId);
    const inputDt = document.getElementById('gap-filling-datetime')?.value;

    const baseTime = inputDt ? new Date(inputDt) : new Date();
    const bufferPrepMs = 15 * 60 * 1000;
    const sessionMs = sessionMinutes * 60 * 1000;
    const bufferDecompMs = 15 * 60 * 1000;

    const startTime = new Date(baseTime.getTime() + bufferPrepMs);
    const endTime = new Date(startTime.getTime() + sessionMs);

    const title = `⚡ [${p ? p.name : 'Proyectazo'}] ${task ? task.title : 'Micro-paso'}`;
    const details = `Bloque de Hiperfoco TDAH.\n• Buffer de entrada: 15 min antes (${baseTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})\n• Sesión activa (+30% anti-optimismo): ${sessionMinutes} min\n• Buffer de descompresión: 15 min después (${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})\n\nObjetivo: ${p ? p.objective : ''}`;

    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(baseTime)}/${formatGCal(new Date(endTime.getTime() + bufferDecompMs))}&details=${encodeURIComponent(details)}`;

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_azul');
      this.shaderEngine.pulseShockwave();
    }

    window.open(gcalUrl, '_blank');
    this.closeModal('modal-gap-filling');
    this.showNotification('📅 Bloque con buffers de 15 min enviado a Google Calendar.', 'success');
  }

  // ==========================================
  // INTEGRACIÓN GOOGLE MAIL (GMAIL SMTP & RECORDATORIOS)
  // ==========================================
  async fetchNexus(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = `${this.NEXUS_API_BASE}${cleanEndpoint}`;
    const host = window.location.hostname || 'localhost';
    const isSecure = window.location.protocol === 'https:';
    // En HTTPS no intentar fallback HTTP inseguro ya que el navegador bloquea Mixed Content
    const fallbackUrl = isSecure ? primaryUrl : `http://${host}:8002/api/nexus${cleanEndpoint}`;

    try {
      const res = await fetch(primaryUrl, options);
      if (res.ok) return res;
      if ((res.status === 404 || res.status >= 500) && !isSecure && primaryUrl !== fallbackUrl) {
        return await fetch(fallbackUrl, options);
      }
      return res;
    } catch (primaryErr) {
      if (!isSecure && primaryUrl !== fallbackUrl) {
        return await fetch(fallbackUrl, options);
      }
      throw primaryErr;
    }
  }

  async initGoogleMailStatus() {
    const badge = document.getElementById('google-mail-status-badge');
    const userInp = document.getElementById('setting-gmail-user');
    const recipInp = document.getElementById('setting-gmail-recipient');

    try {
      const res = await this.fetchNexus('/mail/status', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        this.googleMailStatus = data;
        if (badge) {
          if (data.configured) {
            badge.textContent = `🟢 Conectado (${data.gmail_user_masked})`;
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
          } else {
            badge.textContent = '⚪ Sin Configurar';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700';
          }
        }
        if (userInp && !userInp.value && data.gmail_user) userInp.value = data.gmail_user;
        if (recipInp && !recipInp.value && data.default_recipient) recipInp.value = data.default_recipient;
        return;
      }
    } catch (e) {
      console.warn('No se pudo verificar estado de Google Mail:', e);
    }

    if (badge) {
      badge.textContent = '⚪ Desconectado';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700';
    }
  }

  async saveGoogleMailConfig() {
    const userInp = document.getElementById('setting-gmail-user');
    const pwdInp = document.getElementById('setting-gmail-app-password');
    const recipInp = document.getElementById('setting-gmail-recipient');
    const fb = document.getElementById('google-mail-feedback');

    const user = userInp ? userInp.value.trim() : '';
    const pwd = pwdInp ? pwdInp.value.trim().replace(/\s+/g, '') : '';
    const recip = recipInp ? recipInp.value.trim() : '';

    if (!user || !pwd) {
      if (fb) {
        fb.textContent = '❌ El correo Gmail y la Contraseña de Aplicación de 16 caracteres son obligatorios.';
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    if (fb) {
      fb.textContent = '⏳ Guardando credenciales en Nexus...';
      fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 block';
    }

    try {
      const res = await this.fetchNexus('/mail/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmail_user: user,
          gmail_app_password: pwd,
          default_recipient: recip || user
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.googleMailStatus = data;
        if (fb) {
          fb.textContent = '✓ Credenciales guardadas exitosamente en Nexus.';
          fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 block';
        }
        this.initGoogleMailStatus();
        this.showToast('📬 Configuración de Google Mail guardada con éxito.');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      if (fb) {
        fb.textContent = `❌ Error guardando configuración: ${err.message}`;
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
    }
  }

  async testGoogleMailConnection() {
    const userInp = document.getElementById('setting-gmail-user');
    const pwdInp = document.getElementById('setting-gmail-app-password');
    const recipInp = document.getElementById('setting-gmail-recipient');
    const fb = document.getElementById('google-mail-feedback');

    const user = userInp ? userInp.value.trim() : '';
    const pwd = pwdInp ? pwdInp.value.trim().replace(/\s+/g, '') : '';
    const recip = recipInp ? recipInp.value.trim() : '';

    if (!user || !pwd) {
      if (fb) {
        fb.textContent = '❌ Ingresa tu correo Gmail y contraseña de aplicación de 16 caracteres para probar la conexión.';
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    if (fb) {
      fb.textContent = '⏳ Probando conexión con Google Mail (smtp.gmail.com)...';
      fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 block';
    }

    let data = null;
    try {
      const res = await this.fetchNexus('/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: user,
          app_password: pwd,
          to_email: recip || user
        })
      });
      data = await res.json();
    } catch (netErr) {
      if (fb) {
        fb.textContent = `❌ Error de red con microservicio Nexus: ${netErr.message}`;
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    if (data && data.success) {
      if (fb) {
        fb.textContent = `🟢 ${data.message}`;
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 block';
      }
      this.initGoogleMailStatus();
      this.showToast('✨ Conexión con Google Mail exitosa. Correo de prueba enviado.');
    } else {
      if (fb) {
        fb.textContent = `❌ ${data?.error || 'No se pudo conectar a Google Mail'}`;
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
    }
  }

  openDirectGmailWeb(taskTitle = '', body = '') {
    const recipInp = document.getElementById('setting-gmail-recipient') || document.getElementById('setting-gmail-user');
    const to = recipInp?.value || this.googleMailStatus?.default_recipient || '';
    const su = taskTitle ? `[Nexus Tarea] ${taskTitle}` : 'Recordatorio Hive Brain';
    const b = body || 'Micro-paso programado para romper la inercia cognitiva.\n\nAcceso a Hive Brain: http://localhost:8000';
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(b)}`;
    window.open(url, '_blank');
  }

  openScheduleEmailModal(taskId, taskTitle = '', projectId = null) {
    let cleanTitle = taskTitle;
    if (!cleanTitle) {
      const item = this.getPensaderoItem(taskId);
      if (item) cleanTitle = item.content;
      else {
        const p = projectId ? this.state.projects.find(x => x.id === projectId) : null;
        const t = p?.tasks?.find(x => x.id === taskId);
        if (t) cleanTitle = t.title;
      }
    }
    if (!cleanTitle) cleanTitle = 'Tarea Pendiente';

    const titleEl = document.getElementById('schedule-email-task-title');
    const idEl = document.getElementById('schedule-email-task-id');
    const projEl = document.getElementById('schedule-email-project-id');
    const dtEl = document.getElementById('schedule-email-dt');
    const recipEl = document.getElementById('schedule-email-recipient');
    const fb = document.getElementById('schedule-email-feedback');

    if (titleEl) titleEl.textContent = decodeURIComponent(cleanTitle);
    if (idEl) idEl.value = taskId;
    if (projEl) projEl.value = projectId || '';
    if (fb) {
      fb.textContent = '';
      fb.classList.add('hidden');
    }

    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (dtEl) dtEl.value = iso;

    if (recipEl) {
      recipEl.value = this.googleMailStatus?.default_recipient || this.googleMailStatus?.gmail_user || '';
    }

    this.openModal('modal-schedule-email');
  }

  setScheduleEmailPreset(preset) {
    const dtEl = document.getElementById('schedule-email-dt');
    if (!dtEl) return;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');

    if (typeof preset === 'number') {
      const d = new Date(now.getTime() + preset * 60 * 1000);
      dtEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else if (preset === 'tonight') {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      dtEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else if (preset === 'tomorrow_9am') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      dtEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  openDirectGmailWebFromModal() {
    const titleEl = document.getElementById('schedule-email-task-title');
    const recipEl = document.getElementById('schedule-email-recipient');
    const dtEl = document.getElementById('schedule-email-dt');
    const title = titleEl ? titleEl.textContent : 'Tarea Pendiente';
    const to = recipEl ? recipEl.value.trim() : '';
    const when = dtEl ? dtEl.value : '';
    const body = `Hola,\n\nRecordatorio de tarea programada:\n"${title}"\nProgramada para: ${when}\n\nIngresar a Hive Brain:\nhttp://localhost:8000\n\nSaludos,\nNexus AI`;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent('☑️ [Nexus Recordatorio] ' + title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
    this.closeModal('modal-schedule-email');
  }

  async confirmScheduleEmail() {
    const idEl = document.getElementById('schedule-email-task-id');
    const titleEl = document.getElementById('schedule-email-task-title');
    const dtEl = document.getElementById('schedule-email-dt');
    const recipEl = document.getElementById('schedule-email-recipient');
    const fb = document.getElementById('schedule-email-feedback');

    const taskId = idEl ? idEl.value : '';
    const title = titleEl ? titleEl.textContent : 'Tarea Pendiente';
    const scheduledTime = dtEl ? dtEl.value : '';
    const recipient = recipEl ? recipEl.value.trim() : '';

    if (!scheduledTime) {
      if (fb) {
        fb.textContent = '❌ Por favor selecciona la fecha y hora para el aviso.';
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    if (fb) {
      fb.textContent = '⏳ Programando recordatorio en el microservicio...';
      fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 block';
    }

    try {
      const res = await this.fetchNexus('/mail/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          taskTitle: title,
          scheduledTime: scheduledTime,
          recipient: recipient
        })
      });

      const data = await res.json();
      if (data.success) {
        this.closeModal('modal-schedule-email');
        this.showToast(`📧 Recordatorio programado para ${new Date(scheduledTime).toLocaleString('es-ES')}.`);
        if (this.shaderEngine) {
          this.shaderEngine.setSmokeState('humo_tarea');
          this.shaderEngine.pulseShockwave();
        }
      } else {
        if (fb) {
          fb.textContent = `❌ ${data.error || 'No se pudo programar el aviso'}`;
          fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
        }
      }
    } catch (err) {
      if (fb) {
        fb.textContent = `❌ Error conectando al servicio: ${err.message}`;
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
    }
  }

  // ==========================================
  // SISTEMA ANTI-ABANDONO: RESUMEN DE REACTIVACIÓN CON IA & PAUSA SIN CULPA
  // ==========================================
  async reactivateProjectWithGemini(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    const body = document.getElementById('reactivation-briefing-body');
    if (!body) return;

    body.innerHTML = `
      <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
        <div class="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-bold text-sm text-purple-300">Reconectando con tu motivación original sin culpa...</p>
          <p class="text-[11px] theme-text-muted mt-1">Consultando a Gemini para restaurar tu contexto en segundos.</p>
        </div>
      </div>
    `;
    this.openModal('modal-reactivation-briefing');

    let data = null;
    const daysInactive = this.daysSince(p.lastActivity);
    try {
      const res = await fetch(`${this.NEXUS_API_BASE}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: p.name,
          context: p.objective || p.name,
          logs: (p.logs || []).slice(0, 3)
        })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn("Nexus reactivate service offline, using cognitive heuristic", err);
    }

    if (!data || !data.where_you_left_off) {
      const lastLog = (p.logs && p.logs.length > 0) ? p.logs[0].achievement : 'Fase inicial de definición';
      data = {
        project_name: p.name,
        where_you_left_off: lastLog,
        why_it_matters: p.objective || 'Este proyecto encarna una visión clave para simplificar tu trabajo.',
        exact_next_step: p.nextAction || `Abrir el repositorio y revisar el archivo principal 5 minutos sin presión.`,
        encouraging_insight: `Llevas ${daysInactive} días en pausa. Tu cerebro necesitaba recargar energía. Cero culpa; estás exactamente a tiempo.`
      };
    }

    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-bold uppercase text-purple-300 flex items-center gap-1.5">
              <span>${p.emoji || '🎯'}</span> ${p.name}
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border theme-border theme-text-muted">
              ${daysInactive} días en pausa
            </span>
          </div>
          <p class="text-xs text-purple-200/90 italic">
            "${data.encouraging_insight}"
          </p>
        </div>

        <div class="space-y-3">
          <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
              1. ¿En qué te quedaste?
            </span>
            <p class="text-xs leading-relaxed text-slate-200">
              ${data.where_you_left_off}
            </p>
          </div>

          <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
              2. ¿Por qué era importante?
            </span>
            <p class="text-xs leading-relaxed text-slate-200">
              ${data.why_it_matters}
            </p>
          </div>

          <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
              3. Siguiente micro-paso exacto (Sin pensar)
            </span>
            <p class="text-sm font-bold text-white leading-snug">
              ${data.exact_next_step}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button onclick="app.closeModal('modal-reactivation-briefing')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cerrar
          </button>
          <button onclick="app.confirmReactivateProject('${p.id}', '${data.exact_next_step.replace(/'/g, "\\'")}')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-purple-500/25 active:scale-95 transition flex items-center gap-2">
            <span>🚀</span> Despertar y Lanzar Solo 1 Cosa
          </button>
        </div>
      </div>
    `;
  }

  confirmReactivateProject(projectId, nextAction) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    // Verificar WIP limit al reactivar
    const activeCount = this.state.projects.filter(x => x.status === 'activo' && x.id !== projectId).length;
    if (activeCount >= 3) {
      this.showToast('⚠️ Máximo 3 proyectos activos para no saturar tu mente. Pon uno en pausa antes de reactivar este.');
      return;
    }

    p.status = 'activo';
    p.nextAction = nextAction;
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.closeModal('modal-reactivation-briefing');
    this.openOneThingMode(p.id);
    this.showNotification(`🌱 Proyecto "${p.name}" reactivado sin culpa.`, 'success');
  }

  hibernateProjectWithoutGuilt(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    p.status = 'hibernado';
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.render();
    this.showNotification(`❄️ "${p.name}" puesto en Pausa sin Culpa (hibernación). Tu energía puede concentrarse libremente.`, 'info');
  }

  openNexusInContext(projectId) {
    this.nexusContextProjectId = projectId;
    const p = this.state.projects.find(x => x.id === projectId);
    this.openNexusVoice(`proyecto:${p ? p.name : projectId}`);
  }

  // ==========================================
  // MODO TRABAJO PROFUNDO (DEEP WORK DRAWER / MODAL)
  // ==========================================
  openDeepWork(projectId, taskId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const task = (p.tasks || []).find(x => x.id === taskId);
    if (!task) return;

    this.currentDeepWork = { projectId, taskId };

    document.getElementById('deepwork-task-title').textContent = task.title;
    document.getElementById('deepwork-project-badge').textContent = `${p.emoji || '🎯'} ${p.name}`;
    document.getElementById('deepwork-notes').value = task.notes || '';
    document.getElementById('deepwork-code').value = task.codeSnippet || '';
    document.getElementById('deepwork-is-bureaucratic').checked = !!task.isBureaucratic;

    this.renderDeepworkSubsteps(task);
    this.openModal('deepwork-modal');
  }

  renderDeepworkSubsteps(task) {
    const list = document.getElementById('deepwork-substeps-list');
    if (!list) return;

    const steps = task.substeps || [];
    if (steps.length === 0) {
      list.innerHTML = `<div class="p-3 text-center text-slate-500 italic rounded-xl border border-dashed theme-border">Sin micro-pasos. Añade pasos de ≤5 min para evitar la parálisis.</div>`;
      return;
    }

    list.innerHTML = steps.map((s, idx) => `
      <div class="flex items-center gap-2 p-2 rounded-xl theme-card-subtle border theme-border">
        <input type="checkbox" ${s.done ? 'checked' : ''} onchange="app.toggleDeepworkSubstep(${idx})" class="rounded text-sky-500 focus:ring-0 cursor-pointer" />
        <span class="text-xs flex-1 ${s.done ? 'line-through text-slate-500' : 'font-medium'}">${s.text}</span>
        <button onclick="app.removeDeepworkSubstep(${idx})" class="text-xs text-rose-400 hover:text-rose-300 font-bold px-1">✕</button>
      </div>
    `).join('');
  }

  addDeepworkSubstep() {
    const text = prompt("Micro-paso concreto (≤5 min):");
    if (!text || !text.trim()) return;

    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t) return;

    if (!t.substeps) t.substeps = [];
    t.substeps.push({ text: text.trim(), done: false });
    this.renderDeepworkSubsteps(t);
  }

  toggleDeepworkSubstep(idx) {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t || !t.substeps || !t.substeps[idx]) return;

    t.substeps[idx].done = !t.substeps[idx].done;
    if (t.substeps[idx].done) this.triggerDopamineReward();
    this.renderDeepworkSubsteps(t);
  }

  removeDeepworkSubstep(idx) {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t || !t.substeps) return;

    t.substeps.splice(idx, 1);
    this.renderDeepworkSubsteps(t);
  }

  saveDeepworkCard() {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t) return;

    t.notes = document.getElementById('deepwork-notes').value.trim();
    t.codeSnippet = document.getElementById('deepwork-code').value.trim();
    t.isBureaucratic = document.getElementById('deepwork-is-bureaucratic').checked;

    this.saveState();
    this.closeModal('deepwork-modal');
    this.render();
  }

  // --- RECOMPENSA ESPECIAL POR TAREAS BUROCRÁTICAS / ABURRIDAS ---
  completeBureaucraticTask(projectId, taskId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const t = (p.tasks || []).find(x => x.id === taskId);
    if (!t) return;

    t.column = 'victorias';
    this.saveState();
    this.render();

    this.triggerDopamineReward();
    setTimeout(() => this.triggerDopamineReward(), 200);

    alert(`🎉 ¡VICTORIA ÉPICA CONTRA EL ABURRIMIENTO!\n\nHas completado una tarea burocrática/administrativa:\n"${t.title}"\n\n+100 Puntos de Dopamina. Tu yo del futuro te agradece haber vencido la fricción.`);
  }

  // ==========================================
  // ALGORITMO GAP FILLING (TIMEBLOCKING AUTOMÁTICO)
  // ==========================================
  generateTimeblockForNextAction() {
    const actionInput = document.getElementById('checkout-next-action');
    let taskTitle = actionInput ? actionInput.value.trim() : '';
    const pId = document.getElementById('checkout-project-id')?.value || this.selectedKanbanProjectId;
    const p = this.state.projects.find(x => x.id === pId);

    if (!taskTitle && p) {
      taskTitle = p.nextAction;
    }
    if (!taskTitle) {
      taskTitle = prompt("¿Qué micro-paso deseas agendar en tu calendario?", "Próxima acción clave");
      if (!taskTitle) return;
    }

    // Buscar próximo día laborable (mañana o lunes) a las 10:00 AM
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);
    else if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);

    targetDate.setHours(10, 0, 0, 0);
    const endDate = new Date(targetDate.getTime() + 90 * 60 * 1000); // 90 min bloque

    const formatGCalDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const startStr = formatGCalDate(targetDate);
    const endStr = formatGCalDate(endDate);

    const eventTitle = `⚡ FocusFlow [${p ? p.name : 'Proyectazo'}]: ${taskTitle}`;
    const eventDetails = `Bloque de Trabajo Profundo protegido para TDAH.\n\n🎯 Tarea: ${taskTitle}\n🧵 Hilo de Ariadna: Micro-paso inmediato.\n☕ Buffer de 15 min al terminar para descansar la mente.\n\nGenerado por el algoritmo Gap-Filling de FocusFlow OS.`;

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(eventDetails)}`;

    // Abrir Google Calendar
    window.open(gcalUrl, '_blank');

    // Descargar .ics
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//FocusFlow OS//Proyectazo//ES\nBEGIN:VEVENT\nSUMMARY:${eventTitle}\nDESCRIPTION:${eventDetails.replace(/\n/g, '\\n')}\nDTSTART:${startStr}\nDTEND:${endStr}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timeblock_${taskTitle.slice(0, 20).replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    alert(`✓ ¡Bloque agendado con éxito!\n\n📅 Fecha: ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las 10:00 AM.\n⏱️ Duración: 90 min + 15 min buffer.\nSe abrió Google Calendar y se descargó el evento .ics.`);
  }

  // ==========================================
  // ASISTENTE NEXUS: EL IDEARIO (VOZ A KANBAN & IA GEMINI)
  // ==========================================
  openNexusVoice(context = 'general') {
    this.nexusContext = context;
    const modal = document.getElementById('nexus-voice-modal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('nexus-input');
    if (input) input.value = '';
    const resultBox = document.getElementById('nexus-result-box');
    if (resultBox) resultBox.classList.add('hidden');
  }

  closeNexusVoice() {
    if (this.isNexusListening) {
      this.stopNexusListening();
    }
    this.nexusContextProjectId = null;
    const modal = document.getElementById('nexus-voice-modal');
    if (modal) modal.classList.add('hidden');
  }

  toggleNexusListening() {
    if (this.isNexusListening) {
      this.stopNexusListening();
    } else {
      this.startNexusListening();
    }
  }

  startNexusListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      const label = document.getElementById('nexus-status-label');
      const input = document.getElementById('nexus-input');
      if (label) label.textContent = 'Dictado no activo en este navegador. Escribe aquí tu comando:';
      if (input) {
        input.focus();
        input.placeholder = "Escribe tu comando o pensamiento para Nexus...";
      }
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang = 'es-ES';
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;

      const micWaves = document.getElementById('nexus-mic-waves');
      const micIcon = document.getElementById('nexus-mic-icon');
      const label = document.getElementById('nexus-status-label');
      const input = document.getElementById('nexus-input');

      if (micWaves) micWaves.classList.add('animate-pulse', 'bg-purple-500/40', 'border-purple-400');
      if (micIcon) micIcon.textContent = '🔊';
      if (label) label.textContent = 'Escuchando... Habla ahora.';

      this.speechRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (input) input.value = transcript;
      };

      this.speechRecognition.onend = () => {
        this.stopNexusListening();
        if (input && input.value.trim()) {
          this.processNexusCommand(input.value.trim());
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        this.stopNexusListening();
      };

      this.speechRecognition.start();
      this.isNexusListening = true;
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      this.stopNexusListening();
    }
  }

  stopNexusListening() {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch(e){}
      this.speechRecognition = null;
    }
    this.isNexusListening = false;
    const micWaves = document.getElementById('nexus-mic-waves');
    const micIcon = document.getElementById('nexus-mic-icon');
    const label = document.getElementById('nexus-status-label');
    if (micWaves) micWaves.classList.remove('animate-pulse', 'bg-purple-500/40', 'border-purple-400');
    if (micIcon) micIcon.textContent = '🎙️';
    if (label) label.textContent = 'Presiona para hablar o escribe tu comando';
  }

  classifyThoughtWithGeminiContract(text) {
    const lower = text.toLowerCase();
    let cat = 'humo_dorado';
    let weight = 'medio';

    if (lower.includes('soltar') || lower.includes('olvidar') || lower.includes('intrusivo') || lower.includes('preocupación') || lower.includes('culpa') || lower.includes('ansiedad') || lower.includes('blanco')) {
      cat = 'humo_blanco';
      weight = 'ligero';
    } else if (lower.includes('urgente') || lower.includes('crítico') || lower.includes('critico') || lower.includes('sat') || lower.includes('impuesto') || lower.includes('pagar') || lower.includes('vence') || lower.includes('fuego') || lower.includes('rojo')) {
      cat = 'humo_rojo';
      weight = 'fuego';
    } else if (lower.includes('deep work') || lower.includes('concentra') || lower.includes('código') || lower.includes('codigo') || lower.includes('arquitectura') || lower.includes('estudiar') || lower.includes('programar') || lower.includes('azul')) {
      cat = 'humo_azul';
      weight = 'pesado';
    } else if (lower.includes('hábito') || lower.includes('habito') || lower.includes('bienestar') || lower.includes('salud') || lower.includes('ejercicio') || lower.includes('racha') || lower.includes('verde')) {
      cat = 'humo_verde';
      weight = 'ligero';
    } else if (lower.includes('llamar') || lower.includes('amigo') || lower.includes('mamá') || lower.includes('mama') || lower.includes('papá') || lower.includes('papa') || lower.includes('contacto') || lower.includes('familia') || lower.includes('púrpura') || lower.includes('purpura') || lower.includes('morado')) {
      cat = 'humo_purpura';
      weight = 'medio';
    } else if (lower.includes('comprar') || lower.includes('dinero') || lower.includes('costo') || lower.includes('precio') || lower.includes('tarjeta') || lower.includes('gasto') || lower.includes('naranja')) {
      cat = 'humo_naranja';
      weight = 'medio';
    } else if (lower.includes('algún día') || lower.includes('algun dia') || lower.includes('someday') || lower.includes('futuro') || lower.includes('quizás') || lower.includes('quizas') || lower.includes('congelar') || lower.includes('ceniza')) {
      cat = 'humo_ceniza';
      weight = 'ligero';
    } else if (lower.includes('tarea') || lower.includes('pendiente') || lower.includes('quehacer') || lower.includes('to-do') || lower.includes('todo') || lower.includes('hacer') || lower.includes('mandar') || lower.includes('enviar') || lower.includes('trámite') || lower.includes('tramite') || lower.includes('revisar') || lower.includes('índigo') || lower.includes('indigo')) {
      cat = 'humo_tarea';
      weight = 'medio';
    } else {
      cat = 'humo_dorado';
      weight = 'medio';
    }

    const meta = SMOKE_PALETTE[cat] || SMOKE_PALETTE.humo_dorado;
    return {
      thought: text,
      category: cat,
      color_hex: meta.hex,
      color_vec3: meta.vec3,
      cognitive_weight: weight,
      module: meta.module,
      action: meta.title,
      shader_params: meta.shader
    };
  }

  processNexusCommand(customText = '') {
    const text = (customText || document.getElementById('nexus-input')?.value || '').trim();
    if (!text) return;

    const lower = text.toLowerCase();
    let targetProjectId = null;
    let targetProject = null;
    let cleanTaskTitle = text;

    if (this.nexusContextProjectId) {
      targetProjectId = this.nexusContextProjectId;
      targetProject = this.state.projects.find(p => p.id === targetProjectId);
    }

    // Aliases para relacionar proyectos
    const projectAliases = [
      { id: 'p-naturissima', keywords: ['farmacia', 'botánica', 'botanica', 'naturissima', 'ámbar', 'ambar', 'frascos', 'tienda', 'catálogo'] },
      { id: 'p-cytohelix', keywords: ['clínica', 'clinica', 'cytohelix', 'cita', 'agenda', 'pacientes', 'médico', 'medico', 'consultorio'] },
      { id: 'p-fisio', keywords: ['fisio', 'fisioaleph', 'terapia', 'expediente', 'consentimiento', 'rehabilitación'] },
      { id: 'p-blog', keywords: ['blog', 'artículo', 'articulo', 'post', 'publicación'] },
      { id: 'p-iot', keywords: ['iot', 'bombilla', 'sensor', 'luz', 'automatización'] }
    ];

    for (const pa of projectAliases) {
      if (pa.keywords.some(k => lower.includes(k))) {
        targetProjectId = pa.id;
        targetProject = this.state.projects.find(p => p.id === pa.id);
        break;
      }
    }

    if (!targetProject) {
      for (const p of this.state.projects) {
        if (lower.includes(p.name.toLowerCase())) {
          targetProjectId = p.id;
          targetProject = p;
          break;
        }
      }
    }

    const isPensaderoExplicit = lower.includes('pensamiento') || lower.includes('pensadero') || lower.includes('humo') || lower.includes('soltar') || lower.includes('olvidar');

    const resultBox = document.getElementById('nexus-result-box');
    const tagEl = document.getElementById('nexus-detected-tag');
    const summaryEl = document.getElementById('nexus-parsed-summary');
    const previewEl = document.getElementById('nexus-json-preview');
    const dotEl = document.getElementById('nexus-contract-color-dot');

    if (targetProject && !isPensaderoExplicit) {
      cleanTaskTitle = text
        .replace(/^nexus,?\s*/i, '')
        .replace(/^agrega\s+(al\s+proyecto\s+de\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .replace(/^agrega\s+(a\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .replace(/^recuérdame\s+(en\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .trim();
      if (cleanTaskTitle.length < 3) cleanTaskTitle = text;
      cleanTaskTitle = cleanTaskTitle.charAt(0).toUpperCase() + cleanTaskTitle.slice(1);

      this.pendingNexusAction = {
        type: 'add_task',
        projectId: targetProject.id,
        taskTitle: cleanTaskTitle
      };

      if (tagEl) tagEl.textContent = `Proyecto: ${targetProject.name}`;
      if (dotEl) {
        dotEl.style.background = targetProject.color || '#10b981';
        dotEl.style.boxShadow = `0 0 8px ${targetProject.color || '#10b981'}`;
      }
      if (summaryEl) summaryEl.innerHTML = `Crear nueva tarea en el Buzón de <strong>${targetProject.emoji || '🎯'} ${targetProject.name}</strong>:<br>"${cleanTaskTitle}"`;
      if (previewEl) {
        previewEl.textContent = JSON.stringify({
          action: "add_task_to_backlog",
          project_id: targetProject.id,
          project_name: targetProject.name,
          task_title: cleanTaskTitle,
          cognitive_weight: "medio"
        }, null, 2);
      }
    } else {
      const contract = this.classifyThoughtWithGeminiContract(text);
      const meta = SMOKE_PALETTE[contract.category];

      this.pendingNexusAction = {
        type: 'pensadero',
        contract: contract
      };

      if (dotEl) {
        dotEl.style.background = contract.color_hex;
        dotEl.style.boxShadow = `0 0 10px ${contract.color_hex}`;
      }
      if (tagEl) {
        tagEl.textContent = `${meta.icon} ${meta.name} · Peso: ${contract.cognitive_weight}`;
      }
      if (summaryEl) {
        summaryEl.innerHTML = `
          <strong>Destino:</strong> ${meta.title}<br>
          <strong>Pensamiento:</strong> "${text}"
        `;
      }
      if (previewEl) {
        previewEl.textContent = JSON.stringify(contract, null, 2);
      }

      if (this.shaderEngine) {
        this.shaderEngine.setSmokeState(contract.category, contract.shader_params);
      }
    }

    if (resultBox) resultBox.classList.remove('hidden');
  }

  confirmNexusAction() {
    if (!this.pendingNexusAction) return;
    const act = this.pendingNexusAction;

    if (act.type === 'add_task') {
      const p = this.state.projects.find(x => x.id === act.projectId);
      if (p) {
        if (!p.tasks) p.tasks = [];
        p.tasks.push({
          id: this.uid(),
          title: act.taskTitle,
          column: 'buzon',
          effort: 'M',
          createdAt: new Date().toISOString()
        });
        this.saveState();
        this.triggerDopamineReward();
        this.closeNexusVoice();
        this.selectedKanbanProjectId = p.id;
        this.navigate('hacer');
        this.showToast(`✓ Idea agregada al Buzón de '${p.name}'`);
      }
    } else if (act.type === 'pensadero') {
      const c = act.contract;
      if (!this.state.pensadero) this.state.pensadero = [];

      const newThought = {
        id: this.uid(),
        content: c.thought,
        category: c.category,
        cognitiveWeight: c.cognitive_weight,
        module: c.module,
        amount: (c.category === 'humo_naranja') ? 50 : null,
        contactName: (c.category === 'humo_purpura') ? 'Contacto' : null,
        hibernatedUntil: (c.category === 'humo_ceniza') ? Date.now() + 14 * 86400000 : null,
        isPinned: false,
        isResolved: false,
        createdAt: new Date().toISOString()
      };

      this.state.pensadero.unshift(newThought);
      this.saveState();
      this.triggerDopamineReward();

      if (this.shaderEngine) {
        this.shaderEngine.setSmokeState(c.category, c.shader_params);
        this.shaderEngine.pulseShockwave();
      }

      if (c.category === 'humo_rojo') {
        if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch(e){}
      }

      if (this.backendAvailable) {
        fetch(`${this.API_BASE}/pensadero`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: c.thought, category: c.category })
        }).catch(() => {});
      }

      this.closeNexusVoice();
      this.navigate('soltar');
      this.showToast(`✓ Pensamiento guardado en Soltar`);
    }

    this.pendingNexusAction = null;
  }

  dictateField(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      input.focus();
      const origPlaceholder = input.placeholder;
      input.placeholder = "Dictado de voz no soportado en este navegador. Escribe aquí...";
      input.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => {
        input.placeholder = origPlaceholder;
        input.classList.remove('ring-2', 'ring-amber-500');
      }, 3500);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;

    const origPlaceholder = input.placeholder;
    input.placeholder = "🎙️ Escuchando... Habla ahora...";
    input.classList.add('ring-2', 'ring-purple-500');

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (input.tagName.toLowerCase() === 'textarea') {
        input.value = input.value ? (input.value + ' ' + transcript) : transcript;
      } else {
        input.value = transcript;
      }
    };

    rec.onend = () => {
      input.placeholder = origPlaceholder;
      input.classList.remove('ring-2', 'ring-purple-500');
    };

    rec.onerror = () => {
      input.placeholder = origPlaceholder;
      input.classList.remove('ring-2', 'ring-purple-500');
    };

    rec.start();
  }

  syncRedSmokeToGoogle(id, encodedText) {
    const text = decodeURIComponent(encodedText);
    const title = `🔴 URGENTE: ${text}`;
    const details = `Pendiente crítico de El Pensadero (FocusFlow OS / TDAH).\n\nCreado: ${new Date().toLocaleString('es-ES')}`;

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${encodeURIComponent(details)}`;

    window.open(gcalUrl, '_blank');
    alert(`✓ Sincronizando con Google:\nSe abrió Google Calendar para agendar este pendiente prioritario.`);
  }

  releaseWhiteSmoke(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    if (this.state.settings?.sound) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') { ctx.resume(); }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch(e) {}
    }

    this.deletePensaderoItem(item.id);
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_blanco');
      this.shaderEngine.pulseShockwave();
    }
    alert("💨 Pensamiento soltado y disuelto en humo blanco.\nTu memoria de trabajo inmediata ha quedado liberada sin culpa.");
  }

  chewGoldSmoke(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const step1 = prompt("Micro-paso 1 de 15 min (inmediato y sin fricción):", `Definir alcance básico de: ${item.content.slice(0, 30)}`);
    if (!step1) return;
    const step2 = prompt("Micro-paso 2 de 15 min:", "Buscar 2 referencias o herramientas existentes");
    const step3 = prompt("Micro-paso 3 de 15 min:", "Hacer prototipo mínimo viable");

    const steps = [step1, step2, step3].filter(Boolean);
    steps.forEach((s, i) => {
      this.state.pensadero.unshift({
        id: this.uid(),
        content: `[Paso ${i+1}/3 - 15m] ${s}`,
        category: 'humo_dorado',
        cognitiveWeight: 'ligero',
        module: 'Proyectos Oro',
        isPinned: false,
        isResolved: false,
        createdAt: new Date().toISOString()
      });
    });
    this.saveState();
    this.render();
    this.triggerDopamineReward();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_dorado');
      this.shaderEngine.pulseShockwave();
    }
    alert(`✓ ¡Idea masticada en ${steps.length} micro-pasos de 15 minutos! Ahora es fácil de iniciar.`);
  }

  scheduleDeepWorkBlock(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const now = new Date();
    const slotDate = new Date(now.getTime() + 24 * 3600 * 1000);
    slotDate.setHours(10, 15, 0, 0); // 15 min buffer after 10:00
    const endDate = new Date(slotDate.getTime() + 2 * 3600 * 1000); // 2 hours

    const title = `💻 DEEP WORK: ${item.content}`;
    const details = `Bloque de Hiperfoco TDAH.\nBuffer de preparación: 15 min.\nSesión: 2 horas ininterrumpidas.\nBuffer de descompresión: 15 min.`;
    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(slotDate)}/${formatGCal(endDate)}&details=${encodeURIComponent(details)}`;

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_azul');
      this.shaderEngine.pulseShockwave();
    }

    window.open(gcalUrl, '_blank');
    alert(`✓ Gap Filling Automático:\nSe agendó un bloque de 2 horas con buffers de 15 min de descanso antes y después en tu Google Calendar.`);
  }

  registerHabitStreak(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.streakCount = (item.streakCount || 0) + 1;
    item.lastCompleted = new Date().toISOString();
    this.saveState();
    this.render();
    this.triggerDopamineReward();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_verde');
      this.shaderEngine.pulseShockwave();
    }
    alert(`🎉 ¡Racha alimentada! Llevas ${item.streakCount} días consecutivos en este hábito. Neurotransmisores de dopamina recargados.`);
  }

  openPersonalCRM(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const name = item.contactName || "Carlos Méndez";
    const context = item.contactContext || "Le encanta el café de especialidad. Su mamá estuvo en el hospital la semana pasada. No hablar de política.";
    alert(`💜 AVATAR DE MEMORIA (CRM Personal)\n\nPersona: ${name}\nContexto: ${context}\n\n💡 Tip TDAH: Llama o envía un mensaje de voz breve ahora mismo. Ya tienes el contexto fresco para vencer la parálisis social.`);
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_purpura');
    }
  }

  registerFinancialFriction(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const currentAmount = item.amount || 50;
    const res = prompt(`💳 Fricción Financiera TDAH\n\n¿Cuánto cuesta esta compra/gasto ($ USD)?`, currentAmount);
    if (res === null) return;
    const amount = parseFloat(res);
    if (isNaN(amount) || amount <= 0) return;

    item.amount = amount;
    const remaining = Math.max(0, this.freeMoneyMonthly - amount);
    const percent = Math.round((amount / this.freeMoneyMonthly) * 100);

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_naranja');
      this.shaderEngine.pulseShockwave();
    }

    const choice = confirm(`Impacto en tu Dinero Libre del Mes:\n\n• Gasto propuesto: $${amount} USD\n• Representa el ${percent}% de tu colchón mensual libre ($${this.freeMoneyMonthly} USD).\n• Dinero libre restante: $${remaining} USD.\n\n¿Deseas registrarlo como compra consciente [Aceptar] o enviarlo al congelador 72h para enfriar el impulso [Cancelar]?`);

    if (!choice) {
      item.category = 'humo_ceniza';
      item.hibernatedUntil = Date.now() + 3 * 86400000; // 72 hours cooldown
      this.saveState();
      this.render();
      alert(`❄️ Gasto enviado al congelador por 72 horas para evaluar si realmente lo necesitas.`);
    } else {
      this.freeMoneyMonthly = remaining;
      this.saveState();
      this.render();
      alert(`✓ Gasto registrado con consciencia. Colchón restante: $${remaining} USD.`);
    }
  }

  hibernateThought(target, days = 14) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.category = 'humo_ceniza';
    item.hibernatedUntil = Date.now() + days * 86400000;
    this.saveState();
    this.render();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_ceniza');
    }
    alert(`❄️ Pensamiento hibernado por ${days} días.\nSe ha hundido en el núcleo del Pensadero para no sobrecargar tu pantalla.`);
  }

  wakeThought(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.hibernatedUntil = null;
    item.category = 'humo_dorado';
    this.saveState();
    this.render();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_dorado');
      this.shaderEngine.pulseShockwave();
    }
    alert(`☀️ Pensamiento despertado y devuelto a Proyectos Oro.`);
  }

  sendPensaderoToFreeform(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    this.navigate('freeform');
    setTimeout(() => {
      if (this.freeform && this.freeform.ctx) {
        this.freeform.ctx.font = 'bold 16px sans-serif';
        this.freeform.ctx.fillStyle = '#f8fafc';
        this.freeform.ctx.fillText(item.content.slice(0, 50), 60, 60);
        this.saveFreeformState();
      }
    }, 150);
  }

  changeKanbanProject(projectId) {
    this.selectedKanbanProjectId = projectId;
    this.render();
  }

  openKanbanProject(projectId) {
    this.selectedKanbanProjectId = projectId;
    this.openDespegue(projectId);
  }

  handleDragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.target.classList.add('card-dragging');
  }

  handleDragEnd(e) {
    e.target.classList.remove('card-dragging');
    document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drag-over'));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e, targetColumn) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    this.moveTaskToColumn(this.selectedKanbanProjectId, taskId, targetColumn);
  }

  moveTaskToColumn(projectId, taskId, targetColumn) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = (project.tasks || []).find(t => t.id === taskId);
    if (!task || task.column === targetColumn) return;

    if (targetColumn === 'enfoco') {
      const currentEnfoco = (project.tasks || []).filter(t => t.column === 'enfoco');
      if (currentEnfoco.length >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    task.column = targetColumn;

    if (targetColumn === 'victorias') {
      if (task.isBureaucratic) {
        this.completeBureaucraticTask(projectId, taskId);
        return;
      }
      this.triggerDopamineReward();
    }

    this.saveState();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/tasks/${taskId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: targetColumn })
      }).catch(() => {});
    }
  }

  moveTaskPrev(projectId, taskId) {
    const order = ['congelador', 'buzon', 'proximo', 'enfoco', 'esperando', 'victorias'];
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = order.indexOf(task.column);
    if (idx > 0) {
      this.moveTaskToColumn(projectId, taskId, order[idx - 1]);
    }
  }

  moveTaskNext(projectId, taskId) {
    const order = ['congelador', 'buzon', 'proximo', 'enfoco', 'esperando', 'victorias'];
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = order.indexOf(task.column);
    if (idx < order.length - 1) {
      this.moveTaskToColumn(projectId, taskId, order[idx + 1]);
    }
  }

  promptAddTask(projectId, columnKey) {
    this.openCreateTaskModal(projectId, columnKey);
  }

  deleteTask(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    project.tasks = (project.tasks || []).filter(t => t.id !== taskId);
    this.saveState();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/tasks/${taskId}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  // ==========================================
  // VISTA 3: BITÁCORA / DIARIO DE AVANCES
  // ==========================================
  renderViewBitacora(container) {
    let allLogs = [];
    (this.state.projects || []).forEach(p => {
      (p.logs || []).forEach(l => {
        allLogs.push({
          ...l,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji,
          projectColor: p.color
        });
      });
    });

    allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    container.innerHTML = `
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Historial de Victorias</span>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5">
            Bitácora de Logros (${allLogs.length})
          </h1>
          <p class="text-xs theme-text-muted mt-1">La evidencia tangible de tu progreso para neutralizar el síndrome de no haber hecho nada.</p>
        </div>

        <div class="flex items-center gap-2">
          <input type="text" id="bitacora-search" oninput="app.filterBitacora(this.value)" placeholder="Buscar en historial..."
            class="px-3 py-2 rounded-xl theme-card-subtle border theme-border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
          <button onclick="app.printBitacoraReport()" class="px-3.5 py-2 rounded-xl theme-card-subtle hover:brightness-110 text-xs font-semibold border theme-border transition">
            📄 Exportar PDF
          </button>
        </div>
      </div>

      <div id="bitacora-list" class="space-y-3.5">
        ${allLogs.length === 0 ? `
          <div class="p-12 text-center rounded-3xl border border-dashed theme-border theme-text-muted">
            <span class="text-4xl block mb-2">📜</span>
            <p class="font-semibold text-sm">Aún no hay avances registrados.</p>
            <p class="text-xs mt-1">Cada vez que uses el Protocolo de Cierre quedará guardado aquí.</p>
          </div>
        ` : allLogs.map(l => this.renderBitacoraItem(l)).join('')}
      </div>
    `;
  }

  renderBitacoraItem(log) {
    const d = new Date(log.date);
    const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="bitacora-entry p-4 rounded-2xl theme-card border theme-border shadow-sm transition hover:brightness-105">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span class="text-base">${log.projectEmoji}</span>
            <span class="text-xs font-bold">${log.projectName}</span>
            ${log.duration ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full theme-card-subtle theme-text-muted">${log.duration} min</span>` : ''}
          </div>
          <span class="text-[11px] font-mono theme-text-muted">${dateStr}</span>
        </div>

        <p class="text-sm font-medium leading-relaxed">${log.achievement}</p>

        ${log.nextStep ? `
          <div class="mt-2.5 pt-2 border-t theme-border flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <span>→ Llave de reingreso:</span>
            <span class="theme-text-muted font-normal">${log.nextStep}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  filterBitacora(query) {
    const q = (query || '').toLowerCase().trim();
    document.querySelectorAll('.bitacora-entry').forEach(el => {
      const text = el.innerText.toLowerCase();
      el.style.display = text.includes(q) ? 'block' : 'none';
    });
  }

  // ==========================================
  // VISTA 4: RADAR DE PROYECTOS & CARTERA
  // ==========================================
  renderViewRadar(container) {
    const projects = this.state.projects || [];
    const execCount = projects.filter(p => p.status === 'en_ejecucion').length;
    const activeCount = projects.filter(p => p.status === 'activo').length;
    const pausedCount = projects.filter(p => p.status === 'pausado').length;
    const ideaCount = projects.filter(p => p.status === 'idea').length;
    const doneCount = projects.filter(p => p.status === 'completado').length;

    container.innerHTML = `
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Gestión Multiactiva</span>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5">
            Radar de Proyectos
          </h1>
          <p class="text-xs theme-text-muted mt-1">Rota, incuba o despierta proyectos sin culpa cuando tus intereses cambien.</p>
        </div>

        <button onclick="app.openProjectModal()" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition self-start md:self-auto">
          + Crear Proyecto
        </button>
      </div>

      <!-- Métricas de Cartera -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div class="p-4 rounded-2xl theme-card border border-rose-500/40">
          <span class="text-xs text-rose-300 font-semibold block">🔥 En Ejecución</span>
          <span class="text-2xl font-display font-extrabold text-rose-400 mt-1 block">${execCount} / 3</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">⚡ Activos (Radar)</span>
          <span class="text-2xl font-display font-extrabold mt-1 block">${activeCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🟡 En Incubadora</span>
          <span class="text-2xl font-display font-extrabold text-amber-400 mt-1 block">${pausedCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🔵 Chispas / Ideas</span>
          <span class="text-2xl font-display font-extrabold text-sky-400 mt-1 block">${ideaCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🟣 Victorias Finales</span>
          <span class="text-2xl font-display font-extrabold text-purple-400 mt-1 block">${doneCount}</span>
        </div>
      </div>

      <!-- Lista de Proyectos Organizados por Estado -->
      <div class="space-y-6">
        ${['en_ejecucion', 'activo', 'pausado', 'idea', 'completado'].map(st => {
          const group = projects.filter(p => p.status === st);
          const titles = {
            en_ejecucion: '🔥 En Ejecución (Foco Inmediato - Máx. 3)',
            activo: '⚡ Activos (En Radar)',
            pausado: '🟡 En Incubadora / Pausados (Sin Culpa)',
            idea: '🔵 Chispas & Semillas Futuras',
            completado: '🟣 Proyectos Completados'
          };

          return `
            <div>
              <h3 class="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted mb-3">${titles[st]} (${group.length})</h3>
              ${group.length === 0 ? `
                <p class="text-xs theme-text-muted italic py-2">Ninguno en este estado.</p>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${group.map(p => `
                    <div class="p-4 rounded-2xl theme-card border ${st === 'en_ejecucion' ? 'border-rose-500/50 bg-rose-950/10' : 'theme-border'} flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <span class="text-2xl">${p.emoji || '🎯'}</span>
                        <div>
                          <h4 class="font-bold text-sm">${this.escapeHtml(p.name)}</h4>
                          <p class="text-[11px] theme-text-muted truncate max-w-[180px]">${this.escapeHtml(p.nextAction || 'Sin acción')}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button onclick="app.cycleProjectStatus('${p.id}')" class="px-2.5 py-1 rounded-lg theme-card-subtle text-[10px] font-semibold hover:brightness-110" title="Rotar estado">
                          Rotar ↺
                        </button>
                        <button onclick="app.openProjectModal('${p.id}')" class="p-1 theme-text-muted hover:text-white text-xs" title="Editar proyecto">
                          ⚙️
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  cycleProjectStatus(projectId) {
    const order = ['en_ejecucion', 'activo', 'pausado', 'idea', 'completado'];
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const idx = order.indexOf(p.status);
    let nextStatus = order[(idx + 1) % order.length];
    if (nextStatus === 'en_ejecucion') {
      const currentExec = (this.state.projects || []).filter(x => x.status === 'en_ejecucion' && x.id !== projectId);
      if (currentExec.length >= 3) {
        nextStatus = 'activo';
        this.showToast('⚠️ Límite TDAH: Ya tienes 3 proyectos en ejecución. Pasando a Activo (En Radar).');
      }
    }
    p.status = nextStatus;
    this.saveState();
    this.render();
  }

  // ==========================================
  // PROTOCOLO DE CIERRE (CHECKOUT)
  // ==========================================
  openCheckout(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    document.getElementById('checkout-project-id').value = p.id;
    document.getElementById('checkout-project-badge').textContent = `${p.emoji || '🎯'} ${p.name}`;
    document.getElementById('checkout-achievement').value = '';
    document.getElementById('checkout-next-action').value = p.nextAction || '';
    document.getElementById('checkout-action-type').value = p.nextActionType || 'hacer';
    document.getElementById('checkout-energy').value = p.energy || 'media';

    document.querySelectorAll('input[name="checkout-status"]').forEach(r => {
      r.checked = (r.value === p.status);
    });

    this.openModal('modal-checkout');
  }

  submitCheckout(e) {
    e.preventDefault();
    const projectId = document.getElementById('checkout-project-id').value;
    const achievement = document.getElementById('checkout-achievement').value.trim();
    const nextAction = document.getElementById('checkout-next-action').value.trim();
    const actionType = document.getElementById('checkout-action-type').value;
    const energy = document.getElementById('checkout-energy').value;
    const status = document.querySelector('input[name="checkout-status"]:checked').value;

    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    const newLog = {
      id: this.uid(),
      date: new Date().toISOString(),
      achievement: achievement,
      nextStep: nextAction,
      energy: energy,
      duration: 25
    };

    if (!p.logs) p.logs = [];
    p.logs.unshift(newLog);

    p.nextAction = nextAction;
    p.nextActionType = actionType;
    p.energy = energy;
    p.status = status;
    p.lastActivity = new Date().toISOString();

    this.saveState();
    this.closeModal('modal-checkout');
    this.triggerDopamineReward();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projectId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement: achievement,
          nextStep: nextAction,
          nextActionType: actionType,
          energy: energy,
          status: status,
          duration: 25
        })
      }).catch(() => {});
    }
  }

  // ==========================================
  // QUICK CAPTURE MODAL
  // ==========================================
  openQuickCapture() {
    const targetSelect = document.getElementById('quick-capture-target');
    if (targetSelect) {
      targetSelect.innerHTML = `
        <option value="pensadero">🧠 El Pensadero (descarga mental)</option>
        ${(this.state.projects || []).map(p => `
          <option value="${p.id}">🎯 Tarea en: ${p.emoji || '🎯'} ${p.name}</option>
        `).join('')}
      `;
    }
    document.getElementById('quick-capture-text').value = '';
    this.openModal('modal-quick-capture');
    setTimeout(() => document.getElementById('quick-capture-text').focus(), 100);
  }

  submitQuickCapture(e) {
    e.preventDefault();
    const text = document.getElementById('quick-capture-text').value.trim();
    const target = document.getElementById('quick-capture-target').value;
    if (!text) return;

    if (target === 'pensadero') {
      if (!this.state.pensadero) this.state.pensadero = [];
      this.state.pensadero.unshift({
        id: this.uid(),
        content: text,
        category: 'chispa',
        isPinned: false,
        createdAt: new Date().toISOString()
      });

      if (this.backendAvailable) {
        fetch(`${this.API_BASE}/pensadero`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text, category: 'chispa' })
        }).catch(() => {});
      }
    } else {
      const p = this.state.projects.find(x => x.id === target);
      if (p) {
        if (!p.tasks) p.tasks = [];
        const task = {
          id: this.uid(),
          title: text,
          column: 'buzon',
          effort: 'S',
          createdAt: new Date().toISOString()
        };
        p.tasks.unshift(task);

        if (this.backendAvailable) {
          fetch(`${this.API_BASE}/projects/${target}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
          }).catch(() => {});
        }
      }
    }

    this.saveState();
    this.closeModal('modal-quick-capture');
    this.render();
  }

  // ==========================================
  // PROJECT CRUD
  // ==========================================
  openProjectModal(projectId = null) {
    const titleEl = document.getElementById('project-modal-title');
    const deleteBtn = document.getElementById('btn-delete-project');

    if (projectId) {
      const p = this.state.projects.find(x => x.id === projectId);
      if (!p) return;
      titleEl.textContent = 'Editar Proyecto';
      document.getElementById('project-form-id').value = p.id;
      document.getElementById('project-form-emoji').value = p.emoji || '⚡';
      document.getElementById('project-form-name').value = p.name || '';
      document.getElementById('project-form-objective').value = p.objective || '';
      document.getElementById('project-form-next-action').value = p.nextAction || '';
      document.getElementById('project-form-keywords').value = p.keywords || '';
      document.getElementById('project-form-status').value = p.status || 'activo';
      document.getElementById('project-form-energy').value = p.energy || 'media';
      this.selectProjectColor(p.color || '#10b981');
      deleteBtn.classList.remove('hidden');
    } else {
      titleEl.textContent = 'Nuevo Proyecto';
      document.getElementById('project-form-id').value = '';
      document.getElementById('project-form-emoji').value = '⚡';
      document.getElementById('project-form-name').value = '';
      document.getElementById('project-form-objective').value = '';
      document.getElementById('project-form-next-action').value = '';
      document.getElementById('project-form-keywords').value = '';
      document.getElementById('project-form-status').value = 'activo';
      document.getElementById('project-form-energy').value = 'media';
      this.selectProjectColor('#10b981');
      deleteBtn.classList.add('hidden');
    }

    this.openModal('modal-project');
  }

  submitProjectForm(e) {
    e.preventDefault();
    const id = document.getElementById('project-form-id').value;
    const emoji = document.getElementById('project-form-emoji').value.trim() || '⚡';
    const name = document.getElementById('project-form-name').value.trim();
    const color = document.getElementById('project-form-color').value;
    const objective = document.getElementById('project-form-objective').value.trim();
    const nextAction = document.getElementById('project-form-next-action').value.trim() || 'Definir primera micro-acción';
    const status = document.getElementById('project-form-status').value;
    const energy = document.getElementById('project-form-energy').value;
    const keywords = document.getElementById('project-form-keywords').value
      .split(',').map(k => k.trim()).filter(Boolean).join(', ');

    // Límite TDAH: Máximo 3 proyectos "en_ejecucion" simultáneamente
    if (status === 'en_ejecucion') {
      const currentExecution = (this.state.projects || []).filter(p => p.status === 'en_ejecucion' && p.id !== id);
      if (currentExecution.length >= 3) {
        alert('⚠️ Límite TDAH: Máximo 3 proyectos En Ejecución simultáneos.\n\nPara proteger tu cerebro de la dispersión, FocusFlow OS limita los proyectos en ejecución inmediata a 3.\n\nPasa uno de tus proyectos a "Activo (En Radar)" o a "Incubadora" antes de poner este en ejecución.');
        return;
      }
    }

    if (id) {
      const p = this.state.projects.find(x => x.id === id);
      if (p) {
        p.emoji = emoji;
        p.name = name;
        p.color = color;
        p.objective = objective;
        p.nextAction = nextAction;
        p.status = status;
        p.energy = energy;
        p.keywords = keywords;

        if (this.backendAvailable) {
          fetch(`${this.API_BASE}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          }).catch(() => {});
        }
      }
    } else {
      const newProject = {
        id: this.uid(),
        name: name,
        emoji: emoji,
        color: color,
        objective: objective,
        nextAction: nextAction,
        nextActionType: 'hacer',
        status: status,
        energy: energy,
        keywords: keywords,
        lastActivity: new Date().toISOString(),
        logs: [],
        tasks: [
          { id: this.uid(), title: nextAction, column: 'proximo', effort: 'S', createdAt: new Date().toISOString() }
        ]
      };
      this.state.projects.unshift(newProject);

      if (this.backendAvailable) {
        fetch(`${this.API_BASE}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProject)
        }).catch(() => {});
      }
    }

    this.saveState();
    this.closeModal('modal-project');
    this.render();
  }

  deleteCurrentProject() {
    const id = document.getElementById('project-form-id').value;
    if (!id) return;
    if (this.deleteProject(id)) this.closeModal('modal-project');
  }

  // También lo usa el botón 🗑️ de los proyectos del Baúl
  deleteProject(id) {
    const p = (this.state.projects || []).find(x => x.id === id);
    if (!p) return false;
    if (!confirm(`¿Seguro que deseas eliminar "${p.name}" y todo su historial?`)) return false;
    this.state.projects = this.state.projects.filter(x => x.id !== id);
    this.saveState();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    return true;
  }

  // ==========================================
  // GESTIÓN DE EJECUCIÓN VS ACTIVO (MÁX 3 EJECUCIÓN)
  // ==========================================
  promoteToEjecucion(projectId) {
    const enEjecucion = (this.state.projects || []).filter(p => p.status === 'en_ejecucion');
    if (enEjecucion.length >= 3) {
      this.showToast('⚠️ Límite TDAH: Ya tienes 3 proyectos en ejecución. Pasa uno a Activo o Incubadora primero.');
      return;
    }
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p) {
      p.status = 'en_ejecucion';
      this.saveState();
      this.render();
      this.showToast(`🔥 ${p.name} ahora está En Ejecución Inmediata`);
    }
  }

  demoteToActivo(projectId) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p) {
      p.status = 'activo';
      this.saveState();
      this.render();
      this.showToast(`⚡ ${p.name} ahora está en el Radar Activo`);
    }
  }

  // ==========================================
  // PENSADERO CRUD (EDITAR / BORRAR PENSAMIENTOS)
  // ==========================================
  openEditThoughtModal(id) {
    const item = this.getPensaderoItem(id);
    if (!item) return;

    document.getElementById('edit-thought-id').value = item.id;
    document.getElementById('edit-thought-content').value = item.content || '';
    document.getElementById('edit-thought-category').value = item.category || 'humo_general';
    document.getElementById('edit-thought-weight').value = item.cognitiveWeight || 'medio';
    document.getElementById('edit-thought-contact').value = item.contactName || '';
    document.getElementById('edit-thought-amount').value = item.amount || '';
    document.getElementById('edit-thought-pinned').checked = !!item.isPinned;
    document.getElementById('edit-thought-resolved').checked = !!item.isResolved;

    this.openModal('modal-edit-thought');
  }

  saveThoughtEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-thought-id').value;
    const content = document.getElementById('edit-thought-content').value.trim();
    const category = document.getElementById('edit-thought-category').value;
    const weight = document.getElementById('edit-thought-weight').value;
    const contact = document.getElementById('edit-thought-contact').value.trim();
    const amount = document.getElementById('edit-thought-amount').value.trim();
    const isPinned = document.getElementById('edit-thought-pinned').checked;
    const isResolved = document.getElementById('edit-thought-resolved').checked;

    if (!content) return;

    const item = this.getPensaderoItem(id);
    if (item) {
      item.content = content;
      item.category = category;
      item.cognitiveWeight = weight;
      item.contactName = contact || null;
      item.amount = amount || null;
      item.isPinned = isPinned;
      item.isResolved = isResolved;
      item.updatedAt = new Date().toISOString();

      this.saveState();
      this.closeModal('modal-edit-thought');
      this.showToast('✓ Pensamiento actualizado');
      this.render();
    }
  }

  deletePensaderoFromEditModal() {
    const id = document.getElementById('edit-thought-id').value;
    if (!id) return;
    this.closeModal('modal-edit-thought');
    this.deletePensaderoItem(id);
  }

  // ==========================================
  // TASK CRUD (CREAR / EDITAR / BORRAR TAREAS)
  // ==========================================
  openCreateTaskModal(projectId = null, columnKey = 'proximo') {
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      alert('Primero crea un proyecto antes de añadir tareas.');
      this.openProjectModal();
      return;
    }

    const projSelect = document.getElementById('add-task-project-id');
    if (projSelect) {
      projSelect.innerHTML = projects.map(p => `
        <option value="${p.id}" ${(projectId === p.id || (!projectId && p.id === this.selectedKanbanProjectId)) ? 'selected' : ''}>
          ${p.emoji || '📁'} ${this.escapeHtml(p.name)}
        </option>
      `).join('');
    }

    document.getElementById('add-task-title').value = '';
    document.getElementById('add-task-column').value = columnKey || 'proximo';
    document.getElementById('add-task-effort').value = 'S';
    document.getElementById('add-task-is-bureaucratic').checked = false;
    document.getElementById('add-task-notes').value = '';

    this.openModal('modal-add-task');
    setTimeout(() => document.getElementById('add-task-title')?.focus(), 100);
  }

  submitCreateTask(e) {
    e.preventDefault();
    const projId = document.getElementById('add-task-project-id').value;
    const title = document.getElementById('add-task-title').value.trim();
    const column = document.getElementById('add-task-column').value;
    const effort = document.getElementById('add-task-effort').value;
    const isBureaucratic = document.getElementById('add-task-is-bureaucratic').checked;
    const notes = document.getElementById('add-task-notes').value.trim();

    if (!title) return;

    const project = (this.state.projects || []).find(p => p.id === projId);
    if (!project) return;

    if (column === 'enfoco') {
      const count = (project.tasks || []).filter(t => t.column === 'enfoco').length;
      if (count >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    const newTask = {
      id: this.uid(),
      title: title,
      column: column,
      effort: effort,
      isBureaucratic: isBureaucratic,
      notes: notes || null,
      createdAt: new Date().toISOString()
    };

    if (!project.tasks) project.tasks = [];
    project.tasks.push(newTask);
    this.saveState();
    this.closeModal('modal-add-task');
    this.showToast('✓ Tarea agregada con éxito');
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      }).catch(() => {});
    }
  }

  openEditTaskModal(projectId, taskId) {
    const project = (this.state.projects || []).find(p => p.id === projectId);
    if (!project) return;
    const task = (project.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    const projects = this.state.projects || [];
    const projSelect = document.getElementById('edit-task-project-id');
    if (projSelect) {
      projSelect.innerHTML = projects.map(p => `
        <option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>
          ${p.emoji || '📁'} ${this.escapeHtml(p.name)}
        </option>
      `).join('');
    }

    document.getElementById('edit-task-original-project-id').value = projectId;
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-column').value = task.column || 'buzon';
    document.getElementById('edit-task-effort').value = task.effort || 'M';
    document.getElementById('edit-task-is-bureaucratic').checked = !!task.isBureaucratic;
    document.getElementById('edit-task-notes').value = task.notes || '';
    document.getElementById('edit-task-code').value = task.codeSnippet || '';

    this.openModal('modal-edit-task');
  }

  saveTaskEdit(e) {
    e.preventDefault();
    const origProjId = document.getElementById('edit-task-original-project-id').value;
    const newProjId = document.getElementById('edit-task-project-id').value;
    const taskId = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value.trim();
    const column = document.getElementById('edit-task-column').value;
    const effort = document.getElementById('edit-task-effort').value;
    const isBureaucratic = document.getElementById('edit-task-is-bureaucratic').checked;
    const notes = document.getElementById('edit-task-notes').value.trim();
    const codeSnippet = document.getElementById('edit-task-code').value.trim();

    if (!title) return;

    const origProject = (this.state.projects || []).find(p => p.id === origProjId);
    if (!origProject) return;

    const targetProject = (this.state.projects || []).find(p => p.id === newProjId) || origProject;

    // Verificar límite WIP si se mueve a 'enfoco'
    if (column === 'enfoco') {
      const currentEnfoco = (targetProject.tasks || []).filter(t => t.column === 'enfoco' && t.id !== taskId);
      if (currentEnfoco.length >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    const taskIndex = (origProject.tasks || []).findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = origProject.tasks[taskIndex];
    task.title = title;
    task.column = column;
    task.effort = effort;
    task.isBureaucratic = isBureaucratic;
    task.notes = notes || null;
    task.codeSnippet = codeSnippet || null;
    task.updatedAt = new Date().toISOString();

    // Si cambió de proyecto asignado:
    if (origProjId !== newProjId) {
      origProject.tasks.splice(taskIndex, 1);
      if (!targetProject.tasks) targetProject.tasks = [];
      targetProject.tasks.push(task);
    }

    this.saveState();
    this.closeModal('modal-edit-task');
    this.showToast('✓ Tarea actualizada');
    this.render();
  }

  deleteTaskFromEditModal() {
    const origProjId = document.getElementById('edit-task-original-project-id').value;
    const taskId = document.getElementById('edit-task-id').value;
    if (!origProjId || !taskId) return;
    this.closeModal('modal-edit-task');
    this.deleteTask(origProjId, taskId);
  }

  // ==========================================
  // VISTA CENTRALIZADA: 📋 TAREAS & PENDIENTES
  // ==========================================
  renderViewTareas(container) {
    if (!this.tareasFilter) this.tareasFilter = 'all';
    if (!this.tareasProjectFilter) this.tareasProjectFilter = 'all';
    if (!this.tareasSearchQuery) this.tareasSearchQuery = '';

    const projects = this.state.projects || [];

    let allTasks = [];
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        allTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji || '📁',
          projectColor: p.color || '#10b981',
          projectStatus: p.status
        });
      });
    });

    const totalCount = allTasks.length;
    const enfocoCount = allTasks.filter(t => t.column === 'enfoco').length;
    const proximoCount = allTasks.filter(t => t.column === 'proximo').length;
    const buzonCount = allTasks.filter(t => t.column === 'buzon').length;
    const coolingCount = allTasks.filter(t => {
      const days = this.daysSince(t.createdAt);
      return (t.column === 'enfoco' || t.column === 'proximo') && days >= 7;
    }).length;
    const congeladorCount = allTasks.filter(t => t.column === 'congelador').length;
    const victoriasCount = allTasks.filter(t => t.column === 'victorias').length;

    let filtered = allTasks;

    if (this.tareasProjectFilter !== 'all') {
      filtered = filtered.filter(t => t.projectId === this.tareasProjectFilter);
    }

    if (this.tareasFilter !== 'all') {
      if (this.tareasFilter === 'cooling') {
        filtered = filtered.filter(t => {
          const days = this.daysSince(t.createdAt);
          return (t.column === 'enfoco' || t.column === 'proximo') && days >= 7;
        });
      } else {
        filtered = filtered.filter(t => t.column === this.tareasFilter);
      }
    }

    if (this.tareasSearchQuery && this.tareasSearchQuery.trim()) {
      const q = this.tareasSearchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.projectName && t.projectName.toLowerCase().includes(q))
      );
    }

    const columnBadges = {
      enfoco: { label: '🔥 En Foco', class: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
      proximo: { label: '🎯 Próximo Paso', class: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
      buzon: { label: '📥 Buzón', class: 'bg-slate-700 text-slate-300 border-slate-600' },
      congelador: { label: '❄️ Congelador', class: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
      victorias: { label: '🏆 Victoria', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' }
    };

    const effortBadges = {
      XS: 'bg-emerald-500/15 text-emerald-400',
      S: 'bg-teal-500/15 text-teal-300',
      M: 'bg-amber-500/15 text-amber-300',
      L: 'bg-purple-500/15 text-purple-300'
    };

    container.innerHTML = `
      <!-- Header Tareas & Pendientes -->
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">Gestión Global</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">${totalCount} Tarjetas</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5 flex items-center gap-2.5">
            <span>📋</span> Centro de Tareas & Pendientes
          </h1>
          <p class="text-xs theme-text-muted mt-1">Visión consolidada de todas las tarjetas y tareas de tus proyectos con edición completa.</p>
        </div>

        <div class="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button onclick="app.openCreateTaskModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5">
            <span>➕</span> Nueva Tarea
          </button>
        </div>
      </div>

      <!-- Métricas Rápidas de Tareas -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        <button onclick="app.setTareasFilter('all')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'all' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] theme-text-muted font-semibold block">Todas</span>
          <span class="text-xl font-display font-extrabold text-white mt-0.5 block">${totalCount}</span>
        </button>
        <button onclick="app.setTareasFilter('enfoco')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'enfoco' ? 'border-rose-500 ring-2 ring-rose-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-rose-300 font-semibold block">🔥 En Foco</span>
          <span class="text-xl font-display font-extrabold text-rose-400 mt-0.5 block">${enfocoCount}</span>
        </button>
        <button onclick="app.setTareasFilter('proximo')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'proximo' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-cyan-300 font-semibold block">🎯 Próximo</span>
          <span class="text-xl font-display font-extrabold text-cyan-400 mt-0.5 block">${proximoCount}</span>
        </button>
        <button onclick="app.setTareasFilter('buzon')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'buzon' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-amber-300 font-semibold block">📥 Buzón</span>
          <span class="text-xl font-display font-extrabold text-amber-400 mt-0.5 block">${buzonCount}</span>
        </button>
        <button onclick="app.setTareasFilter('cooling')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'cooling' ? 'border-sky-500 ring-2 ring-sky-500/30' : 'theme-border'} text-left transition hover:brightness-105" title="Tareas estancadas por más de 7 días">
          <span class="text-[11px] text-sky-300 font-semibold block">❄️ Enfriándose</span>
          <span class="text-xl font-display font-extrabold text-sky-400 mt-0.5 block">${coolingCount}</span>
        </button>
        <button onclick="app.setTareasFilter('victorias')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'victorias' ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-emerald-300 font-semibold block">🏆 Victorias</span>
          <span class="text-xl font-display font-extrabold text-emerald-400 mt-0.5 block">${victoriasCount}</span>
        </button>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="mb-6 p-3.5 rounded-2xl theme-card border theme-border flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div class="w-full md:w-72 relative">
          <input type="text" value="${this.escapeHtml(this.tareasSearchQuery)}" 
            oninput="app.setTareasSearch(this.value)"
            placeholder="🔍 Buscar en tareas y notas..."
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          <span class="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span class="text-xs font-bold text-slate-400 shrink-0">Proyecto:</span>
          <select onchange="app.setTareasProjectFilter(this.value)" class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500">
            <option value="all" ${this.tareasProjectFilter === 'all' ? 'selected' : ''}>Todos los Proyectos (${projects.length})</option>
            ${projects.map(p => `
              <option value="${p.id}" ${this.tareasProjectFilter === p.id ? 'selected' : ''}>
                ${p.emoji || '📁'} ${this.escapeHtml(p.name)} (${(p.tasks || []).length})
              </option>
            `).join('')}
          </select>

          <button onclick="app.setTareasFilter('all'); app.setTareasProjectFilter('all'); app.setTareasSearch('');" class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold shrink-0" title="Restablecer filtros">
            ↺ Limpiar
          </button>
        </div>
      </div>

      <!-- Listado de Tarjetas de Tareas -->
      ${filtered.length === 0 ? `
        <div class="p-12 text-center theme-card rounded-3xl border theme-border space-y-3">
          <div class="text-4xl">✨</div>
          <h4 class="text-base font-bold text-white">No hay tareas que coincidan</h4>
          <p class="text-xs theme-text-muted max-w-sm mx-auto">Ajusta los filtros o agrega una nueva tarea a cualquiera de tus proyectos.</p>
          <button onclick="app.openCreateTaskModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition">
            + Crear Tarea
          </button>
        </div>
      ` : `
        <div class="space-y-2.5">
          ${filtered.map(t => {
            const colMeta = columnBadges[t.column] || columnBadges.buzon;
            const effortClass = effortBadges[t.effort] || effortBadges.M;
            const ageDays = this.daysSince(t.createdAt);
            const isCooling = (t.column === 'enfoco' || t.column === 'proximo') && ageDays >= 7;

            return `
              <div class="p-4 rounded-2xl theme-card border ${isCooling ? 'border-sky-500/40 bg-sky-950/10' : 'theme-border'} shadow-sm hover:border-cyan-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                style="border-left: 4px solid ${t.projectColor};">

                <div class="flex-1 min-w-0">
                  <!-- Badges y Origen -->
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border ${colMeta.class}">
                      ${colMeta.label}
                    </span>

                    <button onclick="app.openKanbanProject('${t.projectId}')" class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition" title="Ir al Kanban de este proyecto">
                      <span>${t.projectEmoji}</span>
                      <span class="max-w-[120px] truncate">${this.escapeHtml(t.projectName)}</span>
                    </button>

                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${effortClass}">
                      ${t.effort || 'M'}
                    </span>

                    ${t.isBureaucratic ? `
                      <span class="badge-bureaucracy text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                        📑 Burocrática
                      </span>
                    ` : ''}

                    ${isCooling ? `
                      <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                        ❄️ Perdiendo inercia (${ageDays}d)
                      </span>
                    ` : ''}

                    ${t.codeSnippet ? `<span class="text-[9px] font-mono text-sky-400">💻 Código</span>` : ''}
                  </div>

                  <!-- Título y Notas -->
                  <h3 class="text-sm font-bold text-white hover:text-emerald-400 transition cursor-pointer" onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')">
                    ${this.escapeHtml(t.title)}
                  </h3>

                  ${t.notes ? `<p class="text-xs text-slate-400 mt-1 line-clamp-2 font-mono">${this.escapeHtml(t.notes)}</p>` : ''}
                </div>

                <!-- Botones de Acción de Tarea -->
                <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-1" title="Editar Tarea (CRUD)">
                    <span>✏️</span> <span class="hidden sm:inline">Editar</span>
                  </button>

                  <button onclick="app.openOneThingMode('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-purple-300 text-xs" title="Modo Solo 1 Cosa">
                    👁️
                  </button>

                  <button onclick="app.openDeepWork('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-sky-300 text-xs" title="Notas Deep Work">
                    💻
                  </button>

                  <button onclick="app.moveTaskPrev('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-white text-xs font-bold" title="Mover a columna anterior">
                    ←
                  </button>

                  <button onclick="app.moveTaskNext('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-white text-xs font-bold" title="Avanzar de columna">
                    →
                  </button>

                  ${t.column !== 'victorias' ? `
                    <button onclick="${t.isBureaucratic ? `app.completeBureaucraticTask('${t.projectId}', '${t.id}')` : `app.moveTaskToColumn('${t.projectId}', '${t.id}', 'victorias')`}" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition flex items-center gap-1 active:scale-95" title="Marcar como Victoria">
                      <span>✓</span> <span class="hidden sm:inline">Victoria</span>
                    </button>
                  ` : ''}

                  <button onclick="app.deleteTask('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-rose-400 text-xs" title="Eliminar tarea">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  setTareasFilter(filter) {
    this.tareasFilter = filter;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  }

  setTareasProjectFilter(projId) {
    this.tareasProjectFilter = projId;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  }

  setTareasSearch(query) {
    this.tareasSearchQuery = query;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  }

  // ==========================================
  // SPRINT FOCUS TIMER
  // ==========================================
  toggleTimerWidget() {
    const bar = document.getElementById('sprint-timer-bar');
    bar.classList.toggle('hidden');
  }

  setTimerDuration(minutes) {
    this.timer.durationMinutes = minutes;
    this.timer.secondsLeft = minutes * 60;
    this.updateTimerDisplay();
  }

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
        if (this.timer.secondsLeft <= 0) {
          clearInterval(this.timer.intervalId);
          this.timer.isRunning = false;
          this.accumulateFocusSegment();
          this.onTimerComplete();
        }
      }, 1000);
    }
  }

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
  }

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
  }

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
  }

  // --- MINUTOS DE FOCO ---
  accumulateFocusSegment() {
    if (this.timer.segmentStart) {
      this.timer.focusedMs = (this.timer.focusedMs || 0) + (Date.now() - this.timer.segmentStart);
      this.timer.segmentStart = null;
    }
  }

  getFocusProjectId() {
    return this.zenProjectId || this.selectedKanbanProjectId || null;
  }

  recordFocusSession(minutes) {
    if (!minutes || minutes < 1) return;
    if (!Array.isArray(this.state.focusSessions)) this.state.focusSessions = [];
    this.state.focusSessions.push({ projectId: this.getFocusProjectId(), minutes, at: new Date().toISOString() });
    // Basta con ~3 meses de historial para las métricas
    if (this.state.focusSessions.length > 500) this.state.focusSessions = this.state.focusSessions.slice(-500);
    this.saveState();
  }

  getFocusMinutes(days = 7) {
    const since = Date.now() - days * 86400000;
    return (this.state.focusSessions || [])
      .filter(s => new Date(s.at).getTime() >= since)
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
  }

  // --- PROYECTOS ESTANCADOS: proponer reactivar o pausar sin culpa ---
  getStalledProjects(minDays = 14) {
    return (this.state.projects || [])
      .filter(p => (p.status === 'activo' || p.status === 'en_ejecucion') && p.nextActionType !== 'esperar')
      .filter(p => this.daysSince(p.lastActivity) >= minDays)
      .filter(p => !(this.state.settings?.stalledDismissed || {})[p.id] || this.daysSince(this.state.settings.stalledDismissed[p.id]) >= 7)
      .sort((a, b) => this.daysSince(b.lastActivity) - this.daysSince(a.lastActivity));
  }

  dismissStalledProject(projectId) {
    if (!this.state.settings) this.state.settings = {};
    if (!this.state.settings.stalledDismissed) this.state.settings.stalledDismissed = {};
    this.state.settings.stalledDismissed[projectId] = new Date().toISOString();
    this.saveState();
    this.render();
  }

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
  }

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
  }

  // ==========================================
  // MODAL CONTROLS & SETTINGS
  // ==========================================
  openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains('hidden')) {
      this._modalReturnFocus = this._modalReturnFocus || {};
      this._modalReturnFocus[id] = document.activeElement;
    }
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    const heading = el.querySelector('h2, h3');
    if (heading) {
      // No usar el prefijo "modal-": closeAllModals oculta todo [id^="modal-"]
      if (!heading.id) heading.id = `dlg-title-${id}`;
      el.setAttribute('aria-labelledby', heading.id);
    }
    el.classList.remove('hidden');
    // Foco al primer control (respetando autofocus) para teclado y lectores de pantalla
    setTimeout(() => {
      if (el.contains(document.activeElement)) return;
      const target = el.querySelector('[autofocus]') ||
        el.querySelector('input:not([type="hidden"]):not([disabled]), textarea, select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (target && typeof target.focus === 'function') target.focus();
    }, 50);
  }

  restoreModalFocus(id) {
    const prev = this._modalReturnFocus && this._modalReturnFocus[id];
    if (prev && document.contains(prev) && typeof prev.focus === 'function') prev.focus();
    if (this._modalReturnFocus) delete this._modalReturnFocus[id];
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const wasOpen = !el.classList.contains('hidden');
    el.classList.add('hidden');
    if (wasOpen) this.restoreModalFocus(id);
  }

  closeAllModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(el => {
      if (!el.classList.contains('hidden')) this.closeModal(el.id);
    });
  }

  openSettings() {
    const soundEl = document.getElementById('setting-sound');
    if (soundEl) soundEl.checked = !!this.state.settings?.sound;
    const vibEl = document.getElementById('setting-vibration');
    if (vibEl) vibEl.checked = !!this.state.settings?.vibration;
    const autoEl = document.getElementById('setting-auto-classify');
    if (autoEl) autoEl.checked = this.isAutoClassifyEnabled();
    this.applyFormFactor();
    this.refreshPinSettings();
    this.updateNotificationUI();
    this.openModal('modal-settings');
  }

  updateSettings() {
    const soundEl = document.getElementById('setting-sound');
    const vibEl = document.getElementById('setting-vibration');
    if (this.state.settings) {
      if (soundEl) this.state.settings.sound = soundEl.checked;
      if (vibEl) this.state.settings.vibration = vibEl.checked;
      this.saveState();
    }
  }

  exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `proyectazo_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  importDataJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.projects) {
          this.state = imported;
          this.saveState();
          this.closeModal('modal-settings');
          this.render();
          alert("✓ Copia de seguridad importada con éxito.");
        } else {
          alert("El archivo JSON no tiene el formato esperado.");
        }
      } catch (err) {
        alert("Error al leer el archivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  printBitacoraReport() {
    window.print();
  }

  resetDemoData() {
    if (confirm("¿Restaurar los datos de demostración? Se reemplazarán tus proyectos actuales.")) {
      this.state = this.getSeedData();
      this.saveState();
      this.closeModal('modal-settings');
      this.render();
    }
  }

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
  }

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
  }

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
  }

  drawFreeformDot(x, y, pressure) {
    const ctx = this.freeform.ctx;
    if (!ctx) return;
    ctx.save();
    this.applyFreeformToolStyles(ctx, pressure);
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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
  }

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
  }

  hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

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
  }

  setFreeformColor(color) {
    this.freeform.color = color;
    document.querySelectorAll('.ff-color-btn').forEach(b => {
      b.classList.remove('scale-110', 'ring-2', 'ring-emerald-500', 'border-white');
    });
    const customEl = document.getElementById('freeform-custom-color');
    if (customEl) customEl.value = color;
    this.updateFreeformCompactDisplay();
  }

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
  }

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
  }

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
  }

  updateFreeformCompactDisplay() {
    const toolIcons = { pen: '✏️', brush: '🖌️', highlighter: '🖍️', eraser: '🧹' };
    const iconEl = document.getElementById('freeform-compact-tool-icon');
    const dotEl = document.getElementById('freeform-compact-color-dot');
    const badgeEl = document.getElementById('freeform-compact-size-badge');

    if (iconEl) iconEl.textContent = toolIcons[this.freeform.tool] || '✏️';
    if (dotEl) dotEl.style.background = this.freeform.color;
    if (badgeEl) badgeEl.textContent = `${this.freeform.size}px`;
  }

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
  }

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
  }

  undoFreeform() {
    if (this.freeform.historyStep > 0) {
      this.freeform.historyStep--;
      this.restoreCanvasFromDataUrl(this.freeform.history[this.freeform.historyStep]);
    }
  }

  redoFreeform() {
    if (this.freeform.historyStep < this.freeform.history.length - 1) {
      this.freeform.historyStep++;
      this.restoreCanvasFromDataUrl(this.freeform.history[this.freeform.historyStep]);
    }
  }

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
  }

  clearFreeform() {
    if (!confirm("¿Deseas limpiar todos los trazos del lienzo?")) return;
    const ctx = this.freeform.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.freeform.width, this.freeform.height);
    this.drawFreeformGrid(ctx, this.freeform.width, this.freeform.height);
    this.saveFreeformStateToHistory();
    this.autoSaveFreeformCanvas();
  }

  autoSaveFreeformCanvas() {
    if (!this.freeform.canvas) return;
    try {
      const dataUrl = this.freeform.canvas.toDataURL('image/png');
      localStorage.setItem('proyectazo_freeform_saved', dataUrl);
    } catch(e) {}
  }

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
  }

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
  }

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
  }

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
  }

  updateFreeformStickyNote(id, text) {
    const note = (this.state.freeformNotes || []).find(n => n.id === id);
    if (note) {
      note.text = text;
      this.saveState();
    }
  }

  deleteFreeformStickyNote(id) {
    if (!this.state.freeformNotes) return;
    this.state.freeformNotes = this.state.freeformNotes.filter(n => n.id !== id);
    this.saveState();
    this.renderFreeformNotes();
  }

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
  }

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
  }

  downloadFreeformPNG() {
    if (!this.freeform.canvas) return;
    const a = document.createElement('a');
    a.href = this.freeform.canvas.toDataURL('image/png');
    a.download = `proyectazo_freeform_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  loadDrawingIntoFreeform(pensaderoItemId) {
    const item = (this.state.pensadero || []).find(x => x.id === pensaderoItemId);
    if (!item || !item.drawingData) return;

    localStorage.setItem('proyectazo_freeform_saved', item.drawingData);
    this.navigate('freeform');
  }

  // ==========================================
  // GESTIÓN MÓVIL, TABLET & WHATSAPP
  // ==========================================
  openMobileAppModal() {
    const modal = document.getElementById('modal-mobile-app');
    if (!modal) return;

    const currentUrl = window.location.href;
    const urlInput = document.getElementById('mobile-app-url');
    if (urlInput) urlInput.value = currentUrl;

    const qrContainer = document.getElementById('mobile-app-qr');
    if (qrContainer) {
      qrContainer.innerHTML = `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}&bgcolor=ffffff&color=0f172a" 
             alt="Código QR de Proyectazo" 
             class="w-36 h-36 rounded-xl shadow-md border-2 border-slate-700/50 bg-white p-1 mx-auto"
             onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'p-3 text-[10px] font-mono theme-card border theme-border\'>${currentUrl}</div>';" />
      `;
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const lbl = document.getElementById('pwa-btn-label');
    if (lbl) {
      if (isStandalone) {
        lbl.textContent = '✓ App Instalada';
      } else {
        lbl.textContent = 'Instalar Aquí';
      }
    }

    modal.classList.remove('hidden');
  }

  shareWhatsApp(customPhone = '') {
    const currentUrl = window.location.href;
    const text = `⚡ ¡Prueba Proyectazo (FocusFlow OS) en tu celular o tablet! Diseñado para TDAH con El Pensadero, Ruido Marrón y Lienzo Libre Freeform: ${currentUrl}`;

    const phone = customPhone || (document.getElementById('whatsapp-phone-input') ? document.getElementById('whatsapp-phone-input').value.trim() : '');
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let url;
    if (cleanPhone) {
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  }

  shareWhatsAppToNumber() {
    const phone = document.getElementById('whatsapp-phone-input')?.value.trim();
    if (!phone) {
      alert("Por favor ingresa un número de teléfono con código de país (ejemplo: +52155...)");
      return;
    }
    this.shareWhatsApp(phone);
  }

  copyAppUrl() {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      const btn = document.getElementById('copy-url-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ ¡Copiado!';
        btn.classList.add('bg-emerald-500', 'text-slate-950');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('bg-emerald-500', 'text-slate-950');
        }, 2000);
      }
    }).catch(() => {
      prompt("Copia este enlace para abrirlo en tu celular o tablet:", currentUrl);
    });
  }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new ProyectazoApp();
});
