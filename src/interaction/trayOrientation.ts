import { Matrix4, Quaternion, Vector3 } from 'three';
import type { PuzzleRuntime } from '../engine/puzzleRuntime';
import { toQuaternion, toVector3 } from '../engine/puzzleUtils';

const UP = new Vector3(0, 1, 0);
const cache = new WeakMap<PuzzleRuntime, Map<string, Quaternion>>();

/** Orientación de la cámara inicial (mirando al centro del modelo). */
export function initialCameraQuaternion(runtime: PuzzleRuntime): Quaternion {
  const direction = toVector3(runtime.config.model.camera.direction).normalize();
  const eye = runtime.anchor.clone().add(direction);
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, runtime.anchor, UP));
}

/**
 * Orientación de reposo de cada pieza en la bandeja, relativa a la cámara.
 * Por defecto la pieza se ve exactamente como se vería ya colocada desde
 * la vista inicial (así el estudiante reconoce su forma); la bandeja va
 * "pegada" a la cámara, de modo que orbitar no la desordena.
 */
export function trayBaseQuaternion(runtime: PuzzleRuntime, pieceId: string): Quaternion {
  let map = cache.get(runtime);
  if (!map) {
    map = new Map();
    const inverseCamera = initialCameraQuaternion(runtime).invert();
    for (const piece of runtime.pieces) {
      const rotation = piece.config.initialTransform?.rotation ?? piece.config.targetTransform.rotation;
      map.set(piece.id, inverseCamera.clone().multiply(toQuaternion(rotation)));
    }
    cache.set(runtime, map);
  }
  return map.get(pieceId) ?? new Quaternion();
}
