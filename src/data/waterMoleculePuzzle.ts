import type { DecorationConfig, GeometryConfig, Puzzle3DConfig, Vec3 } from '../types/puzzle';

/**
 * 💧 MOLÉCULA DE AGUA (H₂O)
 *
 * Modelo de bolas y varillas: un oxígeno central, dos hidrógenos y dos
 * enlaces covalentes. Lo que se aprende:
 * - el oxígeno es el átomo central porque forma dos enlaces (el H solo uno);
 * - los enlaces unen átomos (se colocan después de los átomos);
 * - la molécula NO es lineal: forma un ángulo de 104,5°. Las zonas trampa en
 *   línea recta explican por qué (pares de electrones libres del oxígeno).
 *
 * Distancias en unidades de la escena (exageradas respecto a los 96 pm reales).
 */

const BOND_LENGTH = 1.6;
const HALF_ANGLE = ((104.5 / 2) * Math.PI) / 180; // 52,25° a cada lado de la vertical
const OXYGEN_Y = 0.35; // centra visualmente la molécula

/** Punto a `distance` del oxígeno en la dirección de un enlace (side: 1 derecha, -1 izquierda). */
function alongBond(side: 1 | -1, distance: number): Vec3 {
  return [side * Math.sin(HALF_ANGLE) * distance, OXYGEN_Y - Math.cos(HALF_ANGLE) * distance, 0];
}

const OXYGEN_POSITION: Vec3 = [0, OXYGEN_Y, 0];

/** Enlace bicolor (mitad hidrógeno, mitad oxígeno), con +Y apuntando al oxígeno. */
const BOND_GEOMETRY: GeometryConfig = {
  type: 'group',
  parts: [
    {
      geometry: { type: 'cylinder', radiusTop: 0.1, radiusBottom: 0.1, height: 0.5, segments: 20 },
      position: [0, -0.25, 0],
      appearance: { color: '#e2e8f0' },
    },
    {
      geometry: { type: 'cylinder', radiusTop: 0.1, radiusBottom: 0.1, height: 0.5, segments: 20 },
      position: [0, 0.25, 0],
      appearance: { color: '#ef4444' },
    },
  ],
};

const ATOM_SLOT_FOR_BOND = 'Ese lugar es para un átomo. Los enlaces van entre dos átomos.';
const BOND_SLOT_FOR_ATOM = 'Ese espacio es para un enlace, no para un átomo.';
const LINEAR_EXPLANATION =
  'Si los hidrógenos estuvieran en línea recta, la molécula sería lineal (180°). En el agua, los dos pares de electrones libres del oxígeno empujan los enlaces hacia abajo: por eso forman un ángulo de 104,5°.';

function hydrogen(id: string, side: 1 | -1): Puzzle3DConfig['pieces'][number] {
  return {
    id,
    name: 'Hidrógeno',
    matchGroup: 'hydrogen',
    geometry: { type: 'sphere', radius: 0.36, segments: 40 },
    appearance: {
      color: '#f1f5f9',
      surface: { type: 'noise', colors: ['#e2e8f0', '#ffffff'], scale: 2, contrast: 0.8 },
      roughness: 0.3,
      metalness: 0.05,
    },
    targetTransform: { position: alongBond(side, BOND_LENGTH), rotation: [0, 0, 0], scale: 1 },
    dropZone: { type: 'sphere', radius: 0.3 },
    snapThreshold: 0.25,
    requires: ['oxygen'],
    info: {
      title: 'Hidrógeno (H)',
      summary: 'Es el átomo más pequeño y ligero. Tiene un solo electrón, por eso forma un único enlace.',
      facts: [
        { label: 'Símbolo', value: 'H' },
        { label: 'Número atómico', value: '1' },
        { label: 'Electrones de valencia', value: '1' },
        { label: 'Enlaces que forma', value: '1' },
      ],
    },
    hints: [
      'Cada hidrógeno solo puede formar un enlace: va en un extremo de la molécula.',
      'Los hidrógenos no quedan en línea recta con el oxígeno: forman un ángulo.',
    ],
    feedback: {
      zoneDescription: 'Ese lugar es un extremo de la molécula, formando ángulo con el oxígeno.',
      requires: 'El hidrógeno se une al átomo central. Primero coloca el oxígeno.',
      wrongZone: {
        oxygen: 'Ese es el lugar del átomo central. El hidrógeno solo forma un enlace, así que no puede estar en el centro.',
        bond: BOND_SLOT_FOR_ATOM,
      },
    },
  };
}

