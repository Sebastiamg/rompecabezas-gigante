/**
 * Tipos del dominio del motor de rompecabezas 3D.
 *
 * Regla de oro: el motor solo conoce estos tipos. Todo el conocimiento
 * (qué es un "manto", de qué color es, qué se aprende de él) vive en /data.
 * Para el motor solo existen "pieza A", "pieza B", "pieza C"...
 */

// ─── Primitivas ──────────────────────────────────────────────────────

/** Vector 3D como tupla: serializable y cómodo de escribir en configuración. */
export type Vec3 = readonly [number, number, number];
/** Rotación Euler en radianes (orden XYZ). */
export type Euler3 = readonly [number, number, number];
/** Cuaternión [x, y, z, w]. */
export type Quat4 = readonly [number, number, number, number];

export interface Transform3D {
  position: Vec3;
  rotation: Euler3;
  /** Escala uniforme. */
  scale: number;
}

// ─── Geometrías ──────────────────────────────────────────────────────
// Unión discriminada por `type`. Añadir una geometría nueva =
// añadir su interfaz aquí + su constructor en three/geometryFactory.ts.

/**
 * Región eliminada de una esfera para dejar ver su interior
 * (convención de ángulos de THREE.SphereGeometry: theta 0 = polo norte).
 */
export interface SphericalCut {
  phiStart: number;
  phiLength: number;
  thetaStart: number;
  thetaLength: number;
}

export interface SphereGeometryConfig {
  type: 'sphere';
  radius: number;
  segments?: number;
}

/** Cáscara esférica (innerRadius 0 = esfera maciza), con recorte opcional. */
export interface SphereShellGeometryConfig {
  type: 'sphere-shell';
  innerRadius: number;
  outerRadius: number;
  cut?: SphericalCut;
  /** Segmentos en la vuelta completa (por defecto 48). */
  segments?: number;
}

export interface BoxGeometryConfig {
  type: 'box';
  size: Vec3;
}

export interface CylinderGeometryConfig {
  type: 'cylinder';
  radiusTop: number;
  radiusBottom: number;
  height: number;
  segments?: number;
}

export interface TorusGeometryConfig {
  type: 'torus';
  radius: number;
  tube: number;
  segments?: number;
  /** Ángulo del arco en radianes (por defecto la vuelta completa). Empieza en +X, sentido antihorario. */
  arc?: number;
}

/** Cápsula a lo largo del eje Y (bacterias, mitocondrias, píldoras...). */
export interface CapsuleGeometryConfig {
  type: 'capsule';
  radius: number;
  /** Largo de la parte cilíndrica (sin contar las semiesferas). */
  length: number;
  segments?: number;
}

/** Una parte de una geometría compuesta. */
export interface GeometryPart {
  geometry: GeometryConfig;
  position?: Vec3;
  rotation?: Euler3;
  /** Escala uniforme o por eje: permite aplanar o estirar (elipsoides, discos, sacos...). */
  scale?: number | Vec3;
  /** Colores propios de esta parte; si se omite hereda los de la pieza. */
  appearance?: Partial<PieceAppearance>;
}

/**
 * Geometría compuesta por varias partes que se fusionan en UNA sola
 * geometría (un draw call). Sirve para piezas complejas: aparato de Golgi,
 * núcleo con nucléolo, enlaces bicolor, grupos de ribosomas...
 */
export interface GroupGeometryConfig {
  type: 'group';
  parts: readonly GeometryPart[];
}

/** Contorno 2D extruido (p. ej. una provincia de un mapa). Se centra automáticamente. */
export interface ExtrudedShapeGeometryConfig {
  type: 'extruded-shape';
  points: readonly (readonly [number, number])[];
  depth: number;
  bevel?: number;
  /** 'flat' = acostada sobre el plano XZ (mapas); 'upright' = en el plano XY. */
  orientation?: 'flat' | 'upright';
}

export type GeometryConfig =
  | SphereGeometryConfig
  | SphereShellGeometryConfig
  | BoxGeometryConfig
  | CylinderGeometryConfig
  | TorusGeometryConfig
  | CapsuleGeometryConfig
  | ExtrudedShapeGeometryConfig
  | GroupGeometryConfig;

export type GeometryType = GeometryConfig['type'];

// ─── Apariencia ──────────────────────────────────────────────────────

export type SurfacePattern =
  | { type: 'solid' }
  /** Mezcla orgánica de dos colores (rocas, magma, citoplasma...). */
  | { type: 'noise'; colors: readonly [string, string]; scale?: number; contrast?: number; seed?: number }
  /** Bandas a lo largo de un eje (crestas de mitocondria, bandas de Júpiter...). */
  | { type: 'stripes'; colors: readonly [string, string]; axis?: 'x' | 'y' | 'z'; frequency?: number }
  /** Océanos + continentes + casquetes polares (planetas). */
  | {
      type: 'terrain';
      ocean: readonly [string, string];
      land: readonly [string, string];
      ice?: string;
      seaLevel?: number;
      scale?: number;
      seed?: number;
    };

