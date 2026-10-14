import type { GeometryConfig, Puzzle3DConfig, SphericalCut, Transform3D, Vec3 } from '../types/puzzle';

/**
 * 🧬 CÉLULA ANIMAL
 *
 * Media célula abierta hacia el estudiante (como en los libros): la
 * membrana es un "cuenco", el citoplasma lo llena y los orgánulos asoman
 * semihundidos en su cara de corte. Cada orgánulo tiene su silueta; lo que
 * se aprende es reconocer su forma y su función.
 */

/** Quita la mitad delantera (z > 0) de la membrana y del citoplasma. */
const HALF_CUT: SphericalCut = { phiStart: 0, phiLength: Math.PI, thetaStart: 0, thetaLength: Math.PI };
/** Octante recortado del núcleo, orientado a la cámara: deja ver el nucléolo. */
const NUCLEUS_CUT: SphericalCut = { phiStart: Math.PI / 2, phiLength: Math.PI / 2, thetaStart: 0, thetaLength: Math.PI / 2 };

const CENTER: Transform3D = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
// z ligeramente positiva: la cara de corte del núcleo no coincide con la del citoplasma (evita z-fighting).
const NUCLEUS_POSITION: Vec3 = [-0.35, 0.25, 0.04];

const MITOCHONDRION_GEOMETRY: GeometryConfig = { type: 'capsule', radius: 0.15, length: 0.44, segments: 24 };
const MITOCHONDRION_APPEARANCE = {
  color: '#fb923c',
  // Bandas que evocan las crestas internas.
  surface: { type: 'stripes', colors: ['#ea580c', '#fdba74'], axis: 'y', frequency: 34 },
  roughness: 0.5,
} as const;

/** Retículo endoplasmático: capas curvas alrededor del núcleo (de -149° a 57°). */
const ER_GEOMETRY: GeometryConfig = {
  type: 'group',
  parts: [0.78, 0.92, 1.06].map((radius) => ({
    geometry: { type: 'torus' as const, radius, tube: 0.045, arc: 3.6 },
    position: [0, 0, 0.04] as Vec3,
    rotation: [0, 0, -2.6] as Vec3,
  })),
};

/** Aparato de Golgi: pila de sacos curvos y aplanados + vesículas, centrada en su origen. */
const GOLGI_GEOMETRY: GeometryConfig = {
  type: 'group',
  parts: [
    ...[0.3, 0.38, 0.46, 0.54].map((radius) => ({
      geometry: { type: 'torus' as const, radius, tube: 0.045, arc: 2.1 },
      position: [-0.42, 0, 0] as Vec3,
      rotation: [0, 0, -1.05] as Vec3,
      scale: [1, 1, 0.75] as Vec3,
    })),
    ...([
      [0.22, 0.36, 0],
      [0.3, -0.32, 0.02],
      [0.36, 0.04, 0.02],
    ] as Vec3[]).map((position) => ({ geometry: { type: 'sphere' as const, radius: 0.055, segments: 14 }, position })),
  ],
};

/** Ribosomas: muchos puntitos (posiciones fijas para que la forma sea siempre la misma). */
const RIBOSOME_DOTS: Vec3[] = [
  [0, 0, 0],
  [0.16, 0.06, 0.02],
  [-0.14, 0.1, 0.01],
  [0.05, -0.16, 0.03],
  [-0.08, -0.12, 0],
  [0.22, -0.1, 0.02],
  [-0.22, -0.04, 0.03],
  [0.1, 0.2, 0],
  [-0.04, 0.24, 0.02],
  [0.26, 0.16, 0.01],
  [-0.18, 0.2, 0],
  [0.02, -0.28, 0.01],
];

/** Mensaje común: un orgánulo soltado en un espacio libre del citoplasma. */
const FREE_CYTOPLASM = 'Ese es un espacio libre del citoplasma. Busca la silueta que tiene la forma de esta pieza.';

function mitochondrion(id: string, position: Vec3, angle: number): Puzzle3DConfig['pieces'][number] {
  return {
    id,
    name: 'Mitocondria',
    matchGroup: 'mitochondria',
    geometry: MITOCHONDRION_GEOMETRY,
    appearance: MITOCHONDRION_APPEARANCE,
    targetTransform: { position, rotation: [0, 0, angle], scale: 1 },
    dropZone: { type: 'sphere', radius: 0.3 },
    snapThreshold: 0.12,
    info: {
      title: 'Mitocondria',
      summary:
        'Es la central de energía de la célula: transforma los nutrientes en energía mediante la respiración celular. Una célula puede tener cientos.',
      facts: [
        { label: 'Produce', value: 'ATP (energía)' },
        { label: 'Proceso', value: 'Respiración celular' },
        { label: 'Curiosidad', value: 'Tiene su propio ADN' },
      ],
    },
    hints: ['Tiene forma de cápsula o de frijol.', 'Produce la energía de la célula; hay varias repartidas por el citoplasma.'],
    feedback: {
      zoneDescription: 'Esa silueta con forma de cápsula es la de la central de energía de la célula.',
      wrongZone: { cytoplasm: FREE_CYTOPLASM },
    },
  };
}

