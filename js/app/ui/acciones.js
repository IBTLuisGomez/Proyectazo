'use strict';
// Delegación de eventos: sustituye los manejadores inline de HTML (atributos on*).
//
//   <button data-on-click='["navigate","soltar"]'>               una llamada: [método, ...argumentos]
//   <button data-on-click='[["closeModal","m"],["openJarvis"]]'>  varias, en orden
//   <form data-on-submit='["submitCheckout","$event"]'>
//   <input data-on-change='["setCloudAI","$checked"]'>
//   <input data-on-enter='["submitBaulUnlock"]'>                 keydown con la tecla Enter
//
// Argumentos especiales: "$event", "$checked", "$value" (del elemento que tiene el atributo) y
// "$text:<selector>" (textContent de otro elemento). Un texto literal que empiece por "$" se escribe "$$...".
// Como los inline, se ejecutan del elemento más interno hacia fuera y respetan event.stopPropagation().
// Los argumentos son datos JSON, nunca código: no hace falta escapar comillas de JavaScript.

const ACCIONES_EVENTOS = ['click', 'submit', 'change', 'input', 'keydown', 'pointerdown', 'pointerup', 'pointerleave'];

function accionArgumento(arg, el, ev) {
  if (typeof arg !== 'string' || arg[0] !== '$') return arg;
  if (arg.startsWith('$$')) return arg.slice(1);
  if (arg === '$event') return ev;
  if (arg === '$checked') return el.checked;
  if (arg === '$value') return el.value;
  if (arg.startsWith('$text:')) {
    const target = document.querySelector(arg.slice(6));
    return target ? target.textContent : '';
  }
  return arg;
}

function accionEjecutar(json, el, ev) {
  let calls;
  try {
    calls = JSON.parse(json);
  } catch (err) {
    console.error('Acción con JSON no válido:', json);
    return;
  }
  if (!Array.isArray(calls) || !calls.length) return;
  if (!Array.isArray(calls[0])) calls = [calls];
  for (const [method, ...args] of calls) {
    // `app` es la instancia global creada en js/app.js al cargar la página
    const target = typeof app !== 'undefined' ? app : null;
    const fn = target && target[method];
    if (typeof fn !== 'function') {
      console.error(`Acción desconocida: ${method}`);
      continue;
    }
    fn.apply(target, args.map(a => accionArgumento(a, el, ev)));
  }
}

function accionManejar(ev) {
  const attrs = [`data-on-${ev.type}`];
  if (ev.type === 'keydown' && ev.key === 'Enter') attrs.push('data-on-enter');
  for (const attr of attrs) {
    if (ev.type === 'pointerleave') {
      // No burbujea: solo cuenta el propio elemento
      const el = ev.target;
      if (el instanceof Element && el.hasAttribute(attr)) accionEjecutar(el.getAttribute(attr), el, ev);
      continue;
    }
    let el = ev.target instanceof Element ? ev.target.closest(`[${attr}]`) : null;
    while (el && !ev.cancelBubble) {
      accionEjecutar(el.getAttribute(attr), el, ev);
      el = el.parentElement ? el.parentElement.closest(`[${attr}]`) : null;
    }
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  ACCIONES_EVENTOS.forEach(type => document.addEventListener(type, accionManejar, type === 'pointerleave'));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { accionArgumento, accionEjecutar, accionManejar, ACCIONES_EVENTOS };
}
