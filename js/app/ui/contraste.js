'use strict';
// Guardia de contraste del tema claro: la interfaz reutiliza colores pensados para fondo oscuro.
// Tras cada render mide el texto contra su fondo real y marca con .on-light lo que no llega a
// WCAG AA; assets/contraste.css lo oscurece conservando el tono. En temas oscuros no hace nada.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({
  initContrastGuard() {
    if (this._contrastObserver || typeof MutationObserver === 'undefined') return;
    const schedule = () => {
      if (this._contrastPending) return;
      this._contrastPending = true;
      const run = () => { this._contrastPending = false; this.applyContrastGuard(); };
      // setTimeout y no requestIdleCallback: en un móvil ocupado el idle puede tardar mucho
      setTimeout(run, 80);
    };
    this._contrastObserver = new MutationObserver(schedule);
    this._contrastObserver.observe(document.body, { childList: true, subtree: true });
    // Cambiar de tema solo toca la clase de <html>
    this._contrastObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    schedule();
  },

  applyContrastGuard() {
    const light = document.documentElement.classList.contains('theme-light');
    if (!light) {
      document.querySelectorAll('.on-light, .on-dark').forEach(el => el.classList.remove('on-light', 'on-dark'));
      return;
    }
    const parse = c => {
      const m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const pageBase = () => {
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(hex);
      return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    };
    const bgCache = new Map();
    const backgroundOf = el => {
      if (!el || el.nodeType !== 1) return { r: 255, g: 255, b: 255, a: 1 };
      if (bgCache.has(el)) return bgCache.get(el);
      const cs = getComputedStyle(el);
      let bg;
      if (el === document.body || el === document.documentElement) {
        // El color del tema (--bg-page), no el calculado: body tiene una transición de 0.25 s y,
        // justo después de cambiar de tema, todavía devuelve el color del tema anterior
        bg = pageBase();
      } else if (cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) {
        bg = null;
      } else {
        const own = parse(cs.backgroundColor);
        const under = el.parentElement ? backgroundOf(el.parentElement) : { r: 255, g: 255, b: 255, a: 1 };
        if (!own || own.a === 0) bg = under;
        else if (own.a >= 1) bg = own;
        // Translúcido sobre un degradado: el fondo real no se puede medir, así que no se toca
        else if (!under) bg = null;
        else bg = { r: own.r * own.a + under.r * (1 - own.a), g: own.g * own.a + under.g * (1 - own.a), b: own.b * own.a + under.b * (1 - own.a), a: 1 };
      }
      bgCache.set(el, bg);
      return bg;
    };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.classList.contains('on-light') || el.classList.contains('on-dark')) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && /[\p{L}\d]/u.test(n.textContent));
      if (!hasText || !el.offsetParent) continue;
      const fg = parse(getComputedStyle(el).color);
      const bg = backgroundOf(el);
      if (!fg || !bg) continue;
      const lf = lum(fg), lb = lum(bg);
      if ((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05) >= 4.5) continue;
      // Por encima de 0.18 de luminancia el texto oscuro contrasta más que el claro, y al revés
      el.classList.add(lb > 0.18 ? 'on-light' : 'on-dark');
    }
  }
});
