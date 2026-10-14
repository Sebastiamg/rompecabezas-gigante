import { Quaternion, Vector3 } from 'three';
import type { DropContext, PuzzleState, RejectReason } from '../types/puzzle';
import type { PuzzleRuntime, ResolvedZone, RuntimeSlot } from './puzzleRuntime';

/**
 * Validación genérica de colocaciones. No sabe nada del contenido:
 * solo compara puntos, zonas, grupos, orientaciones y escalas.
 */

const tmpPoint = new Vector3();
const tmpQuat = new Quaternion();

/** Distancia firmada del punto a la zona: negativa dentro, positiva fuera. */
export function zoneSignedDistance(zone: ResolvedZone, point: Vector3): number {
  const d = point.distanceTo(zone.center);
  if (zone.type === 'shell') return Math.max(zone.inner - d, d - zone.outer);
  return d - zone.outer;
}

/** Un punto cualquiera dentro de la zona (para colocar sin puntero, p. ej. con teclado). */
export function zoneSamplePoint(zone: ResolvedZone, out = new Vector3()): Vector3 {
  if (zone.type === 'shell') return out.copy(zone.center).add(new Vector3(0, (zone.inner + zone.outer) / 2, 0));
  return out.copy(zone.center);
}

export interface ZoneHit {
  slot: RuntimeSlot;
  distance: number;
}

/**
 * Zona bajo un punto. Entre varias candidatas (dentro de su tolerancia)
 * gana la de mayor prioridad y, a igual prioridad, la de menor distancia
 * firmada: la más "profunda" si el punto está dentro de varias, o la más
 * cercana si está fuera de todas.
 */
export function findZoneAt(runtime: PuzzleRuntime, point: Vector3): ZoneHit | null {
  let best: ZoneHit | null = null;
  for (const slot of runtime.slots) {
    const distance = zoneSignedDistance(slot.zone, point);
    if (distance > slot.tolerance) continue;
    if (
      !best ||
      slot.priority > best.slot.priority ||
      (slot.priority === best.slot.priority && distance < best.distance)
    ) {
      best = { slot, distance };
    }
  }
  return best;
}

export type PlacementCheck =
  | { ok: true }
  | { ok: false; reason: RejectReason; missing: readonly string[] };

/**
 * ¿Es correcta la pieza en este slot? Comprueba (según `validation`):
 * pieza/grupo correcto, slot libre, piezas previas, orientación y escala.
 */
export function isCorrectPlacement(
  runtime: PuzzleRuntime,
  state: PuzzleState,
  pieceId: string,
  slot: RuntimeSlot,
  context: DropContext,
): PlacementCheck {
  const piece = runtime.pieceById.get(pieceId);
  if (!piece) return { ok: false, reason: 'wrong-zone', missing: [] };
  if (slot.kind === 'decoy') return { ok: false, reason: 'decoy', missing: [] };
  const { validation } = runtime;

  if (validation.position && slot.group !== piece.group) {
    return { ok: false, reason: 'wrong-zone', missing: [] };
  }
  const occupant = state.slots[slot.id];
  if (occupant && occupant !== pieceId) {
    return { ok: false, reason: slot.group === piece.group ? 'occupied' : 'wrong-zone', missing: [] };
  }
  const missing = piece.requires.filter((id) => state.pieces[id]?.status !== 'placed');
  if (missing.length > 0) return { ok: false, reason: 'requires', missing };

  if (validation.rotation) {
    tmpQuat.set(context.quaternion[0], context.quaternion[1], context.quaternion[2], context.quaternion[3]);
    if (tmpQuat.angleTo(slot.quaternion) > validation.rotationTolerance) {
      return { ok: false, reason: 'rotation', missing: [] };
    }
  }
  if (validation.scale && context.scale !== undefined) {
    if (Math.abs(context.scale - 1) > validation.scaleTolerance) {
      return { ok: false, reason: 'scale', missing: [] };
    }
  }
  return { ok: true };
}

export type DropOutcome =
  | { kind: 'placed'; slotId: string }
  | { kind: 'rejected'; reason: RejectReason; zoneSlotId: string | null; missing: readonly string[] }
  /** Soltada lejos de cualquier zona: vuelve a la bandeja sin contar como error. */
  | { kind: 'missed' };

export function evaluateDrop(
  runtime: PuzzleRuntime,
  state: PuzzleState,
  pieceId: string,
  context: DropContext,
): DropOutcome {
  const piece = runtime.pieceById.get(pieceId);
  if (!piece || !context.point) return { kind: 'missed' };

  tmpPoint.set(context.point[0], context.point[1], context.point[2]);
  let hit = findZoneAt(runtime, tmpPoint);
  if (!hit) return { kind: 'missed' };

  if (!runtime.validation.position && hit.slot.kind !== 'decoy') {
    // Sin validación de posición basta con soltar sobre el modelo:
    // la pieza ocupa el primer lugar libre de su grupo.
    const free = runtime.slots.find((slot) => {
      const occupant = state.slots[slot.id];
      return slot.group === piece.group && (!occupant || occupant === pieceId);
    });
    if (!free) return { kind: 'rejected', reason: 'occupied', zoneSlotId: hit.slot.id, missing: [] };
    hit = { slot: free, distance: 0 };
  }

  const check = isCorrectPlacement(runtime, state, pieceId, hit.slot, context);
  return check.ok
    ? { kind: 'placed', slotId: hit.slot.id }
    : { kind: 'rejected', reason: check.reason, zoneSlotId: hit.slot.id, missing: check.missing };
}
