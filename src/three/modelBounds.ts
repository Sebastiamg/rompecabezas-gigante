import { Vector3, type BufferGeometry } from 'three';
import type { PuzzleRuntime } from '../engine/puzzleRuntime';
import { geometryKey, peekGeometry } from './geometryFactory';

/*
 * Radios exactos a partir de los vértices (no de la esfera envolvente de
 * three, que en piezas recortadas —media esfera, cuenco— se centra fuera
 * del origen y sobreestima el tamaño).
 */

const point = new Vector3();
const radiusCache = new WeakMap<BufferGeometry, number>();

/** Distancia máxima de un vértice al origen de la geometría (su pivote). */
function maxVertexDistance(geometry: BufferGeometry): number {
  const cached = radiusCache.get(geometry);
  if (cached !== undefined) return cached;
  const position = geometry.getAttribute('position');
  let maxSq = 0;
  for (let i = 0; i < position.count; i++) {
    maxSq = Math.max(maxSq, point.fromBufferAttribute(position, i).lengthSq());
  }
  const radius = Math.sqrt(maxSq);
  radiusCache.set(geometry, radius);
  return radius;
}

function pieceGeometry(runtime: PuzzleRuntime, pieceId: string): BufferGeometry | null {
  const piece = runtime.pieceById.get(pieceId);
  if (!piece) return null;
  const { geometry, appearance } = piece.config;
  return peekGeometry(geometryKey(geometry, appearance), geometry, appearance);
}

/** Radio de cada pieza (sin escalar) alrededor de su pivote: dimensiona la bandeja. */
export function pieceGeometryRadius(runtime: PuzzleRuntime, pieceId: string): number {
  const geometry = pieceGeometry(runtime, pieceId);
  return (geometry && maxVertexDistance(geometry)) || 1;
}

/** Radio (centrado en el ancla) que envuelve el modelo terminado y sus zonas trampa. */
export function computeModelRadius(runtime: PuzzleRuntime): number {
  if (runtime.config.model.boundingRadius) return runtime.config.model.boundingRadius;
  let radius = 0.25;
  for (const slot of runtime.slots) {
    if (slot.kind === 'decoy') {
      radius = Math.max(radius, slot.zone.center.distanceTo(runtime.anchor) + slot.zone.outer);
      continue;
    }
    const geometry = pieceGeometry(runtime, slot.id);
    if (!geometry) continue;
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      point
        .fromBufferAttribute(position, i)
        .multiplyScalar(slot.scale)
        .applyQuaternion(slot.quaternion)
        .add(slot.position);
      radius = Math.max(radius, point.distanceTo(runtime.anchor));
    }
  }
  return radius;
}
