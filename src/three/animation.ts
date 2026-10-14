import type { Quaternion, Vector3 } from 'three';

/**
 * Suavizado exponencial independiente de los FPS: con el mismo `lambda`
 * el movimiento se ve igual a 30, 60 o 120 Hz.
 */
export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

export function dampScalar(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * dampFactor(lambda, dt);
}

export function dampVector(current: Vector3, target: Vector3, lambda: number, dt: number): Vector3 {
  return current.lerp(target, dampFactor(lambda, dt));
}

export function dampQuaternion(current: Quaternion, target: Quaternion, lambda: number, dt: number): Quaternion {
  return current.slerp(target, dampFactor(lambda, dt));
}

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Sobrepasa ligeramente el final y vuelve: sensación de "encaje". */
export function easeOutBack(t: number, overshoot = 1.4): number {
  const c3 = overshoot + 1;
  return 1 + c3 * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** Destello que sube rápido y se apaga suave (t en segundos desde el inicio). */
export function flashCurve(t: number, duration: number): number {
  if (t < 0 || t > duration) return 0;
  const k = t / duration;
  return k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85) ** 2;
}
