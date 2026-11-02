// Paleta de los 9 colores de humo. Global: la usan el motor del orbe y la app.

/**
 * ==========================================================================
 * PALETA CROMÁTICA NEURODIVERGENTE DEL PENSADERO (8 COLORES NUCLEARES)
 * ==========================================================================
 * Atajo perceptivo y neuroquímico para interpretar estado, urgencia y destino.
 */
const SMOKE_PALETTE = {
  humo_general: {
    name: 'Sin clasificar',
    title: 'Sin clasificar',
    desc: 'Pensamiento recién capturado. Deja fluir la mente, puedes clasificarlo luego.',
    hex: '#06B6D4',
    vec3: [0.02, 0.71, 0.83],
    coreVec3: [0.01, 0.45, 0.55],
    category: 'humo_general',
    module: 'pensadero_puro',
    cognitiveWeight: 'libre',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    icon: '✨',
    shader: { turbulence: 0.3, pulse: 0.1, density: 1.0, dissipation: 0.1, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.3 }
  },
  humo_blanco: {
    name: 'Soltar',
    title: 'Soltar y olvidar',
    desc: 'Pensamiento intrusivo o rumiación pasajera para soltar y liberar memoria de trabajo.',
    hex: '#F1F5F9',
    vec3: [0.94, 0.96, 0.98],
    coreVec3: [0.6, 0.65, 0.7],
    category: 'humo_blanco',
    module: 'ideario_archivo',
    cognitiveWeight: 'ligero',
    badgeClass: 'bg-slate-100/15 text-slate-100 border-slate-200/30',
    icon: '⚪',
    shader: { turbulence: 0.15, pulse: 0.0, density: 0.75, dissipation: 0.8, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.4 }
  },
  humo_rojo: {
    name: 'Urgente',
    title: 'Fuego activo / Urgente',
    desc: 'Pendientes inmediatos, emergencias o fechas límite críticas.',
    hex: '#EF4444',
    vec3: [0.93, 0.26, 0.26],
    coreVec3: [0.6, 0.08, 0.08],
    category: 'humo_rojo',
    module: 'tasks_urgente',
    cognitiveWeight: 'fuego',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    icon: '🔴',
    shader: { turbulence: 0.85, pulse: 1.0, density: 1.4, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.0 }
  },
  humo_dorado: {
    name: 'Idea',
    title: 'Ideas y chispas de creación',
    desc: 'Metas de aprendizaje, ideas de creación, features o proyectos a estructurar.',
    hex: '#FFD60A',
    vec3: [1.0, 0.84, 0.04],
    coreVec3: [0.75, 0.55, 0.02],
    category: 'humo_dorado',
    module: 'proyectos_kanban',
    cognitiveWeight: 'medio',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
    icon: '🟡',
    shader: { turbulence: 0.4, pulse: 0.0, density: 1.2, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.2 }
  },
  humo_azul: {
    name: 'Hacer',
    title: 'Hacer y Deep Work',
    desc: 'Sesiones de enfoque profundo, código, arquitectura, resolución lógica y escritura técnica.',
    hex: '#3B82F6',
    vec3: [0.23, 0.51, 0.96],
    coreVec3: [0.1, 0.25, 0.65],
    category: 'humo_azul',
    module: 'calendario_deepwork',
    cognitiveWeight: 'pesado',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    icon: '🔵',
    shader: { turbulence: 0.1, pulse: 0.0, density: 1.1, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.0 }
  },
  humo_verde: {
    name: 'Cuerpo y Hábitos',
    title: 'Hábitos y Bienestar',
    desc: 'Medicación, hidratación, ejercicio, balance vital y constancia sin fricción.',
    hex: '#10B981',
    vec3: [0.06, 0.72, 0.50],
    coreVec3: [0.03, 0.4, 0.25],
    category: 'humo_verde',
    module: 'habitos_salud',
    cognitiveWeight: 'ligero',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    icon: '🟢',
    shader: { turbulence: 0.25, pulse: 0.0, density: 1.0, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 1.0, flash: 0.1 }
  },
  humo_purpura: {
    name: 'Personas',
    title: 'Personas y Conexión',
    desc: 'Llamadas pendientes a familia, amigos, cumpleaños y notas afectivas.',
    hex: '#A855F7',
    vec3: [0.65, 0.33, 0.96],
    coreVec3: [0.35, 0.15, 0.55],
    category: 'humo_purpura',
    module: 'crm_personal',
    cognitiveWeight: 'medio',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    icon: '🟣',
    shader: { turbulence: 0.3, pulse: 0.3, density: 1.1, dissipation: 0.0, satellites: 1.0, sink: 0.0, expansion: 0.0, flash: 0.0 }
  },
  humo_naranja: {
    name: 'Dinero',
    title: 'Dinero y Finanzas',
    desc: 'Gastos, compras, pagos fijos del mes o presupuestos en tiempo real.',
    hex: '#C2410C',
    vec3: [0.76, 0.25, 0.05],
    coreVec3: [0.45, 0.12, 0.02],
    category: 'humo_naranja',
    module: 'finanzas',
    cognitiveWeight: 'medio',
    badgeClass: 'bg-amber-700/20 text-amber-300 border-amber-700/40',
    icon: '🟠',
    shader: { turbulence: 0.6, pulse: 0.0, density: 1.3, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 1.0 }
  },
  humo_ceniza: {
    name: 'Después',
    title: 'Guardar para después',
    desc: 'Ideas interesantes que saturan hoy. Congeladas por 14-30 días sin culpa.',
    hex: '#64748B',
    vec3: [0.39, 0.45, 0.54],
    coreVec3: [0.2, 0.24, 0.3],
    category: 'humo_ceniza',
    module: 'hibernacion',
    cognitiveWeight: 'ligero',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
    icon: '🔘',
    shader: { turbulence: 0.05, pulse: 0.0, density: 0.5, dissipation: 0.4, satellites: 0.0, sink: 1.0, expansion: 0.0, flash: 0.0 }
  },
  humo_tarea: {
    name: 'Hacer',
    title: 'Hacer y Deep Work',
    desc: 'Acciones pendientes y tareas a ejecutar.',
    hex: '#3B82F6',
    vec3: [0.23, 0.51, 0.96],
    coreVec3: [0.1, 0.25, 0.65],
    category: 'humo_azul',
    module: 'calendario_deepwork',
    cognitiveWeight: 'pesado',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    icon: '🔵',
    shader: { turbulence: 0.1, pulse: 0.0, density: 1.1, dissipation: 0.0, satellites: 0.0, sink: 0.0, expansion: 0.0, flash: 0.0 }
  }
};