export const cellPuzzleConfig: Puzzle3DConfig = {
  id: 'animal-cell',
  title: 'La célula animal',
  description: 'Reconstruye una célula animal: su membrana, el citoplasma, el núcleo y sus orgánulos.',
  icon: '🧬',
  subject: 'Biología',
  accentColor: '#f472b6',
  mode: 'challenge',
  difficulty: 'medium',
  validation: { position: true, rotation: false, scale: false },
  interaction: {
    dragPlane: { type: 'fixed', normal: [0, 0, 1] }, // la cara de corte de la célula
    allowRotation: false,
    inspectSpin: true,
    shuffleTray: true,
    normalizeTraySize: true,
  },
  model: {
    category: 'cell',
    anchor: [0, 0, 0],
    camera: { direction: [0.28, 0.32, 1], fov: 42, framing: 1.08, minZoom: 0.5, maxZoom: 2 },
    ghost: { color: '#f0abfc', opacity: 0.5 },
  },
  intro: {
    kicker: 'Rompecabezas gigante',
    heading: 'Construye una célula animal',
    lines: [
      'Esta célula está vacía.',
      'Reconstrúyela colocando cada parte en su lugar.',
      'Fíjate en la forma de cada silueta.',
    ],
    startLabel: 'Comenzar',
  },
  pieces: [
    {
      id: 'membrane',
      name: 'Membrana celular',
      shortName: 'Membrana',
      geometry: { type: 'sphere-shell', innerRadius: 1.92, outerRadius: 2, cut: HALF_CUT, segments: 72 },
      appearance: {
        color: '#f472b6',
        surface: { type: 'noise', colors: ['#f9a8d4', '#ec4899'], scale: 2.2, contrast: 1 },
        sectionColor: ['#fbcfe8', '#f9a8d4'],
        innerColor: '#f9a8d4',
        roughness: 0.55,
      },
      targetTransform: CENTER,
      // Banda del borde con margen generoso hacia fuera.
      dropZone: { type: 'shell', innerRadius: 1.84, outerRadius: 2.6 },
      snapThreshold: 0.08,
      info: {
        title: 'Membrana celular',
        summary: 'Envoltura flexible que rodea la célula. La protege y controla qué sustancias entran y salen.',
        facts: [
          { label: 'Composición', value: 'Lípidos y proteínas' },
          { label: 'Grosor', value: '≈ 7–10 nm' },
          { label: 'Función', value: 'Proteger y regular el intercambio' },
        ],
      },
      hints: ['Es el borde que envuelve toda la célula.', 'Controla lo que entra y sale: va por fuera de todo lo demás.'],
      feedback: {
        zoneDescription: 'Ese es el borde de la célula, que la separa del exterior.',
        wrongZoneDefault: 'La membrana no va dentro: envuelve toda la célula. Suéltala en el borde.',
      },
    },
    {
      id: 'cytoplasm',
      name: 'Citoplasma',
      geometry: { type: 'sphere-shell', innerRadius: 0, outerRadius: 1.9, cut: HALF_CUT, segments: 64 },
      appearance: {
        color: '#99f6e4',
        surface: { type: 'noise', colors: ['#a7f3d0', '#99f6e4'], scale: 2, contrast: 0.8 },
        sectionColor: ['#ecfeff', '#a5f3fc'],
        roughness: 0.92,
      },
      targetTransform: CENTER,
      // Zona "de fondo": todo el interior que no sea un orgánulo.
      dropZone: { type: 'shell', innerRadius: 0, outerRadius: 1.84, priority: -1 },
      snapThreshold: 0.05,
      info: {
        title: 'Citoplasma',
        summary:
          'Material gelatinoso que llena la célula. En él flotan los orgánulos y ocurren muchas de las reacciones químicas de la vida.',
        facts: [
          { label: 'Composición', value: '≈ 70–80 % agua' },
          { label: 'Contiene', value: 'Orgánulos y citoesqueleto' },
        ],
      },
      hints: ['Es el material gelatinoso que llena la célula.', 'Suéltalo en un espacio libre dentro de la célula.'],
      feedback: {
        zoneDescription: 'Ese es el interior de la célula, lleno de un líquido gelatinoso.',
        wrongZoneDefault: 'Ahí va un orgánulo. Suelta el citoplasma en un espacio libre dentro de la célula.',
        wrongZone: { membrane: 'Ese es el borde de la célula. El citoplasma va dentro, en un espacio libre.' },
      },
    },
    {
      id: 'nucleus',
      name: 'Núcleo',
      geometry: {
        type: 'group',
        parts: [
          {
            // Envoltura nuclear
            geometry: { type: 'sphere-shell', innerRadius: 0.5, outerRadius: 0.6, cut: NUCLEUS_CUT, segments: 48 },
            appearance: {
              color: '#8b5cf6',
              surface: { type: 'noise', colors: ['#7c3aed', '#a78bfa'], scale: 3, contrast: 1.2 },
              sectionColor: ['#c4b5fd', '#a78bfa'],
              innerColor: '#c4b5fd',
            },
          },
          {
            // Nucleoplasma
            geometry: { type: 'sphere-shell', innerRadius: 0, outerRadius: 0.5, cut: NUCLEUS_CUT, segments: 40 },
            appearance: { color: '#ddd6fe', sectionColor: ['#ede9fe', '#ddd6fe'] },
          },
          {
            // Nucléolo
            geometry: { type: 'sphere', radius: 0.2, segments: 28 },
            appearance: { color: '#4c1d95' },
          },
        ],
      },
      appearance: { color: '#8b5cf6', roughness: 0.5 },
      targetTransform: { position: NUCLEUS_POSITION, rotation: [0, 0, 0], scale: 1 },
      dropZone: { type: 'sphere', radius: 0.6 },
      snapThreshold: 0.15,
      info: {
        title: 'Núcleo',
        summary:
          'Es el centro de control de la célula. Guarda el ADN con las instrucciones para su funcionamiento. Dentro está el nucléolo, que fabrica los ribosomas.',
        facts: [
          { label: 'Contiene', value: 'ADN' },
          { label: 'Envoltura', value: 'Doble membrana con poros' },
          { label: 'Dentro', value: 'Nucléolo' },
        ],
      },
      hints: [
        'Es el orgánulo más grande: el centro de control.',
        'Dentro tiene un nucléolo oscuro; busca la silueta redonda más grande.',
      ],
      feedback: {
        zoneDescription: 'Esa silueta grande y redonda es la del centro de control de la célula.',
        wrongZone: { cytoplasm: 'Ese espacio es citoplasma. El núcleo tiene su propia silueta: la más grande y redonda.' },
      },
    },
    mitochondrion('mitochondrion-a', [1, 0.95, 0.06], 0.7),
    mitochondrion('mitochondrion-b', [-1.28, 0.92, 0.06], -0.65),
    {
      id: 'ribosomes',
      name: 'Ribosomas',
      geometry: {
        type: 'group',
        parts: RIBOSOME_DOTS.map((position) => ({
          geometry: { type: 'sphere' as const, radius: 0.045, segments: 12 },
          position,
        })),
      },
      appearance: { color: '#2563eb', roughness: 0.4 },
      targetTransform: { position: [0.2, -1.28, 0.04], rotation: [0, 0, 0], scale: 1 },
      dropZone: { type: 'sphere', radius: 0.3 },
      snapThreshold: 0.12,
      info: {
        title: 'Ribosomas',
        summary: 'Pequeñísimas estructuras que fabrican proteínas siguiendo las instrucciones del ADN.',
        facts: [
          { label: 'Función', value: 'Fabricar proteínas' },
          { label: 'Dónde están', value: 'Libres o sobre el retículo' },
          { label: 'Tamaño', value: '≈ 20–30 nm' },
        ],
      },
      hints: ['Son muchísimos puntitos diminutos.', 'Fabrican proteínas: búscalos como un grupo de puntos.'],
      feedback: {
        zoneDescription: 'Esos puntitos son los fabricantes de proteínas.',
        wrongZone: {
          cytoplasm: FREE_CYTOPLASM,
          lysosome: 'Esa esfera es un lisosoma, que digiere desechos. Los ribosomas son muchos puntitos diminutos.',
        },
      },
    },
    {
      id: 'er',
      name: 'Retículo endoplasmático',
      shortName: 'Retículo',
      geometry: ER_GEOMETRY,
      appearance: { color: '#38bdf8', roughness: 0.45 },
      // Comparte centro con el núcleo: su lugar es la banda que lo rodea.
      targetTransform: { position: NUCLEUS_POSITION, rotation: [0, 0, 0], scale: 1 },
      dropZone: { type: 'shell', innerRadius: 0.72, outerRadius: 1.12 },
      snapThreshold: 0.1,
      info: {
        title: 'Retículo endoplasmático',
        summary:
          'Red de membranas plegadas unida al núcleo. Fabrica y transporta sustancias: el rugoso tiene ribosomas y hace proteínas; el liso produce lípidos.',
        facts: [
          { label: 'Tipos', value: 'Rugoso y liso' },
          { label: 'Función', value: 'Fabricar y transportar' },
        ],
      },
      hints: ['Es una red de membranas plegadas pegada al núcleo.', 'Rodea al núcleo como capas curvas.'],
      feedback: {
        zoneDescription: 'Esas capas curvas que rodean al núcleo transportan sustancias.',
        wrongZone: {
          cytoplasm: FREE_CYTOPLASM,
          golgi: 'Esa pila de sacos separada del núcleo es el aparato de Golgi. El retículo está unido al núcleo y lo rodea.',
        },
      },
    },
    {
      id: 'golgi',
      name: 'Aparato de Golgi',
      shortName: 'Golgi',
      geometry: GOLGI_GEOMETRY,
      appearance: { color: '#fbbf24', roughness: 0.45 },
      // La cara cóncava mira hacia el núcleo.
      targetTransform: { position: [0.95, -0.62, 0.06], rotation: [0, 0, -0.6], scale: 1 },
      dropZone: { type: 'sphere', radius: 0.38 },
      snapThreshold: 0.12,
      info: {
        title: 'Aparato de Golgi',
        summary:
          'Pila de sacos aplanados que modifica, empaqueta y envía las proteínas a su destino, como una oficina de correos.',
        facts: [
          { label: 'Forma', value: 'Sacos aplanados (cisternas)' },
          { label: 'Función', value: 'Empaquetar y distribuir' },
          { label: 'Produce', value: 'Vesículas' },
        ],
      },
      hints: ['Parece una pila de sacos aplanados y curvos.', 'Está cerca del retículo, pero separado del núcleo.'],
      feedback: {
        zoneDescription: 'Esa pila de sacos aplanados empaqueta y envía proteínas.',
        wrongZone: {
          cytoplasm: FREE_CYTOPLASM,
          er: 'Esas capas que rodean al núcleo son el retículo endoplasmático. El aparato de Golgi es una pila de sacos más alejada.',
        },
      },
    },
    {
      id: 'lysosome',
      name: 'Lisosoma',
      geometry: { type: 'sphere', radius: 0.21, segments: 32 },
      appearance: {
        color: '#34d399',
        surface: { type: 'noise', colors: ['#10b981', '#6ee7b7'], scale: 3, contrast: 1 },
        roughness: 0.45,
      },
      targetTransform: { position: [-1.2, -0.92, 0.06], rotation: [0, 0, 0], scale: 1 },
      dropZone: { type: 'sphere', radius: 0.26 },
      snapThreshold: 0.12,
      info: {
        title: 'Lisosoma',
        summary: 'Pequeña vesícula llena de enzimas digestivas. Descompone desechos y partes viejas de la célula.',
        facts: [
          { label: 'Contiene', value: 'Enzimas digestivas' },
          { label: 'Función', value: 'Digestión celular' },
          { label: 'Típico de', value: 'Células animales' },
        ],
      },
      hints: ['Es una pequeña esfera llena de enzimas.', 'Es una sola vesícula redonda, más grande que un ribosoma.'],
      feedback: {
        zoneDescription: 'Esa pequeña esfera digiere los desechos de la célula.',
        wrongZone: {
          cytoplasm: FREE_CYTOPLASM,
          ribosomes: 'Esos puntitos son ribosomas, que fabrican proteínas. El lisosoma es una sola vesícula más grande.',
        },
      },
    },
  ],
  completion: {
    icon: '🧬',
    title: 'Célula reconstruida',
    message: 'Has armado una célula animal: membrana, citoplasma, núcleo y los orgánulos que la mantienen viva.',
    closing: '¡Excelente trabajo!',
    orbit: true,
    revealDecorations: [
      {
        id: 'cell-glow',
        geometry: { type: 'sphere', radius: 2.12, segments: 48 },
        transform: CENTER,
        material: 'halo',
        color: '#f9a8d4',
        opacity: 0.7,
      },
    ],
  },
  labels: {
    progress: '{placed} / {total} partes colocadas',
    trayHint: 'Arrastra cada parte a su silueta',
  },
};
