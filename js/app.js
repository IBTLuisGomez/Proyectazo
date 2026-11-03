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
    this.hydrateFromIndexedDB();
    // Al cerrar o esconder la pestaña, no esperar al temporizador de escritura
    window.addEventListener('pagehide', () => this.flushIndexedDBWrite());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flushIndexedDBWrite(); });
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
        // Sin copia rápida: los datos pueden estar solo en IndexedDB (no cabían en localStorage).
        // Hasta leerla no se guarda nada, para no pisarla con un estado vacío.
        if (typeof NexusIDB !== 'undefined' && NexusIDB.available()) this._persistBlocked = true;
      }
    } catch (e) {
      console.error("Error al cargar estado, cargando seed:", e);
      this.state = this.getSeedData();
    }
    this.normalizeState(DEMO_PROJECT_IDS);
    this.saveState();
  }

  normalizeState(DEMO_PROJECT_IDS = new Set(['p-focusflow', 'p-cytohelix', 'p-cytocore', 'proj_focusflow', 'proj_cytohelix', 'proj_cytocore'])) {
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
    this.migrateLegacyCategories();
    if (!this.state.inbox) {
      this.state.inbox = [];
    }
    if (!this.state.freeformNotes) {
      this.state.freeformNotes = [];
    }
    if (!Array.isArray(this.state.pendingDeletes)) {
      this.state.pendingDeletes = [];
    }
  }

  // --- ALMACENAMIENTO DURADERO (IndexedDB) ---
  // localStorage es la copia rápida para arrancar al instante; IndexedDB guarda siempre y no tiene el
  // límite de ~5 MB (los dibujos del lienzo lo llenan). Si localStorage se llena, se usa solo IndexedDB.
  async hydrateFromIndexedDB() {
    if (typeof NexusIDB === 'undefined' || !NexusIDB.available()) {
      this._persistBlocked = false;
      return;
    }
    let stored = null;
    try {
      const raw = await NexusIDB.get(this.STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('No se pudo leer IndexedDB:', e);
    }
    const blocked = this._persistBlocked;
    this._persistBlocked = false;
    if (stored && (blocked || this.isoTime(stored.savedAt) > this.isoTime(this.state.savedAt))) {
      // Lo capturado mientras se leía IndexedDB no se pierde
      const capturedMeanwhile = blocked ? (this.state.pensadero || []) : [];
      this.state = stored;
      this.normalizeState();
      for (const item of capturedMeanwhile) {
        if (!this.state.pensadero.some(p => p.id === item.id)) this.state.pensadero.unshift(item);
      }
      this.captureEntitySignatures();
      this.saveState();
      this.render();
    } else {
      this.flushIndexedDBWrite(JSON.stringify(this.state));
    }
  }

  writeLocalCache(json) {
    try {
      localStorage.setItem(this.STORAGE_KEY, json);
    } catch (e) {
      // Lleno: se deja de usar la copia rápida; al arrancar se leerá IndexedDB
      try { localStorage.removeItem(this.STORAGE_KEY); } catch (err) {}
      const durable = typeof NexusIDB !== 'undefined' && NexusIDB.available();
      if (!this._quotaWarned) {
        this._quotaWarned = true;
        this.showToast(durable
          ? '💾 Tus datos ya no caben en el almacenamiento rápido; se guardan en IndexedDB.'
          : '⚠️ No queda espacio para guardar en este navegador. Exporta un respaldo en Ajustes.');
      }
    }
  }

  scheduleIndexedDBWrite(json) {
    if (typeof NexusIDB === 'undefined' || !NexusIDB.available()) return;
    this._idbPendingJson = json;
    if (this._idbTimer) return;
    this._idbTimer = setTimeout(() => {
      this._idbTimer = null;
      this.flushIndexedDBWrite();
    }, 300);
  }

  flushIndexedDBWrite(json = this._idbPendingJson) {
    if (!json || typeof NexusIDB === 'undefined' || !NexusIDB.available()) return Promise.resolve();
    this._idbPendingJson = null;
    if (this._idbTimer) {
      clearTimeout(this._idbTimer);
      this._idbTimer = null;
    }
    return NexusIDB.set(this.STORAGE_KEY, json).catch(e => console.warn('No se pudo guardar en IndexedDB:', e));
  }

  // --- COLA DE BORRADOS ---
  // Un borrado que no llega al servidor (sin red) se guarda y se repite al sincronizar; si no,
  // el siguiente sync volvería a traer lo borrado.
  deleteOnServer(kind, id) {
    const paths = { pensadero: `/pensadero/${id}`, task: `/tasks/${id}`, project: `/projects/${id}` };
    if (!id || !paths[kind]) return;
    const enqueue = () => {
      if (!Array.isArray(this.state.pendingDeletes)) this.state.pendingDeletes = [];
      if (!this.isPendingDelete(kind, id)) this.state.pendingDeletes.push({ kind, id, at: new Date().toISOString() });
      this.saveState();
    };
    if (!this.backendAvailable) return enqueue();
    fetch(`${this.API_BASE}${paths[kind]}`, { method: 'DELETE' })
      .then(r => { if (!r.ok && r.status !== 404) enqueue(); })
      .catch(enqueue);
  }

  isPendingDelete(kind, id) {
    return (this.state.pendingDeletes || []).some(d => d.kind === kind && d.id === id);
  }

  cancelPendingDelete(id) {
    const before = (this.state.pendingDeletes || []).length;
    this.state.pendingDeletes = (this.state.pendingDeletes || []).filter(d => d.id !== id);
    if (this.state.pendingDeletes.length !== before) this.saveState();
  }

  async flushDeletionQueue() {
    const paths = { pensadero: 'pensadero', task: 'tasks', project: 'projects' };
    for (const d of [...(this.state.pendingDeletes || [])]) {
      try {
        const r = await fetch(`${this.API_BASE}/${paths[d.kind]}/${d.id}`, { method: 'DELETE' });
        if (r.ok || r.status === 404) this.state.pendingDeletes = this.state.pendingDeletes.filter(x => x !== d);
      } catch (e) {
        break; // sin red: se reintenta en el próximo sync
      }
    }
    this.saveState();
  }

  // Sync incremental: solo lo creado o cambiado desde el último sync; completo cada 24 h
  changedSince(list, since) {
    if (!since) return list || [];
    return (list || []).filter(x => x && (!x.updatedAt || this.isoTime(x.updatedAt) > since || this.isoTime(x.createdAt) > since));
  }

  // Solo quita copias del mismo texto y color creadas con menos de 10 min de diferencia (dobles envíos
  // o sync). Antes borraba para siempre cualquier pensamiento repetido aunque fuera de otro día.
  cleanDuplicateThoughts() {
    if (!this.state.pensadero || !Array.isArray(this.state.pensadero)) return;
    const kept = new Map();
    this.state.pensadero = this.state.pensadero.filter(item => {
      if (!item || !item.content) return false;
      const key = `${(item.content || '').trim().toLowerCase()}__${item.category || ''}`;
      const t = new Date(item.createdAt || 0).getTime();
      const previous = kept.get(key);
      if (previous && previous.id !== item.id && Math.abs(previous.t - t) < 10 * 60 * 1000) return false;
      if (!previous) kept.set(key, { id: item.id, t });
      return true;
    });
  }

  // --- SEGURIDAD: SANITIZACIÓN DEFENSIVA CONTRA XSS ---
  // Texto dentro de un argumento '...' de un manejador inline: escapar para JS y para el atributo HTML
  jsStr(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  // encodeURIComponent no escapa el apóstrofo, que cerraría la cadena '...' de un manejador inline
  uriArg(value) {
    return encodeURIComponent(String(value ?? '')).replace(/'/g, '%27');
  }

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
      this.captureEntitySignatures();
      if (!this._persistBlocked) {
        this.state.savedAt = new Date().toISOString();
        const json = JSON.stringify(this.state);
        this.writeLocalCache(json);
        this.scheduleIndexedDBWrite(json);
      }
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
        document.querySelectorAll('details.thought-more[open]').forEach(d => d.removeAttribute('open'));
      }
    });

    // Menú "⋯" de las tarjetas: se cierra al elegir una opción o al tocar fuera, y solo uno abierto a la vez
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.thought-more[open]').forEach(d => {
        const inside = d.contains(e.target);
        const choseOption = inside && e.target.closest('button') && !e.target.closest('summary');
        if (!inside || choseOption) d.removeAttribute('open');
      });
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

    // Contraste del tema claro (no hace nada en los oscuros)
    setTimeout(() => this.initContrastGuard(), 400);

    // Texto compartido desde otra app o acceso directo de captura
    setTimeout(() => this.handleLaunchIntent(), 300);

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
      if (demoIds.has(remote.id) || this.isPendingDelete('project', remote.id)) continue;
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
        if (!remoteTask || !remoteTask.id || this.isPendingDelete('task', remoteTask.id)) continue;
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
      if (this.isPendingDelete('pensadero', remote.id)) continue;
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
      const syncStart = Date.now();
      await this.flushDeletionQueue();
      const pull = await fetch(`${this.API_BASE}/sync`, { headers: { 'Accept': 'application/json' } });
      let remoteEmpty = false;
      if (pull.ok) {
        const remote = await pull.json();
        remoteEmpty = !(remote.projects || []).length && !(remote.pensadero || []).length;
        this.mergeRemoteIntoLocal(remote);
      }

      // Completo si nunca se hizo, cada 24 h o si el servidor viene vacío (BD nueva o restaurada)
      const localHasData = (this.state.projects || []).length || (this.state.pensadero || []).length;
      const full = !this.state.lastFullSyncAt || syncStart - this.state.lastFullSyncAt > 864e5 || (remoteEmpty && localHasData);
      const since = full ? 0 : (this.state.lastSyncAt || 0);
      const payload = {
        deviceId: this.deviceId || localStorage.getItem('nexus_device_id'),
        deviceLabel: document.documentElement.dataset.form || 'unknown',
        projects: this.changedSince(this.state.projects, since),
        inbox: this.changedSince(this.state.inbox, since),
        pensadero: this.changedSince(this.state.pensadero, since)
      };
      const res = await fetch(`${this.API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('sync ' + res.status);
      const data = await res.json();
      this.mergeRemoteIntoLocal(data);
      this.state.lastSyncAt = syncStart;
      if (full) this.state.lastFullSyncAt = syncStart;
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
        <span class="px-2.5 py-0.5 rounded-full bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider shadow">🚨 FUEGO ACTIVO (${redItems.length})</span>
        <span class="font-bold text-white text-xs sm:text-sm line-clamp-1">${this.escapeHtml(topRed.content)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="app.syncRedSmokeToGoogle('${topRed.id}', '${this.uriArg(topRed.content)}')" class="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition flex items-center gap-1" title="Sincronizar con Google Calendar">
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
}

// Los módulos de js/app/ añaden sus métodos a la clase con esta función.
// Igual que un método de clase (no enumerable); falla si un nombre se repite,
// porque en una clase el segundo método taparía al primero sin avisar.
function defineAppMethods(methods) {
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    if (Object.prototype.hasOwnProperty.call(ProyectazoApp.prototype, name)) {
      throw new Error(`Método duplicado en ProyectazoApp: ${name}`);
    }
    Object.defineProperty(ProyectazoApp.prototype, name, { ...descriptor, enumerable: false });
  }
}


let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new ProyectazoApp();
});
