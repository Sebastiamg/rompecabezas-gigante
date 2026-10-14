import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toQuaternion, toVector3 } from '../engine/puzzleUtils';
import type { GeometryConfig, GeometryPart, PieceAppearance } from '../types/puzzle';
import { buildSphereShellGeometry, type ShellColors } from './sphereShell';
import { createSurfacePainter } from './surfacePaint';

/**
 * Fábrica de geometrías: convierte un `GeometryConfig` en una
 * BufferGeometry con colores por vértice. Registro tipado: añadir un tipo
 * nuevo a la unión `GeometryConfig` obliga (en compilación) a añadir aquí
 * su constructor. Las geometrías se cachean y se comparten (ref-count).
 */

type Builder<T extends GeometryConfig> = (config: T, appearance: PieceAppearance) => BufferGeometry;
type BuilderRegistry = { [K in GeometryConfig['type']]: Builder<Extract<GeometryConfig, { type: K }>> };

/** Pinta cada vértice según su dirección (y posición) respecto al centro de la geometría. */
function paintByDirection(geometry: BufferGeometry, appearance: PieceAppearance): BufferGeometry {
  const painter = createSurfacePainter(appearance.surface, appearance.color);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const point = new Vector3();
  const direction = new Vector3();
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    direction.copy(point);
    if (direction.lengthSq() > 0) direction.normalize();
    painter(direction, point, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function shellColors(appearance: PieceAppearance): ShellColors {
  const section = appearance.sectionColor;
  const [from, to] = typeof section === 'string' ? [section, section] : (section ?? [appearance.color, appearance.color]);
  const sectionInner = new Color(from);
  const sectionOuter = new Color(to);
  return {
    outer: createSurfacePainter(appearance.surface, appearance.color),
    inner: new Color(appearance.innerColor ?? from),
    section: (t, out) => out.copy(sectionInner).lerp(sectionOuter, t),
  };
}

const builders: BuilderRegistry = {
  sphere: (config, appearance) => {
    const segments = config.segments ?? 48;
    return paintByDirection(new SphereGeometry(config.radius, segments, Math.max(8, Math.round(segments / 2))), appearance);
  },
  'sphere-shell': (config, appearance) => buildSphereShellGeometry(config, shellColors(appearance)),
  box: (config, appearance) =>
    paintByDirection(new BoxGeometry(config.size[0], config.size[1], config.size[2]), appearance),
  cylinder: (config, appearance) =>
    paintByDirection(
      new CylinderGeometry(config.radiusTop, config.radiusBottom, config.height, config.segments ?? 40),
      appearance,
    ),
  torus: (config, appearance) => {
    const arc = Math.min(Math.max(config.arc ?? Math.PI * 2, 0.01), Math.PI * 2);
    const segments = config.segments ?? Math.max(16, Math.round((96 * arc) / (Math.PI * 2)));
    return paintByDirection(new TorusGeometry(config.radius, config.tube, 12, segments, arc), appearance);
  },
  capsule: (config, appearance) => {
    const radial = config.segments ?? 24;
    // Anillos suficientes en la parte recta para que los patrones (bandas) se vean.
    const rows = Math.max(2, Math.round(config.length / (config.radius * 0.25)));
    return paintByDirection(
      new CapsuleGeometry(config.radius, config.length, Math.max(4, Math.round(radial / 4)), radial, rows),
      appearance,
    );
  },
  group: (config, appearance) => buildGroup(config.parts, appearance),
  'extruded-shape': (config, appearance) => {
    const shape = new Shape(config.points.map(([x, y]) => new Vector2(x, y)));
    const bevel = config.bevel ?? 0;
    const geometry = new ExtrudeGeometry(shape, {
      depth: config.depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
    });
    if (config.orientation !== 'upright') geometry.rotateX(-Math.PI / 2);
    geometry.center(); // el pivote queda en el centro: targetTransform.position = dónde va ese centro
    return paintByDirection(geometry, appearance);
  },
};

const MERGEABLE_ATTRIBUTES = new Set(['position', 'normal', 'color']);

/**
 * Fusiona varias partes (cada una con su transformación y colores) en una
 * sola geometría. Una parte con `appearance` propia no hereda los patrones
 * de la pieza, solo su color si no define uno.
 */
function buildGroup(parts: readonly GeometryPart[], appearance: PieceAppearance): BufferGeometry {
  const built = parts.map((part) => {
    const partAppearance: PieceAppearance = part.appearance
      ? { ...part.appearance, color: part.appearance.color ?? appearance.color }
      : appearance;
    const geometry = buildGeometry(part.geometry, partAppearance);
    const s = part.scale ?? 1;
    const scale = typeof s === 'number' ? new Vector3(s, s, s) : toVector3(s);
    geometry.applyMatrix4(
      new Matrix4().compose(toVector3(part.position ?? [0, 0, 0]), toQuaternion(part.rotation ?? [0, 0, 0]), scale),
    );
    for (const name of Object.keys(geometry.attributes)) {
      if (!MERGEABLE_ATTRIBUTES.has(name)) geometry.deleteAttribute(name);
    }
    return geometry;
  });
  const allIndexed = built.every((geometry) => geometry.index !== null);
  const uniform = allIndexed ? built : built.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
  const merged = mergeGeometries(uniform, false);
  for (const geometry of new Set([...built, ...uniform])) geometry.dispose();
  if (!merged) throw new Error('No se pudo combinar la geometría compuesta (partes incompatibles).');
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

export function buildGeometry(config: GeometryConfig, appearance: PieceAppearance): BufferGeometry {
  const builder = builders[config.type] as Builder<GeometryConfig>;
  return builder(config, appearance);
}

// ─── Caché compartida con conteo de referencias ──────────────────────

interface CacheEntry {
  geometry: BufferGeometry;
  refs: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}

const cache = new Map<string, CacheEntry>();

export function geometryKey(config: GeometryConfig, appearance: PieceAppearance): string {
  return JSON.stringify([config, appearance.color, appearance.surface, appearance.sectionColor, appearance.innerColor]);
}

/** Devuelve la geometría cacheada (creándola si hace falta) sin retenerla. */
export function peekGeometry(key: string, config: GeometryConfig, appearance: PieceAppearance): BufferGeometry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { geometry: buildGeometry(config, appearance), refs: 0, disposeTimer: null };
    cache.set(key, entry);
  }
  return entry.geometry;
}

export function retainGeometry(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs++;
  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }
}

/**
 * Libera una referencia. La GPU se libera en diferido para que un
 * desmontaje/montaje inmediato (StrictMode, cambios de layout) no
 * provoque recrear la geometría.
 */
export function releaseGeometry(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs === 0 && !entry.disposeTimer) {
    entry.disposeTimer = setTimeout(() => {
      if (entry.refs === 0) {
        entry.geometry.dispose();
        cache.delete(key);
      }
      entry.disposeTimer = null;
    }, 1000);
  }
}
