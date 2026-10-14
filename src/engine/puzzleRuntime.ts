import { Quaternion, Vector3 } from 'three';
import type {
  DecoyZoneConfig,
  DifficultyProfile,
  DragPlaneConfig,
  DropZoneConfig,
  Puzzle3DConfig,
  PuzzleLabels,
  PuzzlePieceConfig,
  ValidationConfig,
} from '../types/puzzle';
import { resolveDifficulty } from './difficulty';
import { resolveLabels } from './labels';
import { toQuaternion, toVector3 } from './puzzleUtils';

/**
 * El "runtime" es la configuración ya resuelta: valores por defecto
 * aplicados, slots y zonas calculados en coordenadas del mundo.
 * Se construye una sola vez por rompecabezas y es inmutable.
 */

export interface ResolvedZone {
  type: 'sphere' | 'shell';
  center: Vector3;
  /** Radio interior (0 en zonas esféricas). */
  inner: number;
  /** Radio de la esfera o radio exterior de la cáscara. */
  outer: number;
}

/**
 * Un lugar del modelo. 'piece' = donde encaja una pieza (o cualquiera de su
 * grupo); 'decoy' = zona trampa que no pertenece a ninguna pieza.
 */
export interface RuntimeSlot {
  /** Id de la pieza que define ese lugar (o de la zona trampa). */
  id: string;
  kind: 'piece' | 'decoy';
  group: string;
  /** Mayor prioridad gana cuando un punto cae en varias zonas. */
  priority: number;
  decoy?: DecoyZoneConfig;
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  zone: ResolvedZone;
  /** snapThreshold de la pieza × multiplicador de dificultad. */
  tolerance: number;
}

export interface RuntimePiece {
  id: string;
  config: PuzzlePieceConfig;
  group: string;
  draggable: boolean;
  lockOnPlace: boolean;
  requires: readonly string[];
  hints: readonly string[];
}

export interface ResolvedInteraction {
  dragPlane: DragPlaneConfig;
  allowRotation: boolean;
  rotationStep: number;
  rotationAxis: 'view-y' | 'view-z';
  inspectSpin: boolean;
  shuffleTray: boolean;
  normalizeTraySize: boolean;
}

export interface PuzzleRuntime {
  config: Puzzle3DConfig;
  profile: DifficultyProfile;
  labels: PuzzleLabels;
  interaction: ResolvedInteraction;
  validation: Required<ValidationConfig>;
  anchor: Vector3;
  pieces: readonly RuntimePiece[];
  pieceById: ReadonlyMap<string, RuntimePiece>;
  slots: readonly RuntimeSlot[];
  slotById: ReadonlyMap<string, RuntimeSlot>;
  /** Piezas que el estudiante debe colocar (las fijas no cuentan). */
  draggableIds: readonly string[];
  /** Problemas detectados en la configuración (se muestran en consola en desarrollo). */
  warnings: readonly string[];
}

