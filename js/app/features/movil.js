'use strict';
// Instalación en móvil/tablet y envío del enlace por WhatsApp.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

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
             alt="Código QR de NexusHiveBrain" 
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
  },

  shareWhatsApp(customPhone = '') {
    const currentUrl = window.location.href;
    const text = `⚡ ¡Prueba NexusHiveBrain (FocusFlow OS) en tu celular o tablet! Diseñado para TDAH con El Pensadero, Ruido Marrón y Lienzo Libre Freeform: ${currentUrl}`;

    const phone = customPhone || (document.getElementById('whatsapp-phone-input') ? document.getElementById('whatsapp-phone-input').value.trim() : '');
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let url;
    if (cleanPhone) {
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  },

  shareWhatsAppToNumber() {
    const phone = document.getElementById('whatsapp-phone-input')?.value.trim();
    if (!phone) {
      alert("Por favor ingresa un número de teléfono con código de país (ejemplo: +52155...)");
      return;
    }
    this.shareWhatsApp(phone);
  },

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
  },
});
