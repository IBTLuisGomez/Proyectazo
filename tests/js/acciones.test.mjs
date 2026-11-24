// Ejecutar: node --test tests/js
// Despachador de data-on-*: argumentos especiales, varias llamadas y burbujeo como los onclick inline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../js/app/ui/acciones.js', import.meta.url), 'utf8');

function cargar(app, document) {
  const mod = { exports: {} };
  globalThis.Element = class {};
  new Function('module', 'app', 'document', src)(mod, app, document);
  return mod.exports;
}

// Elemento mínimo con atributos y padre
function el(attrs = {}, parent = null, extra = {}) {
  const e = Object.assign(new globalThis.Element(), extra);
  e.attrs = attrs;
  e.parentElement = parent;
  e.getAttribute = k => e.attrs[k];
  e.hasAttribute = k => k in e.attrs;
  e.closest = sel => {
    const key = sel.slice(1, -1);
    for (let n = e; n; n = n.parentElement) if (n.hasAttribute(key)) return n;
    return null;
  };
  return e;
}

test('una llamada, varias llamadas y argumentos especiales', () => {
  const calls = [];
  const app = { a: (...x) => calls.push(['a', ...x]), b: (...x) => calls.push(['b', ...x]) };
  globalThis.Element = class {};
  const { accionEjecutar } = cargar(app, { querySelector: () => ({ textContent: 'título' }) });
  const input = el({}, null, { checked: true, value: 'v' });
  const ev = { type: 'change' };
  accionEjecutar('["a","x",3,"$checked","$value","$event","$$literal"]', input, ev);
  accionEjecutar('[["a","$text:#zen"],["b"]]', input, ev);
  assert.deepEqual(calls[0], ['a', 'x', 3, true, 'v', ev, '$literal']);
  assert.deepEqual(calls.slice(1), [['a', 'título'], ['b']]);
});

test('método desconocido o JSON roto no rompen el resto', () => {
  const calls = [];
  const app = { ok: () => calls.push('ok') };
  const errores = [];
  const orig = console.error;
  console.error = m => errores.push(m);
  try {
    const { accionEjecutar } = cargar(app, {});
    accionEjecutar('[["noExiste"],["ok"]]', el(), {});
    accionEjecutar('{roto', el(), {});
  } finally {
    console.error = orig;
  }
  assert.deepEqual(calls, ['ok']);
  assert.equal(errores.length, 2);
});

test('burbujea del interior hacia fuera y respeta stopPropagation', () => {
  const calls = [];
  const app = { fuera: () => calls.push('fuera'), dentro: ev => { calls.push('dentro'); if (ev.parar) ev.cancelBubble = true; } };
  const { accionManejar } = cargar(app, {});
  const outer = el({ 'data-on-click': '["fuera"]' });
  const inner = el({ 'data-on-click': '["dentro","$event"]' }, outer);
  const span = el({}, inner);
  accionManejar({ type: 'click', target: span, cancelBubble: false });
  assert.deepEqual(calls, ['dentro', 'fuera']);
  calls.length = 0;
  accionManejar({ type: 'click', target: span, cancelBubble: false, parar: true });
  assert.deepEqual(calls, ['dentro']);
});

test('data-on-enter solo con la tecla Enter', () => {
  const calls = [];
  const { accionManejar } = cargar({ enviar: () => calls.push(1) }, {});
  const input = el({ 'data-on-enter': '["enviar"]' });
  accionManejar({ type: 'keydown', key: 'a', target: input });
  accionManejar({ type: 'keydown', key: 'Enter', target: input });
  assert.equal(calls.length, 1);
});
