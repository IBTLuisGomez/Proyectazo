"""Genera assets/contraste.css: correcciones de contraste WCAG AA sobre las clases de Tailwind.

Uso: python scripts/gen-contraste.py

Por qué un fichero aparte: la interfaz usa colores pensados para fondo oscuro (cyan-300, slate-400…)
también en el tema claro, y botones con texto blanco sobre fondos medios (emerald-600, cyan-600)
que no llegan a 4.5:1. Reescribir cientos de plantillas sería frágil; estas reglas corrigen el color
final según el tema y respetan los componentes que siguen siendo oscuros dentro del tema claro.
"""
from pathlib import Path

# Tono 700 de Tailwind: contraste >= 4.5:1 sobre blanco
SHADE_700 = {
    'cyan': '#0e7490', 'amber': '#b45309', 'emerald': '#047857', 'purple': '#7e22ce', 'rose': '#be123c',
    'blue': '#1d4ed8', 'indigo': '#4338ca', 'orange': '#c2410c', 'yellow': '#a16207', 'green': '#15803d',
    'sky': '#0369a1', 'teal': '#0f766e', 'violet': '#6d28d9', 'pink': '#be185d', 'red': '#b91c1c',
    'lime': '#4d7c0f', 'fuchsia': '#a21caf', 'brand': '#047857',
}
SHADE_800 = {
    'cyan': '#155e75', 'emerald': '#065f46', 'rose': '#9f1239', 'teal': '#115e59', 'sky': '#075985',
    'amber': '#92400e', 'orange': '#9a3412', 'brand': '#065f46',
}

out = [
    '/* Generado por scripts/gen-contraste.py — no editar a mano */',
    '',
    '/* 1. Texto blanco sobre fondos medios (todos los temas): oscurecer el fondo hasta 4.5:1 */',
]
for c, bg700 in SHADE_700.items():
    if c in ('indigo', 'purple', 'violet', 'blue', 'red', 'pink', 'fuchsia'):
        continue  # sus tonos 600 ya pasan con blanco
    for s in (500, 600):
        out.append(f'.text-white.bg-{c}-{s} {{ background-color: {bg700} !important; }}')
        if c in SHADE_800:
            out.append(f'.text-white.hover\\:bg-{c}-{s - 100 if s == 600 else s}:hover {{ background-color: {SHADE_800[c]} !important; }}')

out += [
    '',
    '/* 2. Temas oscuros: los grises 500/600 no llegan a 4.5:1 sobre fondo oscuro */',
    'html:not(.theme-light) .text-slate-500, html:not(.theme-light) .text-slate-600 { color: #94a3b8 !important; }',
    'html:not(.theme-light) .placeholder-slate-500::placeholder, html:not(.theme-light) .placeholder-slate-600::placeholder { color: #94a3b8 !important; }',
    '',
    '/* 3. Tema claro: js/app/ui/contraste.js marca con .on-light el texto que no llega a 4.5:1 sobre su',
    '   fondo real; aquí se oscurece conservando el tono (tono 700 de Tailwind). */',
    'html.theme-light .on-light { color: #0f172a !important; }',
    'html.theme-light .on-dark { color: #f8fafc !important; }',
]
for c, col in SHADE_700.items():
    for s in (200, 300, 400, 500):
        out.append(f'html.theme-light .on-light.text-{c}-{s} {{ color: {col} !important; }}')
for s in (200, 300, 400):
    out.append(f'html.theme-light .on-light.text-slate-{s} {{ color: #475569 !important; }}')

target = Path(__file__).resolve().parent.parent / 'assets' / 'contraste.css'
target.write_text('\n'.join(out) + '\n', encoding='utf-8')
print(f'{target.relative_to(target.parent.parent)}: {len(out)} líneas')
