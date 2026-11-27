// Carga todos los scripts de index.html en su orden, sin navegador, para cazar lo que solo falla
// al abrir la app: un método repetido en defineAppMethods, un script sin registrar en el service
// worker o una ficha de módulo sin método que la pinte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, raiz), 'utf8');
const index = leer('index.html');
const scripts = [...index.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);

test('cada script de index.html existe y está en la caché del service worker', () => {
  assert.ok(scripts.length > 30, `se esperaban los scripts de la app y hay ${scripts.length}`);
  const sw = leer('sw.js');
  for (const s of scripts) {
    assert.ok(existsSync(new URL(s, raiz)), `no existe ${s}`);
    assert.ok(sw.includes(`'./${s}'`), `${s} no está en sw.js: sin red la app no arrancaría`);
  }
});

test('la clase de la app se monta entera: sin métodos repetidos y con los módulos registrados', () => {
  const nada = () => {};
  const elemento = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : elemento()), apply: () => elemento(), set: () => true });
  const documento = { addEventListener: nada, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: elemento, documentElement: { dataset: {}, classList: { add: nada, remove: nada, toggle: nada } }, body: elemento() };
  const almacen = { getItem: () => null, setItem: nada, removeItem: nada };
  const ventana = { addEventListener: nada, matchMedia: () => ({ matches: false, addEventListener: nada }), location: { hash: '', protocol: 'http:', hostname: 'localhost', origin: 'http://localhost', search: '', href: 'http://localhost/' }, history: { pushState: nada, replaceState: nada }, localStorage: almacen };
  const contexto = vm.createContext({
    window: ventana, document: documento, localStorage: almacen, sessionStorage: almacen, navigator: { onLine: true, userAgent: 'node' },
    location: ventana.location, history: ventana.history, console, setTimeout: nada, setInterval: nada, clearTimeout: nada, clearInterval: nada,
    requestAnimationFrame: nada, fetch: () => Promise.reject(new Error('sin red')), indexedDB: undefined, Element: class {}, URLSearchParams, URL, Intl, crypto: globalThis.crypto
  });
  // Un solo programa, como en el navegador: las declaraciones de un script las ven los siguientes
  const programa = scripts.map(s => `// ---- ${s}\n${leer(s)}`).join('\n;\n') + `
    ;globalThis.__resultado = JSON.stringify({
      metodos: Object.getOwnPropertyNames(NexusHiveBrainApp.prototype),
      modulos: ModulosCore.lista().map(m => ({ id: m.id, render: m.render, vista: m.vista, activo: m.activoPorDefecto })),
      repasar: NexusHiveBrainApp.REPASAR_VIEWS
    });`;
  vm.runInContext(programa, contexto, { filename: 'app-completa.js' });
  // Como texto: los objetos creados dentro del contexto son de otro «realm» y no comparan igual
  const { metodos, modulos, repasar } = JSON.parse(contexto.__resultado);

  assert.ok(metodos.length > 300, `la clase tiene ${metodos.length} métodos`);
  for (const m of ['renderViewAhora', 'renderMedidorEnergia', 'ordenarPorEnergia', 'incubarAutomatico', 'renderVistaModulo', 'modGuardar', 'capturarGasto', 'jarvisFindTask', 'toggleTaskStep']) {
    assert.ok(metodos.includes(m), `falta el método ${m}`);
  }
  assert.deepEqual(modulos.map(m => m.id), ['habitos', 'personas', 'finanzas']);
  for (const m of modulos) {
    assert.ok(metodos.includes(m.render), `el módulo ${m.id} no tiene ${m.render}`);
    assert.ok(repasar.includes(m.vista), `la vista ${m.vista} no es navegable`);
    assert.equal(m.activo, false, 'los módulos nuevos nacen apagados');
  }
  // Lo retirado en la limpieza no vuelve
  for (const viejo of ['promptMasticarTask', 'setBattery', 'calculateCurrentStreak']) assert.ok(!metodos.includes(viejo), `${viejo} debía desaparecer`);
});

test('ningún botón llama a un método retirado', () => {
  const fuentes = [index, ...scripts.map(leer)].join('\n');
  for (const viejo of ['promptMasticarTask', 'setBattery(', 'batteryLevel']) assert.ok(!fuentes.includes(viejo), `queda una referencia a ${viejo}`);
});