export interface PieceAppearance {
  /** Color principal. También se usa como acento de la pieza en la interfaz. */
  color: string;
  /** Patrón de la superficie exterior (por defecto: color sólido). */
  surface?: SurfacePattern;
  /** Color de las caras de corte. Un par = degradado de interior a exterior. */
  sectionColor?: string | readonly [string, string];
  /** Color de la cara interior de las piezas huecas. */
  innerColor?: string;
  roughness?: number;
  metalness?: number;
}

// ─── Zonas de colocación ─────────────────────────────────────────────

/**
 * Región del espacio (relativa a la posición objetivo de la pieza) donde
 * soltarla cuenta como "intentar colocarla aquí".
 * - sphere: alrededor de un punto (mapas, moléculas...).
 * - shell:  banda radial entre dos radios (capas concéntricas, órbitas...).
 * Si se omite: esfera de radio 0 → basta con `distancia < snapThreshold`.
 */
export type DropZoneConfig =
  | { type: 'sphere'; radius: number; offset?: Vec3; priority?: number }
  | { type: 'shell'; innerRadius: number; outerRadius: number; offset?: Vec3; priority?: number };
// `priority`: si el punto cae dentro de varias zonas gana la de mayor prioridad.
// Una prioridad negativa crea una zona "de fondo" (p. ej. el citoplasma: todo el
// interior de la célula que no sea un orgánulo).

// ─── Piezas ──────────────────────────────────────────────────────────

export interface PieceFact {
  label: string;
  value: string;
}

export interface PieceInfo {
  title: string;
  summary: string;
  facts?: readonly PieceFact[];
}

/** Retroalimentación educativa: los errores también enseñan. */
export interface PieceFeedback {
  /** Mensaje al soltar ESTA pieza en la zona de otra (clave = id de esa otra pieza). */
  wrongZone?: Readonly<Record<string, string>>;
  // `wrongZone` acepta como clave el id de la pieza dueña de la zona o su matchGroup.
  /** Mensaje si no hay uno específico en `wrongZone`. */
  wrongZoneDefault?: string;
  /** Describe la zona de ESTA pieza cuando otra cae en ella (sin revelar su nombre). */
  zoneDescription?: string;
  /** Mensaje si faltan piezas previas (`requires`). */
  requires?: string;
  /** Mensaje si la orientación no coincide. */
  rotation?: string;
  /** Título al colocarla (por defecto: "{name} en su lugar"). */
  placed?: string;
}

export interface PuzzlePieceConfig {
  id: string;
  name: string;
  /** Nombre corto para la bandeja cuando el nombre completo no cabe. */
  shortName?: string;
  geometry: GeometryConfig;
  appearance: PieceAppearance;
  /** Dónde y cómo queda la pieza cuando está bien colocada (espacio del modelo). */
  targetTransform: Transform3D;
  /**
   * Cómo aparece la pieza en la bandeja. La posición la calcula el layout
   * responsive; aquí solo orientación (vista desde la cámara inicial) y un
   * multiplicador de tamaño.
   */
  initialTransform?: { rotation?: Euler3; scale?: number };
  dropZone?: DropZoneConfig;
  /** Tolerancia (unidades del mundo) alrededor de la zona para que haya snap. */
  snapThreshold: number;
  info?: PieceInfo;
  /** Pistas progresivas: cada pulsación de "Pista" revela la siguiente. */
  hints?: readonly string[];
  feedback?: PieceFeedback;
  /** false = pieza fija que ya viene colocada (contexto del modelo). */
  draggable?: boolean;
  /** false = una pieza colocada puede volver a sacarse. Por defecto true. */
  lockOnPlace?: boolean;
  /** Ids de piezas que deben estar colocadas antes que esta. */
  requires?: readonly string[];
  /** Piezas con el mismo grupo son intercambiables (p. ej. los dos H del H₂O). */
  matchGroup?: string;
}

// ─── Reglas ──────────────────────────────────────────────────────────

