import { Quaternion, Vector3 } from 'three';

/**
 * Estado de interacción de alta frecuencia (posición del puntero, pieza
 * arrastrada, zona bajo el dedo...). Es un objeto mutable compartido entre
 * la interfaz HTML y la escena 3D: se lee en useFrame y se escribe en los
 * listeners de puntero. NUNCA provoca renders de React.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointerLike {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
}

/** Hueco de la bandeja convertido a espacio de cámara. */
export interface TrayHome {
  /** Centro del hueco en espacio de cámara (z negativa = delante). */
  view: Vector3;
  /** Radio visual (unidades del mundo) que debe ocupar la pieza en ese hueco. */
  radius: number;
}

export interface DragState {
  pieceId: string | null;
  pointerId: number | null;
  pointerType: string;
  /** Hay un dedo/botón sobre la pieza (todavía puede ser un simple toque). */
  pressed: boolean;
  /** Superó el umbral de movimiento: la pieza sigue al puntero. */
  active: boolean;
  /** Posición de la pieza en espacio de cámara. */
  view: Vector3;
  /** Punto del plano de arrastre bajo la pieza (espacio del mundo). */
  world: Vector3;
  worldValid: boolean;
  /** Zona del modelo bajo la pieza (para resaltarla). */
  hoverSlotId: string | null;
}

export interface DragController {
  begin(pieceId: string, pointer: PointerLike): void;
  /** Alternativa sin puntero (teclado): intenta colocar la pieza en un lugar concreto. */
  placeAtSlot(pieceId: string, slotId: string): void;
}

export interface InteractionStore {
  drag: DragState;
  /** Pieza de la bandeja bajo el ratón (solo escritorio). */
  hoverTrayId: string | null;
  trayHomes: Map<string, TrayHome>;
  /** Profundidad (espacio de cámara) de la bandeja y de la pieza arrastrada. */
  trayDepth: number;
  /** Rectángulo de la bandeja en px relativos al canvas (soltar encima = devolver la pieza). */
  trayRect: Rect | null;
  /** Giro aplicado por el estudiante a cada pieza (espacio de cámara). */
  userRotation: Map<string, Quaternion>;
  /** Zonas iluminadas por una pista. */
  reveal: { slotIds: readonly string[]; until: number };
  /** Lugar apuntado con el teclado (null = sin apuntar). */
  aimSlotId: string | null;
  /** Inyectados por la escena 3D al montarse. */
  controller: DragController | null;
  requestFrame: () => void;
}

export function createInteractionStore(): InteractionStore {
  return {
    drag: {
      pieceId: null,
      pointerId: null,
      pointerType: 'mouse',
      pressed: false,
      active: false,
      view: new Vector3(),
      world: new Vector3(),
      worldValid: false,
      hoverSlotId: null,
    },
    hoverTrayId: null,
    trayHomes: new Map(),
    trayDepth: 2,
    trayRect: null,
    userRotation: new Map(),
    reveal: { slotIds: [], until: 0 },
    aimSlotId: null,
    controller: null,
    requestFrame: () => {},
  };
}

export function getUserRotation(store: InteractionStore, pieceId: string): Quaternion {
  let rotation = store.userRotation.get(pieceId);
  if (!rotation) {
    rotation = new Quaternion();
    store.userRotation.set(pieceId, rotation);
  }
  return rotation;
}

const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const step = new Quaternion();

/** Gira una pieza un paso alrededor de un eje de la vista. */
export function rotatePiece(
  store: InteractionStore,
  pieceId: string,
  angle: number,
  axis: 'view-y' | 'view-z',
): void {
  step.setFromAxisAngle(axis === 'view-y' ? AXIS_Y : AXIS_Z, angle);
  getUserRotation(store, pieceId).premultiply(step);
  store.requestFrame();
}

export function revealSlots(store: InteractionStore, slotIds: readonly string[], durationMs: number): void {
  store.reveal = { slotIds, until: performance.now() + durationMs };
  store.requestFrame();
}

export function resetInteraction(store: InteractionStore): void {
  store.userRotation.clear();
  store.reveal = { slotIds: [], until: 0 };
  store.aimSlotId = null;
  store.hoverTrayId = null;
  store.drag.hoverSlotId = null;
  store.requestFrame();
}