function bond(id: string, side: 1 | -1): Puzzle3DConfig['pieces'][number] {
  return {
    id,
    name: 'Enlace covalente',
    shortName: 'Enlace',
    matchGroup: 'bond',
    geometry: BOND_GEOMETRY,
    appearance: { color: '#cbd5e1', roughness: 0.4 },
    // Centrado entre las superficies de los átomos y orientado del hidrógeno al oxígeno.
    targetTransform: { position: alongBond(side, 0.9), rotation: [0, 0, side * HALF_ANGLE], scale: 1 },
    dropZone: { type: 'sphere', radius: 0.2 },
    snapThreshold: 0.2,
    requires: ['hydrogen-a', 'hydrogen-b'],
    info: {
      title: 'Enlace covalente',
      summary:
        'Dos átomos comparten un par de electrones. Cada hidrógeno comparte un par con el oxígeno: el agua tiene dos enlaces covalentes.',
      facts: [
        { label: 'Tipo', value: 'Covalente polar' },
        { label: 'Electrones compartidos', value: '2 (un par)' },
        { label: 'Longitud real', value: '≈ 96 pm' },
      ],
    },
    hints: ['Un enlace siempre va entre dos átomos.', 'Cada enlace une el oxígeno con uno de los hidrógenos.'],
    feedback: {
      zoneDescription: 'Ese espacio está entre el centro y un extremo de la molécula.',
      requires: 'Un enlace une dos átomos: primero coloca el oxígeno y los dos hidrógenos.',
      wrongZone: { oxygen: ATOM_SLOT_FOR_BOND, hydrogen: ATOM_SLOT_FOR_BOND },
    },
  };
}

function lonePair(id: string, side: 1 | -1): DecorationConfig {
  const tilt = 0.96; // ≈ 55° fuera del plano de la molécula (disposición casi tetraédrica)
  return {
    id,
    geometry: {
      type: 'group',
      parts: [{ geometry: { type: 'sphere', radius: 1, segments: 32 }, scale: [0.26, 0.44, 0.26] }],
    },
    transform: {
      position: [0, OXYGEN_Y + 0.62 * Math.cos(tilt), side * 0.62 * Math.sin(tilt)],
      rotation: [side * tilt, 0, 0],
      scale: 1,
    },
    material: 'halo',
    color: '#fde047',
    opacity: 0.95,
  };
}

const LINEAR_DECOY_FEEDBACK = {
  feedback: 'Ese lugar no forma parte de la molécula de agua.',
  feedbackFor: {
    hydrogen: LINEAR_EXPLANATION,
    oxygen: 'El oxígeno va en el centro de la molécula, no en un extremo.',
    bond: 'Ahí no hay ningún enlace: cada enlace une el oxígeno con un hidrógeno.',
  },
  description: 'Un extremo de la molécula, en línea recta con el oxígeno.',
};

