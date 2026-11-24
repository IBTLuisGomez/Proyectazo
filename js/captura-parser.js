// Pre-procesado y clasificación local de lo que se suelta en la app. Funciones puras, sin DOM ni red:
// las usa js/app/features/captura.js y se prueban con node (tests/js/captura-parser.test.mjs).
const CapturaParser = (() => {
  const reglasPorDefecto = () => (typeof CLASIFICADOR_REGLAS !== 'undefined' ? CLASIFICADOR_REGLAS : require('./clasificador-reglas.js'));

  // Minúsculas, sin acentos y solo letras/números separados por un espacio
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9$]+/g, ' ')
      .trim();
  }

  function matchesKeyword(padded, keyword) {
    const kw = normalize(keyword.replace(/\*$/, ''));
    if (!kw) return false;
    return keyword.endsWith('*') ? padded.includes(' ' + kw) : padded.includes(' ' + kw + ' ');
  }

  const STOPWORDS = new Set('para pero porque como cuando donde esta este esto estos esas eso tengo tiene hacer algo todo todos muy mas menos sobre entre desde hasta luego antes despues ahora hoy manana'.split(' '));

  function tokens(text) {
    return normalize(text).split(' ').filter(t => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  }

  /**
   * Clasifica por reglas + memoria personal (correcciones previas del usuario).
   * Devuelve { category, matched, score, confidence, reasons, cognitiveWeight, thoughtType }.
   */
  function classifyLocal(text, { rules = reglasPorDefecto(), memory = null } = {}) {
    const padded = ' ' + normalize(text) + ' ';
    const scores = rules.categories.map((cat, order) => {
      const reasons = cat.keywords.filter(k => matchesKeyword(padded, k)).map(k => k.replace(/\*$/, ''));
      let score = reasons.length;
      if (memory) {
        for (const tok of new Set(tokens(text))) {
          const learned = memory[tok] && memory[tok][cat.category];
          if (learned) {
            score += Math.min(learned, 3);
            reasons.push(tok);
          }
        }
      }
      return { cat, order, score, reasons };
    });
    scores.sort((a, b) => b.score - a.score || a.order - b.order);
    const best = scores[0];
    if (!best || best.score <= 0) {
      return { category: 'humo_general', matched: false, score: 0, confidence: 0, reasons: [], cognitiveWeight: 'libre', thoughtType: null };
    }
    const runnerUp = scores[1] ? scores[1].score : 0;
    // Confianza: más pistas y más distancia con la segunda opción → más seguro
    const confidence = Math.min(1, 0.45 + 0.2 * best.score - 0.15 * runnerUp);
    return {
      category: best.cat.category,
      matched: true,
      score: best.score,
      confidence: Math.max(0.3, Number(confidence.toFixed(2))),
      reasons: [...new Set(best.reasons)].slice(0, 3),
      cognitiveWeight: best.cat.cognitiveWeight,
      thoughtType: best.cat.thoughtType
    };
  }

  /** Aprende de una corrección manual: las palabras del texto apuntan a la categoría elegida. */
  function learn(memory, text, category) {
    const mem = memory || {};
    if (!category || category === 'humo_general') return mem;
    for (const tok of new Set(tokens(text))) {
      mem[tok] = mem[tok] || {};
      mem[tok][category] = (mem[tok][category] || 0) + 1;
    }
    // Acotar el tamaño: quedarse con las ~400 palabras más usadas
    const keys = Object.keys(mem);
    if (keys.length > 400) {
      keys.sort((a, b) => sumValues(mem[a]) - sumValues(mem[b]));
      for (const k of keys.slice(0, keys.length - 400)) delete mem[k];
    }
    return mem;
  }

  function sumValues(o) {
    return Object.values(o || {}).reduce((s, v) => s + v, 0);
  }

  /** Quita muletillas del dictado, espacios dobles y pone mayúscula inicial. */
  function cleanDictation(text) {
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    // Muletillas encadenadas al inicio ("eh este ...")
    let prev;
    do {
      prev = t;
      t = t.replace(/^(eh+|em+|este|bueno|o sea|pues|mmm+)[,.]?\s+/i, '');
    } while (t !== prev);
    t = t.replace(/\s+(eh+|em+|o sea|este)\s+(?=\S)/gi, ' ');
    t = t.replace(/\s+([,.;:!?])/g, '$1').trim();
    if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
    return t;
  }

  /**
   * Separa varias ideas: una por línea o viñeta, o unidas por "; ", "y además", "también tengo que".
   * Nunca parte por " y " a secas (cambiaría el sentido de muchas frases).
   */
  function splitIdeas(text) {
    const raw = String(text || '').replace(/\r\n?/g, '\n');
    let parts = raw.split(/\n+/);
    if (parts.length === 1) parts = raw.split(/\s*;\s+|\s*,?\s+y\s+adem[aá]s\s*,?\s+|\s*,?\s+tambi[eé]n\s+tengo\s+que\s+/i);
    return parts
      .map(p => p.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
      .filter(p => p.length >= 2);
  }

  /** @type {Array<[RegExp, string]>} */

  const COMMANDS = [
    [/^(urgente|fuego)\s*[:,\-–]\s*/i, 'humo_rojo'],
    [/^(idea)\s*[:,\-–]\s*/i, 'humo_dorado'],
    [/^(tarea|pendiente)\s*[:,\-–]\s*/i, 'humo_tarea'],
    [/^(soltar|desahogo)\s*[:,\-–]\s*/i, 'humo_blanco'],
    [/^(h[aá]bito|salud)\s*[:,\-–]\s*/i, 'humo_verde'],
    [/^(compra|dinero|gasto)\s*[:,\-–]\s*/i, 'humo_naranja'],
    [/^(persona|contacto)\s*[:,\-–]\s*/i, 'humo_purpura'],
    [/^(foco|deep work)\s*[:,\-–]\s*/i, 'humo_azul'],
    [/^(alg[uú]n d[ií]a|someday)\s*[:,\-–]\s*/i, 'humo_ceniza']
  ];

  function parseTime(h, m, ampm) {
    let hour = parseInt(h, 10);
    const min = m ? parseInt(m, 10) : 0;
    if (ampm) {
      const pm = /p/i.test(ampm);
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    if (hour > 23 || min > 59) return null;
    return [hour, min];
  }

  /** Detecta fecha/hora en lenguaje natural. Devuelve epoch ms o null. */
  function parseDue(text, now = new Date()) {
    const t = normalize(text);
    let m = t.match(/\ben (\d{1,3}) (min|minuto|minutos|hora|horas|h)\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      return now.getTime() + n * (m[2].startsWith('h') ? 3600000 : 60000);
    }
    m = t.match(/\b(hoy|manana|pasado manana)?\s*a las (\d{1,2})(?: (\d{2}))?\s*(am|pm)?\b/);
    const dayOnly = t.match(/\b(manana|pasado manana)\b/);
    if (m || dayOnly) {
      const d = new Date(now);
      const day = (m && m[1]) || (dayOnly && dayOnly[1]) || 'hoy';
      if (day === 'manana') d.setDate(d.getDate() + 1);
      if (day === 'pasado manana') d.setDate(d.getDate() + 2);
      let hm = [9, 0];
      if (m) {
        const parsed = parseTime(m[2], m[3], m[4]);
        if (!parsed) return null;
        hm = parsed;
      }
      d.setHours(hm[0], hm[1], 0, 0);
      if (d.getTime() <= now.getTime() && day === 'hoy') d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    return null;
  }

  /**
   * Interpreta una idea: comando inicial, proyecto explícito ("para X:"), importe, persona y fecha.
   * Devuelve { text, category, projectName, amount, contactName, dueAt }.
   */
  function parseIdea(text, now = new Date()) {
    let t = cleanDictation(text);
    let category = null;
    for (const [re, cat] of COMMANDS) {
      if (re.test(t)) {
        category = cat;
        t = t.replace(re, '');
        break;
      }
    }
    let projectName = null;
    const pm = t.match(/^(?:para|en|proyecto)\s+([^:]{2,40}?)\s*:\s*/i);
    if (pm) {
      projectName = pm[1].trim();
      t = t.slice(pm[0].length);
    }
    let amount = null;
    const am = t.match(/\$\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(pesos|mxn|usd|dolares|dólares|euros|€)/i);
    if (am) amount = parseFloat((am[1] || am[2]).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    let contactName = null;
    const cm = t.match(/@([\p{L}][\p{L}\d_.-]{1,30})/u) || t.match(/\b(?:[Ll]lamar|[Ee]scribirle|[Ee]scribir|[Hh]ablar con|[Mm]ensaje a|[Cc]umplea[nñ]os de)\s+(?:a\s+)?([A-ZÁÉÍÓÚÑ][\p{L}]+)/u);
    if (cm) contactName = cm[1];
    const dueAt = parseDue(t, now);
    t = t.trim();
    if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
    return { text: t, category, projectName, amount: Number.isFinite(amount) ? amount : null, contactName, dueAt };
  }

  return { normalize, classifyLocal, learn, cleanDictation, splitIdeas, parseIdea, parseDue, tokens };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CapturaParser;
