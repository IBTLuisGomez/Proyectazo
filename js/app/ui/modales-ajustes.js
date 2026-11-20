'use strict';
// Apertura y cierre accesible de modales y pantalla de Ajustes.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

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
  },

  restoreModalFocus(id) {
    const prev = this._modalReturnFocus && this._modalReturnFocus[id];
    if (prev && document.contains(prev) && typeof prev.focus === 'function') prev.focus();
    if (this._modalReturnFocus) delete this._modalReturnFocus[id];
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const wasOpen = !el.classList.contains('hidden');
    el.classList.add('hidden');
    if (wasOpen) this.restoreModalFocus(id);
  },

  closeAllModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(el => {
      if (!el.classList.contains('hidden')) this.closeModal(el.id);
    });
    if (this.closeJarvis) this.closeJarvis();
  },

  openSettings() {
    const soundEl = document.getElementById('setting-sound');
    if (soundEl) soundEl.checked = !!this.state.settings?.sound;
    const vibEl = document.getElementById('setting-vibration');
    if (vibEl) vibEl.checked = !!this.state.settings?.vibration;
    const autoEl = document.getElementById('setting-auto-classify');
    if (autoEl) autoEl.checked = this.isAutoClassifyEnabled();
    const cloudEl = document.getElementById('setting-cloud-ai');
    if (cloudEl) cloudEl.checked = this.isCloudAIEnabled();
    this.applyFormFactor();
    this.refreshPinSettings();
    this.updateNotificationUI();
    this.openModal('modal-settings');
  },

  updateSettings() {
    const soundEl = document.getElementById('setting-sound');
    const vibEl = document.getElementById('setting-vibration');
    if (this.state.settings) {
      if (soundEl) this.state.settings.sound = soundEl.checked;
      if (vibEl) this.state.settings.vibration = vibEl.checked;
      this.saveState();
    }
  },

  exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `proyectazo_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

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
  },

  printBitacoraReport() {
    window.print();
  },

  resetDemoData() {
    if (confirm("¿Restaurar los datos de demostración? Se reemplazarán tus proyectos actuales.")) {
      this.state = this.getSeedData();
      this.saveState();
      this.closeModal('modal-settings');
      this.render();
    }
  },
});
