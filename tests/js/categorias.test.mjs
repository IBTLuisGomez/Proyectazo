// Ejecutar: node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../../js/smoke-palette.js');

test('las claves antiguas se agrupan en las 5 categorías visibles', () => {
  assert.equal(C.categoriaVisible('humo_purpura'), 'humo_verde');
  assert.equal(C.categoriaVisible('humo_naranja'), 'humo_verde');
  assert.equal(C.categoriaVisible('humo_tarea'), 'humo_verde');
  assert.equal(C.categoriaVisible('humo_blanco'), 'humo_ceniza');
  assert.equal(C.categoriaVisible('humo_rojo'), 'humo_rojo');
  assert.equal(C.categoriaVisible(undefined), 'humo_general');
  assert.equal(C.categoriaVisible('desconocida'), 'humo_general');
});

test('toda clave de la paleta tiene grupo visible y se ve como él', () => {
  for (const k of Object.keys(C.SMOKE_PALETTE)) {
    const g = C.categoriaVisible(k);
    assert.ok(C.SMOKE_VISIBLE_KEYS.includes(g), k);
    assert.equal(C.SMOKE_PALETTE[k].name, C.SMOKE_PALETTE[g].name, k);
    assert.equal(C.SMOKE_PALETTE[k].hex, C.SMOKE_PALETTE[g].hex, k);
  }
});

test('los subtipos conservan su etiqueta y su categoría guardada', () => {
  assert.match(C.etiquetaDe('humo_purpura'), /personas/);
  assert.equal(C.SMOKE_PALETTE.humo_purpura.category, 'humo_purpura');
  assert.equal(C.etiquetaDe('humo_rojo'), '');
});
