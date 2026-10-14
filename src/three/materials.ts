import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Side,
} from 'three';
import type { PieceAppearance } from '../types/puzzle';

/**
 * Materiales deliberadamente simples (sin sombras, sin mapas de entorno,
 * sin post-procesado): una luz direccional + ambiente bastan para dar
 * volumen y mantienen el coste por píxel bajo en móviles de gama media.
 */

/**
 * El emisivo se concentra en el borde (fresnel): la pieza "brilla" como
 * un contorno sin perder su color. Mismo código para todas las piezas →
 * un único programa de GPU compartido.
 */
function rimEmissive(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    /* glsl */ `#include <emissivemap_fragment>
    float rimFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    totalEmissiveRadiance *= 0.08 + 2.6 * pow(1.0 - rimFacing, 3.5);`,
  );
}

/** Material de pieza: colores por vértice + emisivo animable (selección, aciertos, errores). */
export function createPieceMaterial(appearance: Pick<PieceAppearance, 'roughness' | 'metalness'>): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: appearance.roughness ?? 0.72,
    metalness: appearance.metalness ?? 0.04,
    emissive: new Color(0x000000),
    emissiveIntensity: 1,
  });
  material.onBeforeCompile = rimEmissive;
  return material;
}

const fresnelVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fresnelFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBase;
  uniform float uRim;
  uniform float uPower;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float facing = abs(dot(normalize(vNormalW), normalize(vViewDir)));
    float alpha = uOpacity * (uBase + uRim * pow(1.0 - facing, uPower));
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

export interface FresnelOptions {
  color: string;
  opacity?: number;
  base?: number;
  rim?: number;
  power?: number;
  side?: Side;
}

export type FresnelMaterial = ShaderMaterial & {
  uniforms: {
    uColor: { value: Color };
    uOpacity: { value: number };
    uBase: { value: number };
    uRim: { value: number };
    uPower: { value: number };
  };
};

/** Brillo de borde (efecto holograma / atmósfera). Aditivo y sin escribir profundidad. */
export function createFresnelMaterial(options: FresnelOptions): FresnelMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(options.color) },
      uOpacity: { value: options.opacity ?? 1 },
      uBase: { value: options.base ?? 0.06 },
      uRim: { value: options.rim ?? 0.9 },
      uPower: { value: options.power ?? 2.2 },
    },
    vertexShader: fresnelVertex,
    fragmentShader: fresnelFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: options.side ?? FrontSide,
  }) as FresnelMaterial;
}

/** Silueta translúcida de un lugar vacío del modelo. */
export function createGhostMaterial(color: string): FresnelMaterial {
  const material = createFresnelMaterial({ color, opacity: 0, base: 0.05, rim: 0.85, power: 2.4, side: DoubleSide });
  // Aditivo: el orden de dibujo no importa → una sola pasada (la mitad de draw calls).
  material.forceSinglePass = true;
  // Las capas vecinas comparten radio: sin esto la silueta "pelea" en profundidad con la pieza
  // ya colocada (z-fighting). Desplazada hacia atrás, la pieza opaca siempre gana.
  material.polygonOffset = true;
  material.polygonOffsetFactor = 2;
  material.polygonOffsetUnits = 4;
  return material;
}

/** Guías de zona: siempre visibles por encima del modelo mientras se arrastra. */
export function createGuideMaterial(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
  });
}

export function createGlowMaterial(color: string, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Contorno de selección: la misma geometría algo inflada y vista por dentro
 * (BackSide). Solo asoma el borde de la silueta, sin teñir el color de la pieza.
 */
export function createOutlineMaterial(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    side: BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
}
