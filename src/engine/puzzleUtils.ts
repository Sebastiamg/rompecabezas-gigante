import { Euler, Quaternion, Vector3 } from 'three';
import type { Euler3, Quat4, Vec3 } from '../types/puzzle';

// Conversión entre tuplas de configuración (serializables) y clases de three.

export function toVector3(v: Vec3, out = new Vector3()): Vector3 {
  return out.set(v[0], v[1], v[2]);
}

export function toQuaternion(rotation: Euler3, out = new Quaternion()): Quaternion {
  return out.setFromEuler(new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
}

export function quatToTuple(q: Quaternion): Quat4 {
  return [q.x, q.y, q.z, q.w];
}

export function vecToTuple(v: Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mezcla Fisher–Yates con semilla. Garantiza que el resultado no coincida
 * con el orden original (si hay más de un elemento), para que el orden de
 * la configuración nunca delate la respuesta.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  if (out.length < 2) return out;
  const random = createRandom(seed);
  for (let attempt = 0; attempt < 4; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    if (out.some((item, index) => item !== items[index])) return out;
  }
  // Muy improbable: rota una posición.
  out.push(out.shift() as T);
  return out;
}

/** 83 500 ms → "1:23". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
