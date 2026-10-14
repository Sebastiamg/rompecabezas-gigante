import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import type { SphereShellGeometryConfig } from '../types/puzzle';
import type { SurfacePainter } from './surfacePaint';

/**
 * Cáscara esférica (o esfera maciza si innerRadius = 0) con un recorte
 * opcional que deja ver su sección interior. Se genera como UNA sola
 * geometría con colores por vértice → un único draw call por pieza.
 *
 * Partes: superficie exterior, superficie interior (mirando hacia dentro)
 * y "tapas" planas/cónicas en los bordes del recorte (la sección).
 */

export interface ShellColors {
  outer: SurfacePainter;
  inner: Color;
  /** t = 0 en el radio interior, 1 en el exterior. */
  section: (t: number, out: Color) => Color;
}

interface MeshBuffers {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

type Sampler = (u: number, v: number, position: Vector3, normal: Vector3, color: Color) => void;

const TWO_PI = Math.PI * 2;
const EPS = 1e-6;

/** Misma convención de ángulos que THREE.SphereGeometry. */
function sphereDirection(theta: number, phi: number, out: Vector3): Vector3 {
  const s = Math.sin(theta);
  return out.set(-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s);
}

const e1 = new Vector3();
const e2 = new Vector3();
const faceNormal = new Vector3();
const vertexNormalSum = new Vector3();

/** Añade una malla (uSteps × vSteps) orientando cada triángulo según las normales deseadas. */
function addGrid(buffers: MeshBuffers, uSteps: number, vSteps: number, sample: Sampler): void {
  const points: Vector3[] = [];
  const normals: Vector3[] = [];
  const base = buffers.positions.length / 3;
  const color = new Color();
  for (let j = 0; j <= vSteps; j++) {
    for (let i = 0; i <= uSteps; i++) {
      const position = new Vector3();
      const normal = new Vector3();
      sample(i / uSteps, j / vSteps, position, normal, color);
      points.push(position);
      normals.push(normal);
      buffers.positions.push(position.x, position.y, position.z);
      buffers.normals.push(normal.x, normal.y, normal.z);
      buffers.colors.push(color.r, color.g, color.b);
    }
  }
  const row = uSteps + 1;
  const pushTriangle = (a: number, b: number, c: number) => {
    const pa = points[a]!;
    const pb = points[b]!;
    const pc = points[c]!;
    faceNormal.crossVectors(e1.subVectors(pb, pa), e2.subVectors(pc, pa));
    if (faceNormal.lengthSq() < 1e-14) return; // triángulo degenerado (polo o centro)
    vertexNormalSum.copy(normals[a]!).add(normals[b]!).add(normals[c]!);
    if (faceNormal.dot(vertexNormalSum) >= 0) buffers.indices.push(base + a, base + b, base + c);
    else buffers.indices.push(base + a, base + c, base + b);
  };
  for (let j = 0; j < vSteps; j++) {
    for (let i = 0; i < uSteps; i++) {
      const a = j * row + i;
      pushTriangle(a, a + row, a + 1);
      pushTriangle(a + 1, a + row, a + row + 1);
    }
  }
}

export function buildSphereShellGeometry(config: SphereShellGeometryConfig, colors: ShellColors): BufferGeometry {
  const outerRadius = config.outerRadius;
  const innerRadius = Math.max(0, Math.min(config.innerRadius, outerRadius - 1e-4));
  const segments = Math.max(12, Math.round(config.segments ?? 48));
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };

  // Pasos proporcionales al ángulo para que los bordes de todas las partes coincidan.
  const phiSteps = (length: number) => Math.max(2, Math.round((segments * length) / TWO_PI));
  const thetaSteps = (length: number) => Math.max(2, Math.round(((segments / 2) * length) / Math.PI));
  const radialSteps = 6;

  const cut = config.cut;
  const phiStart = cut?.phiStart ?? 0;
  const phiLength = cut ? Math.min(Math.max(cut.phiLength, 0), TWO_PI) : 0;
  const thetaStart = cut ? Math.min(Math.max(cut.thetaStart, 0), Math.PI) : 0;
  const thetaEnd = cut ? Math.min(Math.max(cut.thetaStart + cut.thetaLength, 0), Math.PI) : 0;
  const hasCut = Boolean(cut) && phiLength > EPS && thetaEnd - thetaStart > EPS;

  const direction = new Vector3();
  const surfacePatch = (radius: number, inward: boolean, t0: number, t1: number, p0: number, p1: number) => {
    if (t1 - t0 <= EPS || p1 - p0 <= EPS) return;
    addGrid(buffers, phiSteps(p1 - p0), thetaSteps(t1 - t0), (u, v, position, normal, color) => {
      sphereDirection(t0 + (t1 - t0) * v, p0 + (p1 - p0) * u, direction);
      position.copy(direction).multiplyScalar(radius);
      if (inward) {
        normal.copy(direction).negate();
        color.copy(colors.inner);
      } else {
        normal.copy(direction);
        colors.outer(direction, position, color);
      }
    });
  };

  const sphereSurface = (radius: number, inward: boolean) => {
    if (!hasCut) {
      surfacePatch(radius, inward, 0, Math.PI, 0, TWO_PI);
      return;
    }
    // Encima, a la altura y debajo de la franja recortada. Todas empiezan en
    // phiStart para que los vértices de los bordes compartidos coincidan.
    surfacePatch(radius, inward, 0, thetaStart, phiStart, phiStart + TWO_PI);
    surfacePatch(radius, inward, thetaStart, thetaEnd, phiStart + phiLength, phiStart + TWO_PI);
    surfacePatch(radius, inward, thetaEnd, Math.PI, phiStart, phiStart + TWO_PI);
  };

  sphereSurface(outerRadius, false);
  if (innerRadius > 0) sphereSurface(innerRadius, true);

  if (hasCut) {
    const tangent = new Vector3();
    // Tapas meridianas (planos que contienen el eje Y) en los bordes del recorte.
    const meridianCap = (phi: number, sign: 1 | -1) => {
      tangent.set(Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(sign);
      addGrid(buffers, radialSteps, thetaSteps(thetaEnd - thetaStart), (u, v, position, normal, color) => {
        const rho = innerRadius + (outerRadius - innerRadius) * u;
        sphereDirection(thetaStart + (thetaEnd - thetaStart) * v, phi, position).multiplyScalar(rho);
        normal.copy(tangent);
        colors.section(u, color);
      });
    };
    // Tapas paralelas (disco o cono) en los bordes polares del recorte.
    const parallelCap = (theta: number, sign: 1 | -1) => {
      addGrid(buffers, phiSteps(phiLength), radialSteps, (u, v, position, normal, color) => {
        const phi = phiStart + phiLength * u;
        const rho = innerRadius + (outerRadius - innerRadius) * v;
        sphereDirection(theta, phi, position).multiplyScalar(rho);
        normal
          .set(-Math.cos(phi) * Math.cos(theta), -Math.sin(theta), Math.sin(phi) * Math.cos(theta))
          .multiplyScalar(sign);
        colors.section(v, color);
      });
    };
    if (phiLength < TWO_PI - EPS) {
      meridianCap(phiStart, 1); // el sólido queda en phi < phiStart
      meridianCap(phiStart + phiLength, -1); // el sólido queda en phi > phiEnd
    }
    if (thetaEnd < Math.PI - EPS) parallelCap(thetaEnd, -1); // sólido debajo
    if (thetaStart > EPS) parallelCap(thetaStart, 1); // sólido encima
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}
