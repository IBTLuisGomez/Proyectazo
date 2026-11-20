'use strict';
// Plantillas HTML que escapan por defecto. Olvidar escapeHtml deja de ser posible:
//
//   el.innerHTML = html`<p class="x">${texto}</p>`;            // texto escapado (también dentro de atributos)
//   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`;     // listas de fragmentos: se insertan tal cual
//   html`<div>${raw(svgDeConfianza)}</div>`;                   // opt-out explícito y fácil de buscar
//   html`<button data-on-click='${accion('navigate', v)}'>`    // acción JSON segura para data-on-*
//
// null, undefined y false no pintan nada. Un fragmento html`` es SafeHtml y no se vuelve a escapar.

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

function escapeHtmlText(value) {
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPES[ch]);
}

function htmlValue(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(htmlValue).join('');
  return escapeHtmlText(value);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += htmlValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

function raw(value) {
  return new SafeHtml(String(value ?? ''));
}

// Atributo data-on-*: JSON de una llamada, escapado para ir entre comillas simples o dobles
function accion(method, ...args) {
  return new SafeHtml(escapeHtmlText(JSON.stringify([method, ...args])));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { html, raw, accion, SafeHtml, escapeHtmlText };
}
