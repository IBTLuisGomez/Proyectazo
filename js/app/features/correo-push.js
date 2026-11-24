'use strict';
// Recordatorios: Gmail (microservicio Nexus) y Web Push con la app cerrada.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // INTEGRACIÓN GOOGLE MAIL (GMAIL SMTP & RECORDATORIOS)
  // ==========================================
  async fetchNexus(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = `${this.NEXUS_API_BASE}${cleanEndpoint}`;
    const host = window.location.hostname || 'localhost';
    const isSecure = window.location.protocol === 'https:';
    // En HTTPS no intentar fallback HTTP inseguro ya que el navegador bloquea Mixed Content
    const fallbackUrl = isSecure ? primaryUrl : `http://${host}:8081/api/nexus${cleanEndpoint}`;

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
  },

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
  },

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
  },

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
  },

  openDirectGmailWeb(taskTitle = '', body = '') {
    const recipInp = document.getElementById('setting-gmail-recipient') || document.getElementById('setting-gmail-user');
    const to = recipInp?.value || this.googleMailStatus?.default_recipient || '';
    const su = taskTitle ? `[Nexus Tarea] ${taskTitle}` : 'Recordatorio Hive Brain';
    const b = body || 'Micro-paso programado para romper la inercia cognitiva.\n\nAcceso a Hive Brain: http://localhost:8000';
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(b)}`;
    window.open(url, '_blank');
  },

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
  },

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
  },

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
  },

  // --- WEB PUSH: AVISOS CON LA APP CERRADA ---
  urlBase64ToUint8Array(base64) {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  },

  setPushStatus(text) {
    const el = document.getElementById('push-status');
    if (el) el.textContent = text;
  },

  async enableBackgroundPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.setPushStatus('Este navegador no admite avisos con la app cerrada.');
      return;
    }
    if (!window.isSecureContext) {
      this.setPushStatus('Necesita HTTPS (o localhost) para funcionar.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.setPushStatus('Permiso de notificaciones denegado. Actívalo en el navegador.');
        return;
      }
      const keyRes = await fetch(`${this.API_BASE}/push/public-key`, { headers: { 'Accept': 'application/json' } });
      if (!keyRes.ok) {
        this.setPushStatus('El servidor no tiene Web Push disponible.');
        return;
      }
      const { publicKey } = await keyRes.json();
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey)
        });
      }
      const res = await fetch(`${this.API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON())
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.setPushStatus(`No se pudo registrar: ${data.error || res.status}`);
        return;
      }
      localStorage.setItem('nexus_push_enabled', 'true');
      this.setPushStatus(`✓ Activado. Dispositivos con avisos: ${data.devices}.`);
      this.showToast('📲 Avisos con la app cerrada activados en este dispositivo.');
    } catch (err) {
      this.setPushStatus(`No se pudo activar: ${err.message}`);
    }
  },

  async testBackgroundPush() {
    try {
      const res = await fetch(`${this.API_BASE}/push/test`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.setPushStatus('El servidor no pudo enviar la prueba.');
      } else if (!data.delivered) {
        this.setPushStatus('Ningún dispositivo recibió la prueba. Pulsa "Activar" primero.');
      } else {
        this.setPushStatus(`Prueba enviada a ${data.delivered} dispositivo(s).`);
      }
    } catch (err) {
      this.setPushStatus('Sin conexión con el servidor.');
    }
  },

  async scheduleBackgroundPush(taskId, title, scheduledTime) {
    const res = await fetch(`${this.API_BASE}/push/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, taskId, sendAt: new Date(scheduledTime).getTime() })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  },

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
    const wantsPush = !!document.getElementById('schedule-push-toggle')?.checked;

    if (!scheduledTime) {
      if (fb) {
        fb.textContent = '❌ Por favor selecciona la fecha y hora para el aviso.';
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    if (!wantsPush && !recipient) {
      if (fb) {
        fb.textContent = '❌ Elige al menos un canal: notificación o correo.';
        fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
      }
      return;
    }

    // Notificación push (independiente del correo: no necesita Gmail configurado)
    if (wantsPush) {
      try {
        await this.scheduleBackgroundPush(taskId, title, scheduledTime);
      } catch (err) {
        if (fb) {
          fb.textContent = `❌ No se pudo programar la notificación: ${err.message}`;
          fb.className = 'p-2 rounded-xl text-[11px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 block';
        }
        return;
      }
      if (!recipient) {
        this.closeModal('modal-schedule-email');
        const hint = localStorage.getItem('nexus_push_enabled') ? '' : ' Actívalos en Ajustes → Notificaciones para recibirlo con la app cerrada.';
        this.showToast(`📲 Aviso programado para ${new Date(scheduledTime).toLocaleString('es-ES')}.${hint}`);
        return;
      }
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
  },
});
