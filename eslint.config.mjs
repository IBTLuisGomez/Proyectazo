// ESLint del frontend (scripts clásicos que comparten globales). Ejecutar: npm run lint
import globals from 'globals';

// Nombres globales que un script define y otros usan
const proyecto = {
  app: 'writable', NexusHiveBrainApp: 'readonly', ProyectazoApp: 'readonly', defineAppMethods: 'readonly',
  SMOKE_PALETTE: 'readonly', SMOKE_GROUPS: 'readonly', SMOKE_TAGS: 'readonly', SMOKE_VISIBLE_KEYS: 'readonly',
  categoriaVisible: 'readonly', etiquetaDe: 'readonly',
  CLASIFICADOR_REGLAS: 'readonly', CapturaParser: 'readonly', NotasCore: 'readonly', FocoCore: 'readonly', PasosCore: 'readonly', EnergiaCore: 'readonly', ModulosCore: 'readonly', HabitosCore: 'readonly', PersonasCore: 'readonly', FinanzasCore: 'readonly', NexusAhora: 'readonly', NexusIDB: 'readonly', PensaderoShaderEngine: 'readonly',
  html: 'readonly', raw: 'readonly', accion: 'readonly',
  module: 'readonly', require: 'readonly'
};

export default [
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, ...proyecto } },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-self-assign': 'error',
      'no-unsafe-finally': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }]
    }
  }
];
