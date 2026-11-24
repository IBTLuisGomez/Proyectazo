// Ejecutar: node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { html, raw, accion } = require('../../js/app/ui/html.js');

test('escapa por defecto, también en atributos', () => {
  const malo = `"><img src=x onerror=alert(1)>'`;
  const out = String(html`<p title="${malo}">${malo}</p>`);
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes(`"><`));
  assert.match(out, /&quot;&gt;&lt;img/);
});

test('fragmentos anidados y listas no se escapan dos veces; raw es explícito', () => {
  const items = ['a<b', 'c'];
  const out = String(html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>${raw('<hr>')}`);
  assert.equal(out, '<ul><li>a&lt;b</li><li>c</li></ul><hr>');
});

test('null, undefined y false no pintan nada; 0 sí', () => {
  assert.equal(String(html`${null}${undefined}${false}${0}`), '0');
});

test('accion produce JSON válido tras desescapar el atributo', () => {
  const attr = String(accion('navigate', "it's <x>"));
  assert.ok(!attr.includes("'") && !attr.includes('<'));
  const decoded = attr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.deepEqual(JSON.parse(decoded), ['navigate', "it's <x>"]);
});