export interface ValidationConfig {
  position: boolean;
  rotation: boolean;
  scale: boolean;
  /** Tolerancia angular en radianes (si rotation = true). */
  rotationTolerance?: number;
  /** Tolerancia relativa, 0.1 = ±10 % (si scale = true). */
  scaleTolerance?: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GhostVisibility = 'always' | 'while-dragging' | 'never';
export type GuideVisibility = 'always' | 'while-dragging' | 'never';

export interface DifficultyProfile {
  /** Multiplica el snapThreshold de cada pieza. */
  snapThresholdMultiplier: number;
  maxHintsPerPiece: number;
  /** Tras agotar las pistas de texto, la siguiente ilumina la zona correcta. */
  revealZoneAfterHints: boolean;
  /** Silueta translúcida del modelo por construir. */
  showGhosts: GhostVisibility;
  /** Anillos/discos que dibujan las zonas de colocación. */
  showDropGuides: GuideVisibility;
  highlightHoveredZone: boolean;
  showInfoOnPlace: boolean;
}

/** Solo 'challenge' está implementado. 'explore' (modo libre) se añadirá aquí. */
export type PuzzleMode = 'challenge';

export type DragPlaneConfig = { type: 'camera-facing' } | { type: 'fixed'; normal: Vec3 };

export interface InteractionConfig {
  /** Plano sobre el que se proyecta el puntero al soltar. */
  dragPlane?: DragPlaneConfig;
  allowRotation?: boolean;
  /** Paso de giro en radianes. */
  rotationStep?: number;
  /** view-y = giro tipo tocadiscos; view-z = giro en el plano de la pantalla (mapas). */
  rotationAxis?: 'view-y' | 'view-z';
  /** La pieza seleccionada gira despacio en la bandeja para inspeccionarla. */
  inspectSpin?: boolean;
  /** Mezcla el orden de la bandeja para que la posición no delate la respuesta. */
  shuffleTray?: boolean;
  /** true = todas las piezas del mismo tamaño en la bandeja (oculta pistas de tamaño). */
  normalizeTraySize?: boolean;
}

// ─── Modelo ──────────────────────────────────────────────────────────

export interface CameraConfig {
  /** Dirección desde el centro del modelo hacia la cámara inicial (no hace falta normalizar). */
  direction: Vec3;
  fov?: number;
  /** Margen al encuadrar el modelo (1 = justo, 1.2 = 20 % de aire). */
  framing?: number;
  /** Fracción de la distancia de encuadre a la que se puede acercar (0.55). */
  minZoom?: number;
  /** Fracción de la distancia de encuadre a la que se puede alejar (2). */
  maxZoom?: number;
}

export type DecorationMaterial = 'standard' | 'glow' | 'halo';

/** Elemento visual estático del modelo que no es una pieza (base, halo, órbita...). */
export interface DecorationConfig {
  id: string;
  geometry: GeometryConfig;
  transform: Transform3D;
  material?: DecorationMaterial;
  color?: string;
  opacity?: number;
}

/**
 * Zona trampa: un lugar plausible pero incorrecto que no pertenece a
 * ninguna pieza. Soltar ahí cuenta como error y muestra una explicación
 * (p. ej. "si los hidrógenos estuvieran en línea recta…").
 */
export interface DecoyZoneConfig {
  id: string;
  position: Vec3;
  dropZone?: DropZoneConfig;
  snapThreshold: number;
  /** Explicación al soltar cualquier pieza aquí. */
  feedback: string;
  /** Explicación específica por id de pieza o por matchGroup. */
  feedbackFor?: Readonly<Record<string, string>>;
  /** Descripción neutra del lugar (se anuncia al apuntar con teclado). */
  description?: string;
}

export interface ModelConfig {
  /** Categoría descriptiva. Solo metadatos: el motor NUNCA ramifica por ella. */
  category: string;
  /** Centro del modelo en el mundo (por defecto el origen). */
  anchor?: Vec3;
  /** Radio que envuelve el modelo terminado. Si se omite se calcula de las piezas. */
  boundingRadius?: number;
  camera: CameraConfig;
  ghost?: { color?: string; opacity?: number };
  decorations?: readonly DecorationConfig[];
  /** Zonas trampa que enseñan algo cuando el estudiante se equivoca. */
  decoys?: readonly DecoyZoneConfig[];
}

// ─── Textos ──────────────────────────────────────────────────────────

export interface IntroConfig {
  kicker?: string;
  heading: string;
  lines: readonly string[];
  startLabel?: string;
}

export interface CompletionConfig {
  icon?: string;
  title: string;
  message: string;
  closing?: string;
  /** Decoraciones que aparecen al completar (atmósfera, brillo...). */
  revealDecorations?: readonly DecorationConfig[];
  /** La cámara orbita lentamente alrededor del modelo terminado. */
  orbit?: boolean;
}

/** Textos de interfaz. Plantillas con {placed}, {total}, {name}, {list}. */
export interface PuzzleLabels {
  appName: string;
  start: string;
  tips: readonly string[];
  trayTitle: string;
  trayHint: string;
  progress: string;
  placedTitle: string;
  placedBadge: string;
  incorrectTitle: string;
  wrongZoneFallback: string;
  tryAgain: string;
  occupied: string;
  requires: string;
  rotation: string;
  missed: string;
  hint: string;
  hintSelectPiece: string;
  hintExhausted: string;
  hintReveal: string;
  rotate: string;
  deselect: string;
  selectedHelp: string;
  aimHelp: string;
  aimAnnounce: string;
  keyboardHelp: string;
  dragging: string;
  resetCamera: string;
  restart: string;
  menu: string;
  exitToCatalog: string;
  restartConfirmTitle: string;
  restartConfirmBody: string;
  cancel: string;
  confirmRestart: string;
  completionKicker: string;
  completionSummary: string;
  completedBadge: string;
  explore: string;
  playAgain: string;
  statTime: string;
  statAttempts: string;
  statMistakes: string;
  statHints: string;
  close: string;
  showInfo: string;
}

// ─── Configuración completa de un rompecabezas ───────────────────────

export interface Puzzle3DConfig {
  id: string;
  title: string;
  description: string;
  icon?: string;
  subject?: string;
  /** Color de acento del catálogo. */
  accentColor?: string;
  mode?: PuzzleMode;
  difficulty: Difficulty;
  difficultyOverrides?: Partial<DifficultyProfile>;
  validation: ValidationConfig;
  interaction?: InteractionConfig;
  model: ModelConfig;
  pieces: readonly PuzzlePieceConfig[];
  intro: IntroConfig;
  completion: CompletionConfig;
  labels?: Partial<PuzzleLabels>;
}

// ─── Estado de juego ─────────────────────────────────────────────────

export type PuzzlePhase = 'intro' | 'playing' | 'completed';
export type PieceStatus = 'tray' | 'dragging' | 'placed';
export type RejectReason = 'wrong-zone' | 'decoy' | 'occupied' | 'requires' | 'rotation' | 'scale';

export interface PieceProgress {
  status: PieceStatus;
  /** Slot que ocupa (= id de la pieza dueña de ese lugar). */
  slotId: string | null;
  attempts: number;
  mistakes: number;
  hintLevel: number;
  placedAt: number | null;
}

/** Lo que el motor necesita saber de una pieza en el momento de soltarla. */
export interface DropContext {
  /** Punto de suelta sobre el plano de arrastre (null si el rayo no lo corta). */
  point: Vec3 | null;
  /** Orientación de la pieza en el mundo al soltarla. */
  quaternion: Quat4;
  /** Escala lógica (1 = la de diseño). */
  scale?: number;
}

export type PuzzleEvent =
  | { seq: number; type: 'placed'; pieceId: string; slotId: string; completes: boolean }
  | {
      seq: number;
      type: 'rejected';
      pieceId: string;
      reason: RejectReason;
      zoneSlotId: string | null;
      missing: readonly string[];
    }
  | { seq: number; type: 'missed'; pieceId: string }
  | { seq: number; type: 'hint'; pieceId: string; level: number }
  | { seq: number; type: 'reset' };

export interface ActiveHint {
  pieceId: string;
  level: number;
  text: string | null;
  revealZone: boolean;
  exhausted: boolean;
  seq: number;
}

export interface PuzzleState {
  phase: PuzzlePhase;
  pieces: Readonly<Record<string, PieceProgress>>;
  /** slotId → pieceId que lo ocupa (o null). */
  slots: Readonly<Record<string, string | null>>;
  trayOrder: readonly string[];
  selectedPieceId: string | null;
  draggingPieceId: string | null;
  attempts: number;
  mistakes: number;
  hintsUsed: number;
  activeHint: ActiveHint | null;
  startedAt: number | null;
  completedAt: number | null;
  lastEvent: PuzzleEvent | null;
  seq: number;
  session: number;
}

/** Métricas listas para evaluación educativa (o para enviarlas a un backend). */
export interface PuzzleMetrics {
  attempts: number;
  mistakes: number;
  hintsUsed: number;
  completedPieces: number;
  totalPieces: number;
  elapsedMs: number;
  perPiece: Readonly<Record<string, { attempts: number; mistakes: number; hintsUsed: number }>>;
}

export type PuzzleAnalyticsEvent =
  | { type: 'started'; puzzleId: string; at: number }
  | { type: 'piece-placed'; puzzleId: string; pieceId: string; at: number; metrics: PuzzleMetrics }
  | { type: 'mistake'; puzzleId: string; pieceId: string; reason: RejectReason; at: number }
  | { type: 'hint'; puzzleId: string; pieceId: string; level: number; at: number }
  | { type: 'completed'; puzzleId: string; at: number; metrics: PuzzleMetrics }
  | { type: 'reset'; puzzleId: string; at: number };
