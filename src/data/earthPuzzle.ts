import type { Puzzle3DConfig, SphericalCut, Transform3D } from '../types/puzzle';

/**
 * 🌎 ESTRUCTURA INTERNA DE LA TIERRA
 *
 * Todo el conocimiento de este rompecabezas vive aquí: geometría, colores,
 * zonas, textos, pistas y retroalimentación. El motor no sabe qué es un
 * "manto"; solo ve piezas con zonas y transformaciones objetivo.
 *
 * Escala deliberadamente exagerada (la corteza real sería un hilo de
 * 0,5 % del radio) para que cada capa se vea y se pueda manipular.
 */

/** Radios [interior, exterior] de cada capa (unidades de la escena). */
const LAYER = {
  innerCore: [0, 0.5],
  outerCore: [0.5, 0.95],
  mantle: [0.95, 1.45],
  crust: [1.45, 1.8],
} as const;

/** Octante recortado (x>0, y>0, z>0): orientado hacia la cámara inicial para ver las capas. */
const CUTAWAY: SphericalCut = {
  phiStart: Math.PI / 2,
  phiLength: Math.PI / 2,
  thetaStart: 0,
  thetaLength: Math.PI / 2,
};

/** Todas las capas comparten centro: lo que distingue su lugar es la profundidad (zona radial). */
const CENTERED: Transform3D = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };

export const earthPuzzleConfig: Puzzle3DConfig = {
  id: 'earth-layers',
  title: 'Construye la Tierra',
  description: 'Reconstruye las capas internas de la Tierra colocando cada una a la profundidad correcta.',
  icon: '🌎',
  subject: 'Ciencias Naturales',
  accentColor: '#38bdf8',
  mode: 'challenge',
  difficulty: 'medium',
  validation: { position: true, rotation: false, scale: false },
  interaction: {
    dragPlane: { type: 'camera-facing' },
    allowRotation: true,
    rotationStep: Math.PI / 4,
    rotationAxis: 'view-y',
    inspectSpin: true,
    shuffleTray: true,
    normalizeTraySize: true,
  },
  model: {
    category: 'planet',
    anchor: [0, 0, 0],
    camera: { direction: [1, 0.72, 1.15], fov: 42, framing: 1.12, minZoom: 0.55, maxZoom: 2 },
    ghost: { color: '#7dd3fc', opacity: 0.5 },
  },
  intro: {
    kicker: 'Rompecabezas gigante',
    heading: 'Construye la Tierra',
    lines: [
      'La Tierra está incompleta.',
      'Tu misión es reconstruir su estructura interna.',
      'Arrastra cada pieza hasta su posición correcta.',
    ],
    startLabel: 'Comenzar',
  },
  pieces: [
    {
      id: 'inner-core',
      name: 'Núcleo interno',
      geometry: { type: 'sphere-shell', innerRadius: LAYER.innerCore[0], outerRadius: LAYER.innerCore[1], cut: CUTAWAY, segments: 40 },
      appearance: {
        color: '#ffd166',
        surface: { type: 'noise', colors: ['#ffe597', '#ffc23d'], scale: 1.6, contrast: 1.2, seed: 2 },
        sectionColor: ['#fff8dc', '#ffc94d'],
        roughness: 0.42,
        metalness: 0.3,
      },
      targetTransform: CENTERED,
      dropZone: { type: 'shell', innerRadius: LAYER.innerCore[0], outerRadius: LAYER.innerCore[1] },
      snapThreshold: 0.25,
      info: {
        title: 'Núcleo interno',
        summary: 'Es la capa más interna de la Tierra. Es una esfera sólida formada principalmente por hierro y níquel.',
        facts: [
          { label: 'Estado', value: 'Sólido' },
          { label: 'Composición', value: 'Hierro y níquel' },
          { label: 'Temperatura', value: '≈ 5 400 °C' },
          { label: 'Profundidad', value: '5 150 – 6 371 km' },
        ],
      },
      hints: [
        'Es la parte más profunda del planeta: piensa en el centro.',
        'Aunque es la zona más caliente, es sólida por la enorme presión que soporta.',
      ],
      feedback: {
        zoneDescription: 'Esa zona es el centro mismo de la Tierra.',
        wrongZone: {
          'outer-core': 'Esa capa rodea al centro. El núcleo interno está todavía más adentro.',
          mantle: 'Esa es una capa de roca muy gruesa. El núcleo interno está en el centro del planeta.',
          crust: 'Esa es la superficie del planeta. El núcleo interno es lo más profundo de todo.',
        },
      },
    },
    {
      id: 'outer-core',
      name: 'Núcleo externo',
      geometry: { type: 'sphere-shell', innerRadius: LAYER.outerCore[0], outerRadius: LAYER.outerCore[1], cut: CUTAWAY, segments: 56 },
      appearance: {
        color: '#f59e0b',
        surface: { type: 'noise', colors: ['#f8a91f', '#de7409'], scale: 1.9, contrast: 1.3, seed: 5 },
        sectionColor: ['#fcc43a', '#f97316'],
        innerColor: '#a8500a',
        roughness: 0.5,
        metalness: 0.2,
      },
      targetTransform: CENTERED,
      dropZone: { type: 'shell', innerRadius: LAYER.outerCore[0], outerRadius: LAYER.outerCore[1] },
      snapThreshold: 0.25,
      info: {
        title: 'Núcleo externo',
        summary:
          'Rodea al núcleo interno. Es una capa de hierro y níquel fundidos; su movimiento genera el campo magnético de la Tierra.',
        facts: [
          { label: 'Estado', value: 'Líquido' },
          { label: 'Composición', value: 'Hierro y níquel' },
          { label: 'Temperatura', value: '4 000 – 5 000 °C' },
          { label: 'Profundidad', value: '2 900 – 5 150 km' },
        ],
      },
      hints: [
        'Es una capa de metal líquido que envuelve a la parte más profunda.',
        'Está entre el manto y el núcleo interno.',
      ],
      feedback: {
        zoneDescription: 'Esa zona es la capa de metal líquido que rodea al centro.',
        wrongZone: {
          'inner-core': 'Ese es el centro sólido del planeta. El núcleo externo lo envuelve por fuera.',
          mantle: 'Esa es la capa de roca más gruesa. El núcleo externo está más adentro, debajo del manto.',
          crust: 'Esa es la superficie. El núcleo externo es líquido y está a casi 3 000 km de profundidad.',
        },
      },
    },
    {
      id: 'mantle',
      name: 'Manto',
      geometry: { type: 'sphere-shell', innerRadius: LAYER.mantle[0], outerRadius: LAYER.mantle[1], cut: CUTAWAY, segments: 64 },
      appearance: {
        color: '#ea580c',
        surface: { type: 'noise', colors: ['#b8380b', '#f2711c'], scale: 2.2, contrast: 1.5, seed: 9 },
        sectionColor: ['#fb8a3c', '#b4231b'],
        innerColor: '#6f240d',
        roughness: 0.82,
        metalness: 0.02,
      },
      targetTransform: CENTERED,
      dropZone: { type: 'shell', innerRadius: LAYER.mantle[0], outerRadius: LAYER.mantle[1] },
      snapThreshold: 0.25,
      info: {
        title: 'Manto',
        summary:
          'Se encuentra entre la corteza y el núcleo. Es la capa más gruesa: roca muy caliente que fluye lentamente, como una pasta espesa.',
        facts: [
          { label: 'Estado', value: 'Sólido que fluye muy lento' },
          { label: 'Grosor', value: '≈ 2 900 km' },
          { label: 'Temperatura', value: '500 – 4 000 °C' },
          { label: 'Volumen', value: '≈ 84 % de la Tierra' },
        ],
      },
      hints: [
        'Es la capa más gruesa: ocupa la mayor parte del volumen de la Tierra.',
        'Esta capa se encuentra justo debajo de la corteza.',
      ],
      feedback: {
        zoneDescription: 'Esa zona es la capa más gruesa, justo debajo de la superficie.',
        wrongZone: {
          'inner-core': 'Ese es el centro de la Tierra. El manto está mucho más arriba, debajo de la corteza.',
          'outer-core': 'Esa capa es de metal líquido. El manto es de roca y está más cerca de la superficie.',
          crust: 'Esa es la capa más delgada y externa. El manto está justo debajo de ella.',
        },
      },
    },
    {
      id: 'crust',
      name: 'Corteza',
      geometry: { type: 'sphere-shell', innerRadius: LAYER.crust[0], outerRadius: LAYER.crust[1], cut: CUTAWAY, segments: 72 },
      appearance: {
        color: '#3b82f6',
        surface: {
          type: 'terrain',
          ocean: ['#0b3a8c', '#1f7ad6'],
          land: ['#3f8f3a', '#a29a55'],
          ice: '#eef6ff',
          seaLevel: 0.53,
          scale: 1.7,
          seed: 11,
        },
        sectionColor: ['#7a4a22', '#a0662c'],
        innerColor: '#4f3119',
        roughness: 0.86,
        metalness: 0,
      },
      targetTransform: CENTERED,
      dropZone: { type: 'shell', innerRadius: LAYER.crust[0], outerRadius: LAYER.crust[1] },
      // Margen generoso hacia fuera: la capa es fina y no debe exigir precisión milimétrica.
      snapThreshold: 0.6,
      info: {
        title: 'Corteza',
        summary:
          'Es la capa más externa y delgada de la Tierra. Sobre ella están los continentes, los océanos y todos los seres vivos.',
        facts: [
          { label: 'Estado', value: 'Sólida (rocas)' },
          { label: 'Grosor', value: '5 – 70 km' },
          { label: 'Tipos', value: 'Continental y oceánica' },
        ],
      },
      hints: ['Es la capa sobre la que vivimos.', 'Es la más delgada de todas y cubre el planeta por fuera.'],
      feedback: {
        zoneDescription: 'Esa zona es la superficie: la capa más externa y delgada.',
        wrongZone: {
          'inner-core': 'Ese es el centro del planeta. La corteza es la capa donde vivimos, en la superficie.',
          'outer-core': 'Esa capa es metal líquido muy profundo. La corteza está en la superficie.',
          mantle: 'Esa zona es muy gruesa. La corteza es delgada y cubre todo el planeta por fuera.',
        },
      },
    },
  ],
  completion: {
    icon: '🌎',
    title: 'Tierra reconstruida',
    message: 'Has reconstruido la estructura interna de la Tierra, desde el núcleo hasta la corteza.',
    closing: '¡Excelente trabajo!',
    orbit: true,
    revealDecorations: [
      {
        id: 'atmosphere',
        geometry: { type: 'sphere', radius: 1.97, segments: 48 },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
        material: 'halo',
        color: '#7cc8ff',
        opacity: 0.85,
      },
    ],
  },
  labels: {
    progress: '{placed} / {total} capas colocadas',
    trayHint: 'Arrastra cada capa hasta su lugar',
  },
};