export const waterMoleculePuzzleConfig: Puzzle3DConfig = {
  id: 'water-molecule',
  title: 'Molécula de agua',
  description:
    'Une un oxígeno y dos hidrógenos con enlaces covalentes y descubre por qué la molécula de agua tiene forma angular.',
  icon: '💧',
  subject: 'Química',
  accentColor: '#60a5fa',
  mode: 'challenge',
  difficulty: 'medium',
  // Sin siluetas (delatarían la forma): solo las posibles posiciones, incluidas las trampas.
  difficultyOverrides: { showGhosts: 'never', showDropGuides: 'always' },
  validation: { position: true, rotation: false, scale: false },
  interaction: {
    dragPlane: { type: 'fixed', normal: [0, 0, 1] }, // el plano de la molécula
    allowRotation: false,
    shuffleTray: true,
    normalizeTraySize: false, // el tamaño enseña: el oxígeno es mucho más grande que el hidrógeno
  },
  model: {
    category: 'molecule',
    anchor: [0, 0, 0],
    camera: { direction: [0.2, 0.25, 1], fov: 40, framing: 1.12, minZoom: 0.5, maxZoom: 2 },
    decoys: [
      {
        id: 'linear-right',
        position: [BOND_LENGTH, OXYGEN_Y, 0],
        dropZone: { type: 'sphere', radius: 0.3 },
        snapThreshold: 0.25,
        ...LINEAR_DECOY_FEEDBACK,
      },
      {
        id: 'linear-left',
        position: [-BOND_LENGTH, OXYGEN_Y, 0],
        dropZone: { type: 'sphere', radius: 0.3 },
        snapThreshold: 0.25,
        ...LINEAR_DECOY_FEEDBACK,
      },
    ],
  },
  intro: {
    kicker: 'Rompecabezas gigante',
    heading: 'Construye una molécula de agua',
    lines: [
      'El agua está formada por moléculas de H₂O.',
      'Cada una tiene un átomo de oxígeno y dos de hidrógeno.',
      'Coloca los átomos y únelos con sus enlaces.',
    ],
    startLabel: 'Comenzar',
  },
  pieces: [
    {
      id: 'oxygen',
      name: 'Oxígeno',
      geometry: { type: 'sphere', radius: 0.62, segments: 48 },
      appearance: {
        color: '#ef4444',
        surface: { type: 'noise', colors: ['#dc2626', '#f87171'], scale: 2, contrast: 0.7 },
        roughness: 0.32,
        metalness: 0.05,
      },
      targetTransform: { position: OXYGEN_POSITION, rotation: [0, 0, 0], scale: 1 },
      dropZone: { type: 'sphere', radius: 0.45 },
      snapThreshold: 0.25,
      info: {
        title: 'Oxígeno (O)',
        summary:
          'Es el átomo central de la molécula de agua. Tiene 6 electrones de valencia: comparte 2 con los hidrógenos y le quedan 2 pares libres.',
        facts: [
          { label: 'Símbolo', value: 'O' },
          { label: 'Número atómico', value: '8' },
          { label: 'Electrones de valencia', value: '6' },
          { label: 'Enlaces en el agua', value: '2' },
        ],
      },
      hints: ['Busca el átomo que puede formar dos enlaces.', 'Va en el centro de la molécula, entre los dos hidrógenos.'],
      feedback: {
        zoneDescription: 'Ese lugar es el centro de la molécula.',
        wrongZone: {
          hydrogen: 'Ese lugar es un extremo de la molécula. El oxígeno va en el centro porque forma dos enlaces.',
          bond: BOND_SLOT_FOR_ATOM,
        },
      },
    },
    hydrogen('hydrogen-a', 1),
    hydrogen('hydrogen-b', -1),
    bond('bond-a', 1),
    bond('bond-b', -1),
  ],
  completion: {
    icon: '💧',
    title: 'Molécula de agua completa',
    message:
      'Un oxígeno unido a dos hidrógenos por enlaces covalentes. Las nubes amarillas son los pares de electrones libres del oxígeno: empujan los enlaces y por eso la molécula forma un ángulo de 104,5°.',
    closing: '¡Excelente trabajo!',
    orbit: true,
    revealDecorations: [
      lonePair('lone-pair-front', 1),
      lonePair('lone-pair-back', -1),
      {
        id: 'bond-angle',
        // Arco de 104,5° entre los dos enlaces (empieza en el enlace izquierdo).
        geometry: { type: 'torus', radius: 0.78, tube: 0.022, arc: 2 * HALF_ANGLE },
        transform: { position: OXYGEN_POSITION, rotation: [0, 0, -(Math.PI / 2 + HALF_ANGLE)], scale: 1 },
        material: 'glow',
        color: '#fde047',
        opacity: 0.9,
      },
    ],
  },
  labels: {
    progress: '{placed} / {total} partes colocadas',
    trayHint: 'Arrastra cada parte a su lugar',
  },
};
