import { Color, Vector3 } from 'three';
import type { SurfacePattern } from '../types/puzzle';

/**
 * Pintores de superficie: calculan el color de cada vértice a partir de
 * su dirección desde el centro (y su posición). Se usan para "texturizar"
 * piezas sin descargar imágenes (cero peticiones de red, cero memoria de texturas).
 */
export type SurfacePainter = (direction: Vector3, position: Vector3, out: Color) => Color;

function hash(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const x00 = lerp(hash(xi, yi, zi, seed), hash(xi + 1, yi, zi, seed), u);
  const x10 = lerp(hash(xi, yi + 1, zi, seed), hash(xi + 1, yi + 1, zi, seed), u);
  const x01 = lerp(hash(xi, yi, zi + 1, seed), hash(xi + 1, yi, zi + 1, seed), u);
  const x11 = lerp(hash(xi, yi + 1, zi + 1, seed), hash(xi + 1, yi + 1, zi + 1, seed), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

/** Ruido fractal en [0, 1] (media ≈ 0.5). */
export function fbm(p: Vector3, seed: number, octaves = 4): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(p.x * frequency, p.y * frequency, p.z * frequency, seed + i * 17);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function createSurfacePainter(pattern: SurfacePattern | undefined, baseColor: string): SurfacePainter {
  const p = new Vector3();
  if (!pattern || pattern.type === 'solid') {
    const color = new Color(baseColor);
    return (_direction, _position, out) => out.copy(color);
  }

  if (pattern.type === 'noise') {
    const a = new Color(pattern.colors[0]);
    const b = new Color(pattern.colors[1]);
    const scale = pattern.scale ?? 2.4;
    const contrast = pattern.contrast ?? 1.6;
    const seed = pattern.seed ?? 3;
    return (direction, _position, out) => {
      // Pocas octavas: el color vive en los vértices y más detalle produciría aliasing.
      const n = fbm(p.copy(direction).multiplyScalar(scale), seed, 2);
      return out.copy(a).lerp(b, clamp01(0.5 + (n - 0.5) * contrast * 2));
    };
  }

  if (pattern.type === 'stripes') {
    const a = new Color(pattern.colors[0]);
    const b = new Color(pattern.colors[1]);
    const axis = pattern.axis ?? 'y';
    const frequency = pattern.frequency ?? 30;
    return (_direction, position, out) => {
      const wave = 0.5 + 0.5 * Math.sin(position[axis] * frequency);
      return out.copy(a).lerp(b, wave * wave * (3 - 2 * wave));
    };
  }

  // terrain
  const deep = new Color(pattern.ocean[0]);
  const shallow = new Color(pattern.ocean[1]);
  const low = new Color(pattern.land[0]);
  const high = new Color(pattern.land[1]);
  const ice = pattern.ice ? new Color(pattern.ice) : null;
  const seaLevel = pattern.seaLevel ?? 0.53;
  const scale = pattern.scale ?? 1.8;
  const seed = pattern.seed ?? 7;
  return (direction, _position, out) => {
    const n = fbm(p.copy(direction).multiplyScalar(scale), seed, 4);
    if (ice && Math.abs(direction.y) > 0.93 - (n - 0.5) * 0.12) return out.copy(ice);
    if (n < seaLevel) {
      const t = clamp01((n - (seaLevel - 0.16)) / 0.16);
      return out.copy(deep).lerp(shallow, t * t);
    }
    return out.copy(low).lerp(high, clamp01((n - seaLevel) / 0.14));
  };
}
