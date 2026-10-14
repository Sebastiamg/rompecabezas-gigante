import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, Matrix4, Quaternion, Vector3, type Camera, type Group, type Mesh } from 'three';
import type { PuzzleRuntime, RuntimePiece } from '../../engine/puzzleRuntime';
import type { InteractionStore } from '../../interaction/interactionStore';
import { trayBaseQuaternion } from '../../interaction/trayOrientation';
import { useSharedGeometry } from '../../hooks/useSharedGeometry';
import {
  dampQuaternion,
  dampScalar,
  dampVector,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  flashCurve,
} from '../../three/animation';
import { createOutlineMaterial, createPieceMaterial } from '../../three/materials';
import { pieceGeometryRadius } from '../../three/modelBounds';
import type { PieceStatus, PuzzlePhase } from '../../types/puzzle';

const SPAWN_DURATION = 0.5;
const SNAP_DURATION = 0.62;
const SHAKE_DURATION = 0.45;
const FLASH_DURATION = 0.9;
const CELEBRATE_DURATION = 1.1;
const SWAY_ANGLE = 0.52;

const SELECT_GLOW = new Color('#67e8f9');
const SUCCESS_GLOW = new Color('#e0fbff');
const ERROR_GLOW = new Color('#fb7185');
const CELEBRATE_GLOW = new Color('#fde68a');
const AXIS_Y = new Vector3(0, 1, 0);

interface PieceAnimation {
  /** 'view' = relativa a la cámara (bandeja/arrastre); 'world' = en el modelo. */
  space: 'view' | 'world';
  initialized: boolean;
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  /** null = aún no ha aparecido. Valores negativos = retraso antes de aparecer. */
  spawnT: number | null;
  shakeT: number | null;
  snap: { t: number; fromPosition: Vector3; fromQuaternion: Quaternion; fromScale: number } | null;
  flashT: number | null;
  celebrateT: number | null;
  sway: number;
  swayT: number;
  glow: number;
  outline: number;
}

interface PuzzlePieceProps {
  runtime: PuzzleRuntime;
  piece: RuntimePiece;
  status: PieceStatus;
  slotId: string | null;
  selected: boolean;
  phase: PuzzlePhase;
  /** Orden en la bandeja (escalona la aparición). */
  trayIndex: number;
  /** Orden en la celebración final. */
  celebrateIndex: number;
  /** Cambia (>0) cada vez que esta pieza es rechazada. */
  rejectSeq: number;
  store: InteractionStore;
  /** null = tamaño normalizado en la bandeja; número = mantener proporciones respecto a este radio. */
  sizeReference: number | null;
}

const inverseCamera = new Quaternion();
const target = new Vector3();
const desired = new Quaternion();
const swayStep = new Quaternion();
const viewPosition = new Vector3();
const worldPosition = new Vector3();
const worldQuaternion = new Quaternion();
const rayDirection = new Vector3();
const radialTangent = new Vector3();
const crossTangent = new Vector3();
const basis = new Matrix4();
const frame = new Quaternion();

/**
 * Compensa la distorsión de perspectiva: un objeto cercano y alejado del
 * eje óptico se proyecta estirado en dirección radial (factor 1/cos α).
 * Se aplasta en esa dirección (en el plano perpendicular al rayo) para
 * que las piezas de la bandeja se vean redondas en pantallas anchas.
 * `strength` 1 = compensación total, 0 = ninguna (pieza ya en el modelo).
 */
function writeTransform(
  group: Group,
  mesh: Mesh,
  camera: Camera,
  position: Vector3,
  quaternion: Quaternion,
  scale: number,
  view: Vector3,
  strength: number,
) {
  group.position.copy(position);
  const length = view.length();
  const cosAlpha = length > 1e-6 ? -view.z / length : 1;
  if (strength <= 0 || cosAlpha > 0.9995 || cosAlpha <= 0.05) {
    group.quaternion.identity();
    group.scale.set(1, 1, 1);
    mesh.quaternion.copy(quaternion);
  } else {
    rayDirection.copy(view).divideScalar(length);
    radialTangent.set(view.x, view.y, 0).normalize();
    radialTangent.addScaledVector(rayDirection, -radialTangent.dot(rayDirection)).normalize();
    crossTangent.crossVectors(rayDirection, radialTangent);
    frame.setFromRotationMatrix(basis.makeBasis(radialTangent, crossTangent, rayDirection));
    group.quaternion.copy(camera.quaternion).multiply(frame);
    group.scale.set(1 - strength * (1 - cosAlpha), 1, 1);
    mesh.quaternion.copy(group.quaternion).invert().multiply(quaternion);
  }
  mesh.scale.setScalar(scale);
}

