/** Antes vivía inline en index.html junto al CDN de Tailwind. Ahora se compila: npm run build:css */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', '"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        'stitch-primary': '#4cd7f6',
        'stitch-secondary': '#d0bcff',
        'stitch-tertiary': '#4edea3',
        'stitch-surface': '#0f131d',
        'stitch-surface-container': '#1c1f2a',
        'stitch-surface-high': '#262a35',
        'stitch-surface-lowest': '#0a0e18',
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
    },
  },
};