export function buildRuntime(config: Puzzle3DConfig): PuzzleRuntime {
  const profile = resolveDifficulty(config);
  const anchor = toVector3(config.model.anchor ?? [0, 0, 0]);
  const validation: Required<ValidationConfig> = {
    rotationTolerance: 0.35,
    scaleTolerance: 0.12,
    ...config.validation,
  };
  const interaction: ResolvedInteraction = {
    dragPlane: config.interaction?.dragPlane ?? { type: 'camera-facing' },
    allowRotation: config.interaction?.allowRotation ?? false,
    rotationStep: config.interaction?.rotationStep ?? Math.PI / 4,
    rotationAxis: config.interaction?.rotationAxis ?? 'view-y',
    // Si la orientación cuenta para validar, la pieza no debe girar sola.
    inspectSpin: (config.interaction?.inspectSpin ?? true) && !validation.rotation,
    shuffleTray: config.interaction?.shuffleTray ?? true,
    normalizeTraySize: config.interaction?.normalizeTraySize ?? true,
  };

  const pieces: RuntimePiece[] = config.pieces.map((piece) => ({
    id: piece.id,
    config: piece,
    group: piece.matchGroup ?? piece.id,
    draggable: piece.draggable ?? true,
    lockOnPlace: piece.lockOnPlace ?? true,
    requires: piece.requires ?? [],
    hints: piece.hints ?? [],
  }));

  const slots: RuntimeSlot[] = pieces.map((piece) => {
    const { targetTransform, dropZone } = piece.config;
    const position = toVector3(targetTransform.position).add(anchor);
    return {
      id: piece.id,
      kind: 'piece',
      group: piece.group,
      priority: dropZone?.priority ?? 0,
      position,
      quaternion: toQuaternion(targetTransform.rotation),
      scale: targetTransform.scale,
      zone: resolveZone(position, dropZone),
      tolerance: piece.config.snapThreshold * profile.snapThresholdMultiplier,
    };
  });
  for (const decoy of config.model.decoys ?? []) {
    const position = toVector3(decoy.position).add(anchor);
    slots.push({
      id: decoy.id,
      kind: 'decoy',
      group: 'decoy:' + decoy.id,
      priority: decoy.dropZone?.priority ?? 0,
      decoy,
      position,
      quaternion: new Quaternion(),
      scale: 1,
      zone: resolveZone(position, decoy.dropZone),
      tolerance: decoy.snapThreshold * profile.snapThresholdMultiplier,
    });
  }

  return {
    config,
    profile,
    labels: resolveLabels(config.labels),
    interaction,
    validation,
    anchor,
    pieces,
    pieceById: new Map(pieces.map((p) => [p.id, p])),
    slots,
    slotById: new Map(slots.map((s) => [s.id, s])),
    draggableIds: pieces.filter((p) => p.draggable).map((p) => p.id),
    warnings: findConfigProblems(config),
  };
}

function resolveZone(position: Vector3, dropZone: DropZoneConfig | undefined): ResolvedZone {
  const center = position.clone();
  if (dropZone?.offset) center.add(toVector3(dropZone.offset));
  return dropZone?.type === 'shell'
    ? { type: 'shell', center, inner: dropZone.innerRadius, outer: dropZone.outerRadius }
    : { type: 'sphere', center, inner: 0, outer: dropZone?.radius ?? 0 };
}

function findConfigProblems(config: Puzzle3DConfig): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const piece of config.pieces) {
    if (ids.has(piece.id)) problems.push(`Id de pieza duplicado: "${piece.id}".`);
    ids.add(piece.id);
  }
  for (const piece of config.pieces) {
    for (const required of piece.requires ?? []) {
      if (!ids.has(required)) problems.push(`"${piece.id}" requiere una pieza inexistente: "${required}".`);
    }
    for (const other of Object.keys(piece.feedback?.wrongZone ?? {})) {
      const known =
        ids.has(other) ||
        config.pieces.some((p) => p.matchGroup === other) ||
        (config.model.decoys ?? []).some((d) => d.id === other);
      if (!known) problems.push(`"${piece.id}" tiene feedback para una zona inexistente: "${other}".`);
    }
    const zone = piece.dropZone;
    if (zone?.type === 'shell' && zone.innerRadius >= zone.outerRadius) {
      problems.push(`"${piece.id}": innerRadius debe ser menor que outerRadius en su zona.`);
    }
    if (piece.snapThreshold < 0) problems.push(`"${piece.id}": snapThreshold no puede ser negativo.`);
  }
  const groups = new Set(config.pieces.map((p) => p.matchGroup ?? p.id));
  for (const decoy of config.model.decoys ?? []) {
    if (ids.has(decoy.id)) problems.push(`La zona trampa "${decoy.id}" usa el id de una pieza.`);
    for (const key of Object.keys(decoy.feedbackFor ?? {})) {
      if (!ids.has(key) && !groups.has(key)) {
        problems.push(`La zona trampa "${decoy.id}" menciona una pieza o grupo inexistente: "${key}".`);
      }
    }
  }
  if (!config.pieces.some((p) => p.draggable ?? true)) {
    problems.push('El rompecabezas no tiene piezas que el estudiante pueda mover.');
  }
  return problems;
}