function viewToWorld(anim: PieceAnimation, camera: Camera) {
  anim.position.applyQuaternion(camera.quaternion).add(camera.position);
  anim.quaternion.premultiply(camera.quaternion);
  anim.space = 'world';
}

function worldToView(anim: PieceAnimation, camera: Camera) {
  inverseCamera.copy(camera.quaternion).invert();
  anim.position.sub(camera.position).applyQuaternion(inverseCamera);
  anim.quaternion.premultiply(inverseCamera);
  anim.space = 'view';
}

function addColor(out: Color, color: Color, amount: number) {
  if (amount <= 0) return;
  out.r += color.r * amount;
  out.g += color.g * amount;
  out.b += color.b * amount;
}

/**
 * Pieza 3D genérica. No sabe qué representa: solo anima entre estados
 * (aparecer, reposo, seleccionada, arrastrada, rechazada, encajada,
 * bloqueada, celebrando). Las transformaciones se escriben directamente
 * en el Mesh dentro de useFrame: cero renders de React por frame, y se
 * deja de pedir frames en cuanto la pieza está quieta.
 */
export const PuzzlePiece = memo(function PuzzlePiece({
  runtime,
  piece,
  status,
  slotId,
  selected,
  phase,
  trayIndex,
  celebrateIndex,
  rejectSeq,
  store,
  sizeReference,
}: PuzzlePieceProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useSharedGeometry(piece.config.geometry, piece.config.appearance);
  const material = useMemo(() => createPieceMaterial(piece.config.appearance), [piece]);
  useEffect(() => () => material.dispose(), [material]);
  const outlineMaterial = useMemo(() => createOutlineMaterial('#67e8f9'), []);
  useEffect(() => () => outlineMaterial.dispose(), [outlineMaterial]);
  const outlineRef = useRef<Mesh>(null);

  const baseQuaternion = useMemo(() => trayBaseQuaternion(runtime, piece.id), [runtime, piece.id]);
  /** trayScale = radio del hueco × este factor. */
  const trayScaleFactor = useMemo(() => {
    const radius = pieceGeometryRadius(runtime, piece.id);
    const proportion = sizeReference ? (radius * piece.config.targetTransform.scale) / sizeReference : 1;
    return (proportion * (piece.config.initialTransform?.scale ?? 1)) / radius;
  }, [runtime, piece, sizeReference]);

  const anim = useMemo<PieceAnimation>(
    () => ({
      space: 'view',
      initialized: false,
      position: new Vector3(),
      quaternion: new Quaternion(),
      scale: 0,
      spawnT: null,
      shakeT: null,
      snap: null,
      flashT: null,
      celebrateT: null,
      sway: 0,
      swayT: 0,
      glow: 0,
      outline: 0,
    }),
    [],
  );

  // useLayoutEffect: se aplica antes del siguiente frame, sin saltos visibles.
  useLayoutEffect(() => {
    if (anim.spawnT === null && (phase !== 'intro' || status === 'placed')) {
      anim.spawnT = -0.12 - trayIndex * 0.09;
      invalidate();
    }
  }, [anim, phase, status, trayIndex, invalidate]);

  useLayoutEffect(() => {
    if (rejectSeq > 0) {
      anim.shakeT = 0;
      invalidate();
    }
  }, [anim, rejectSeq, invalidate]);

  useLayoutEffect(() => {
    if (phase === 'completed') {
      anim.celebrateT = -0.5 - celebrateIndex * 0.14;
      invalidate();
    }
  }, [anim, phase, celebrateIndex, invalidate]);

  useLayoutEffect(() => {
    invalidate();
  }, [status, slotId, selected, invalidate]);

  useFrame((state, rawDelta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;
    if (anim.spawnT === null) {
      mesh.visible = false;
      return;
    }
    const dt = Math.min(rawDelta, 1 / 20);
    const camera = state.camera;
    const drag = store.drag;
    const isMine = drag.pieceId === piece.id;
    const dragging = isMine && drag.active;
    const pressed = isMine && drag.pressed && !drag.active;
    const hovered = store.hoverTrayId === piece.id;
    const slot = status === 'placed' && slotId ? runtime.slotById.get(slotId) : undefined;
    let busy = false;
    let shakeOffset = 0;

    if (slot) {
      // ── En el modelo: snap suave hasta el objetivo y quedarse ahí.
      if (!anim.initialized) {
        anim.position.copy(slot.position);
        anim.quaternion.copy(slot.quaternion);
        anim.scale = slot.scale;
        anim.space = 'world';
        anim.initialized = true;
      } else if (anim.space === 'view') {
        viewToWorld(anim, camera);
        anim.snap = {
          t: 0,
          fromPosition: anim.position.clone(),
          fromQuaternion: anim.quaternion.clone(),
          fromScale: anim.scale,
        };
      }
      if (anim.snap) {
        anim.snap.t = Math.min(1, anim.snap.t + dt / SNAP_DURATION);
        const k = anim.snap.t;
        anim.position.lerpVectors(anim.snap.fromPosition, slot.position, easeInOutCubic(k));
        anim.quaternion.slerpQuaternions(anim.snap.fromQuaternion, slot.quaternion, easeOutCubic(k));
        anim.scale = MathUtils.lerp(anim.snap.fromScale, slot.scale, easeOutBack(k, 1.1));
        if (k >= 1) {
          anim.snap = null;
          anim.flashT = 0;
        }
        busy = true;
      } else {
        anim.position.copy(slot.position);
        anim.quaternion.copy(slot.quaternion);
        anim.scale = slot.scale;
      }
    } else {
      // ── En la bandeja o en la mano: espacio de cámara.
      const home = store.trayHomes.get(piece.id);
      if (!home) {
        mesh.visible = false;
        return;
      }
      if (anim.space === 'world') worldToView(anim, camera);
      const trayScale = home.radius * trayScaleFactor;
      let targetScale = trayScale;
      let lambda = 12;
      if (dragging) {
        target.copy(drag.view);
        targetScale = trayScale * 1.25;
        lambda = 28;
      } else if (status === 'dragging' || anim.shakeT !== null) {
        // Esperando el veredicto del motor, o sacudiéndose donde se soltó.
        target.copy(anim.position);
        targetScale = anim.scale;
      } else {
        target.copy(home.view);
        const lifted = selected || pressed;
        if (lifted) {
          target.z += home.radius * 0.45; // hacia la cámara: "la levanto"
          target.y += home.radius * 0.22;
        }
        targetScale = trayScale * (lifted ? 1.08 : hovered ? 1.05 : 1);
      }

      // Inspección: vaivén suave (±30°) que muestra el volumen sin ocultar su cara de corte.
      const swaying = runtime.interaction.inspectSpin && selected && !dragging && !pressed;
      if (swaying) {
        anim.swayT += dt;
        anim.sway = Math.sin(anim.swayT * 1.6) * SWAY_ANGLE;
        busy = true;
      } else if (anim.sway !== 0) {
        anim.swayT = 0;
        anim.sway = dampScalar(anim.sway, 0, 8, dt);
        if (Math.abs(anim.sway) < 1e-3) anim.sway = 0;
        else busy = true;
      }
      desired.copy(baseQuaternion);
      const userRotation = store.userRotation.get(piece.id);
      if (userRotation) desired.premultiply(userRotation);
      if (anim.sway !== 0) desired.premultiply(swayStep.setFromAxisAngle(AXIS_Y, anim.sway));

      if (!anim.initialized) {
        anim.position.copy(target);
        anim.quaternion.copy(desired);
        anim.scale = targetScale;
        anim.initialized = true;
      }
      if (anim.shakeT !== null) {
        anim.shakeT += dt;
        const k = anim.shakeT / SHAKE_DURATION;
        if (k >= 1) anim.shakeT = null;
        else shakeOffset = Math.sin(anim.shakeT * 48) * (1 - k) * home.radius * 0.3;
        busy = true;
      }
      dampVector(anim.position, target, lambda, dt);
      anim.scale = dampScalar(anim.scale, targetScale, lambda, dt);
      dampQuaternion(anim.quaternion, desired, 14, dt);
      if (
        anim.position.distanceToSquared(target) > 1e-9 ||
        Math.abs(anim.scale - targetScale) > 1e-5 ||
        anim.quaternion.angleTo(desired) > 1e-4
      ) {
        busy = true;
      }
    }

    // ── Efectos temporales.
    let spawnScale = 1;
    if (anim.spawnT < SPAWN_DURATION) {
      anim.spawnT += dt;
      spawnScale = anim.spawnT <= 0 ? 0 : easeOutBack(Math.min(1, anim.spawnT / SPAWN_DURATION), 1.5);
      busy = true;
    }
    let flash = 0;
    if (anim.flashT !== null) {
      anim.flashT += dt;
      flash = flashCurve(anim.flashT, FLASH_DURATION);
      if (anim.flashT > FLASH_DURATION) anim.flashT = null;
      busy = true;
    }
    let pulse = 0;
    if (anim.celebrateT !== null) {
      anim.celebrateT += dt;
      pulse = flashCurve(anim.celebrateT, CELEBRATE_DURATION);
      if (anim.celebrateT > CELEBRATE_DURATION) anim.celebrateT = null;
      busy = true;
    }
    const errorGlow = anim.shakeT !== null ? flashCurve(anim.shakeT, SHAKE_DURATION) : 0;
    // Selección = contorno + leve brillo de borde (no lava el color de la pieza).
    const outlineTarget = slot ? 0 : dragging || selected || pressed ? 0.95 : hovered ? 0.5 : 0;
    anim.outline = dampScalar(anim.outline, outlineTarget, 12, dt);
    if (Math.abs(anim.outline - outlineTarget) > 0.004) busy = true;
    else anim.outline = outlineTarget;
    anim.glow = anim.outline * 0.18;

    // ── Escribir en el Object3D.
    let compensation: number;
    if (anim.space === 'view') {
      viewPosition.copy(anim.position);
      viewPosition.x += shakeOffset;
      worldPosition.copy(viewPosition).applyQuaternion(camera.quaternion).add(camera.position);
      worldQuaternion.copy(camera.quaternion).multiply(anim.quaternion);
      compensation = 1;
    } else {
      worldPosition.copy(anim.position);
      worldQuaternion.copy(anim.quaternion);
      inverseCamera.copy(camera.quaternion).invert();
      viewPosition.copy(anim.position).sub(camera.position).applyQuaternion(inverseCamera);
      // Durante el snap la compensación se desvanece: sin saltos al pasar al modelo.
      compensation = anim.snap ? 1 - easeInOutCubic(anim.snap.t) : 0;
    }
    const finalScale = Math.max(1e-5, anim.scale * spawnScale * (1 + pulse * 0.04 + flash * 0.035));
    writeTransform(group, mesh, camera, worldPosition, worldQuaternion, finalScale, viewPosition, compensation);
    mesh.visible = spawnScale > 0.001;
    const outline = outlineRef.current;
    if (outline) {
      outline.visible = anim.outline > 0.01;
      outlineMaterial.opacity = anim.outline;
    }

    // Las piezas sueltas se dibujan después de las guías de zona (que ignoran profundidad).
    const overlay = !slot;
    if (material.transparent !== overlay) {
      material.transparent = overlay;
      material.needsUpdate = true;
    }
    mesh.renderOrder = overlay ? 20 : 0;

    const emissive = material.emissive;
    emissive.setRGB(0, 0, 0);
    addColor(emissive, SELECT_GLOW, anim.glow);
    addColor(emissive, SUCCESS_GLOW, flash * 0.9);
    addColor(emissive, ERROR_GLOW, errorGlow * 0.85);
    addColor(emissive, CELEBRATE_GLOW, pulse * 0.75);

    if (busy) invalidate();
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} material={material}>
        <mesh ref={outlineRef} geometry={geometry} material={outlineMaterial} scale={1.1} renderOrder={19} visible={false} />
      </mesh>
    </group>
  );
});
