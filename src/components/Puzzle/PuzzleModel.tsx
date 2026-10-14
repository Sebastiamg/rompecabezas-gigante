import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CircleGeometry,
  Color,
  Euler,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PuzzleRuntime, RuntimeSlot } from '../../engine/puzzleRuntime';
import { toVector3 } from '../../engine/puzzleUtils';
import { useSharedGeometry } from '../../hooks/useSharedGeometry';
import type { InteractionStore } from '../../interaction/interactionStore';
import { dampScalar } from '../../three/animation';
import {
  createFresnelMaterial,
  createGhostMaterial,
  createGlowMaterial,
  createGuideMaterial,
  createPieceMaterial,
} from '../../three/materials';
import type { DecorationConfig, PieceAppearance, PuzzleState } from '../../types/puzzle';

const GUIDE_COLOR = new Color('#67e8f9');
const REVEAL_COLOR = new Color('#fbbf24');
const FORWARD = new Vector3(0, 0, 1);

function isRevealed(store: InteractionStore, slotId: string, now: number): boolean {
  return store.reveal.until > now && store.reveal.slotIds.includes(slotId);
}

interface PuzzleModelProps {
  runtime: PuzzleRuntime;
  state: PuzzleState;
  store: InteractionStore;
  modelRadius: number;
}

/**
 * El "modelo" es todo lo que no es una pieza: la silueta de los lugares
 * vacíos, las guías de zona durante el arrastre y las decoraciones.
 * Es genérico: se construye a partir de los slots y de la configuración.
 */
export function PuzzleModel({ runtime, state, store, modelRadius }: PuzzleModelProps) {
  const completed = state.phase === 'completed';
  const ghostColor = runtime.config.model.ghost?.color ?? '#7dd3fc';
  const ghostOpacity = runtime.config.model.ghost?.opacity ?? 0.55;
  return (
    <group>
      {runtime.slots
        .filter((slot) => slot.kind === 'piece')
        .map((slot) => (
        <SlotGhost
          key={`ghost-${slot.id}`}
          runtime={runtime}
          slot={slot}
          hidden={completed || state.slots[slot.id] != null}
          store={store}
          color={ghostColor}
          opacity={ghostOpacity}
        />
        ))}
      {runtime.slots.map((slot) => (
        <ZoneGuide
          key={`guide-${slot.id}`}
          runtime={runtime}
          slot={slot}
          occupied={state.slots[slot.id] != null}
          completed={completed}
          store={store}
          modelRadius={modelRadius}
        />
      ))}
      {runtime.config.model.decorations?.map((decoration) => (
        <Decoration key={decoration.id} decoration={decoration} anchor={runtime.anchor} visible />
      ))}
      {runtime.config.completion.revealDecorations?.map((decoration) => (
        <Decoration key={decoration.id} decoration={decoration} anchor={runtime.anchor} visible={completed} />
      ))}
    </group>
  );
}

// ─── Silueta del lugar vacío ─────────────────────────────────────────

interface SlotGhostProps {
  runtime: PuzzleRuntime;
  slot: RuntimeSlot;
  hidden: boolean;
  store: InteractionStore;
  color: string;
  opacity: number;
}

function SlotGhost({ runtime, slot, hidden, store, color, opacity }: SlotGhostProps) {
  const meshRef = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const owner = runtime.pieceById.get(slot.id);
  const geometry = useSharedGeometry(
    owner?.config.geometry ?? { type: 'sphere', radius: 0.01 },
    owner?.config.appearance ?? { color },
  );
  const material = useMemo(() => createGhostMaterial(color), [color]);
  useEffect(() => () => material.dispose(), [material]);
  const level = useRef(0);

  useLayoutEffect(() => {
    invalidate();
  }, [hidden, invalidate]);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 1 / 20);
    const { profile } = runtime;
    const drag = store.drag;
    const now = performance.now();
    const revealed = isRevealed(store, slot.id, now);
    const aiming = drag.active || store.aimSlotId !== null;
    const target = drag.active ? drag.hoverSlotId : store.aimSlotId;
    let goal = profile.showGhosts === 'always' || (profile.showGhosts === 'while-dragging' && aiming) ? 1 : 0;
    if (aiming && profile.highlightHoveredZone && target === slot.id) goal = 1.8;
    if (revealed) goal = 1.6 + 0.6 * Math.sin(now * 0.008);
    if (hidden) goal = 0;
    level.current = dampScalar(level.current, goal, 8, dt);
    material.uniforms.uOpacity.value = level.current * opacity;
    mesh.visible = level.current > 0.003;
    if (Math.abs(level.current - goal) > 0.003 || revealed) invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={slot.position}
      quaternion={slot.quaternion}
      scale={slot.scale}
      renderOrder={5}
    />
  );
}

// ─── Guía visual de una zona de colocación ───────────────────────────

interface ZoneGuideProps {
  runtime: PuzzleRuntime;
  slot: RuntimeSlot;
  occupied: boolean;
  completed: boolean;
  store: InteractionStore;
  modelRadius: number;
}

function ZoneGuide({ runtime, slot, occupied, completed, store, modelRadius }: ZoneGuideProps) {
  const groupRef = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const zone = slot.zone;

  const geometries = useMemo(() => {
    const thickness = modelRadius * 0.007;
    const segments = 96;
    const outer = zone.type === 'shell' ? zone.outer : Math.max(zone.outer, slot.tolerance * 0.7);
    const inner = zone.type === 'shell' ? zone.inner : 0;
    const fill = inner > 0 ? new RingGeometry(inner, outer, segments, 1) : new CircleGeometry(outer, segments);
    const rings = [new RingGeometry(Math.max(0, outer - thickness), outer + thickness, segments, 1)];
    if (inner > 0) rings.push(new RingGeometry(Math.max(0, inner - thickness), inner + thickness, segments, 1));
    // Un solo mesh para todos los contornos de la zona (menos draw calls).
    const outline = rings.length > 1 ? (mergeGeometries(rings) ?? rings[0]!) : rings[0]!;
    if (outline !== rings[0]) rings.forEach((ring) => ring.dispose());
    return { fill, outline };
  }, [zone, slot.tolerance, modelRadius]);
  useEffect(
    () => () => {
      geometries.fill.dispose();
      geometries.outline.dispose();
    },
    [geometries],
  );

  const materials = useMemo(
    () => ({ fill: createGuideMaterial('#67e8f9'), line: createGuideMaterial('#67e8f9') }),
    [],
  );
  useEffect(
    () => () => {
      materials.fill.dispose();
      materials.line.dispose();
    },
    [materials],
  );

  const fixedOrientation = useMemo(() => {
    const plane = runtime.interaction.dragPlane;
    return plane.type === 'fixed'
      ? new Quaternion().setFromUnitVectors(FORWARD, toVector3(plane.normal).normalize())
      : null;
  }, [runtime]);

  const levels = useRef({ fill: 0, line: 0 });

  useLayoutEffect(() => {
    invalidate();
  }, [occupied, completed, invalidate]);

  useFrame(({ camera }, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(rawDelta, 1 / 20);
    const { profile } = runtime;
    const drag = store.drag;
    const now = performance.now();
    const revealed = isRevealed(store, slot.id, now);
    const aiming = drag.active || store.aimSlotId !== null;
    const target = drag.active ? drag.hoverSlotId : store.aimSlotId;
    const mode = profile.showDropGuides;
    const showGuides = !completed && (mode === 'always' || (mode === 'while-dragging' && aiming));
    // Con teclado el lugar apuntado siempre se resalta (es la única forma de saber dónde se colocará).
    const hovered = aiming && target === slot.id && (profile.highlightHoveredZone || !drag.active);

    let fillGoal = hovered ? 0.22 : showGuides && aiming ? 0.035 : 0;
    // En reposo (modo 'always') solo se marcan, tenues, los lugares aún libres.
    const restingLine = occupied ? 0 : 0.24;
    let lineGoal = hovered ? 0.85 : showGuides ? (aiming ? (occupied ? 0.16 : 0.38) : restingLine) : 0;
    if (revealed) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
      fillGoal = 0.12 + 0.18 * pulse;
      lineGoal = 0.6 + 0.35 * pulse;
    }
    const lv = levels.current;
    lv.fill = dampScalar(lv.fill, fillGoal, 14, dt);
    lv.line = dampScalar(lv.line, lineGoal, 14, dt);
    const color = revealed ? REVEAL_COLOR : GUIDE_COLOR;
    materials.fill.color.copy(color);
    materials.line.color.copy(color);
    materials.fill.opacity = lv.fill;
    materials.line.opacity = lv.line;
    group.visible = lv.fill > 0.002 || lv.line > 0.002;
    if (fixedOrientation) group.quaternion.copy(fixedOrientation);
    else group.quaternion.copy(camera.quaternion); // siempre de frente a la cámara

    if (Math.abs(lv.fill - fillGoal) > 0.002 || Math.abs(lv.line - lineGoal) > 0.002 || revealed) invalidate();
  });

  return (
    <group ref={groupRef} position={zone.center} visible={false}>
      <mesh geometry={geometries.fill} material={materials.fill} renderOrder={10} />
      <mesh geometry={geometries.outline} material={materials.line} renderOrder={11} />
    </group>
  );
}

// ─── Decoraciones (base, halo, atmósfera...) ─────────────────────────

interface DecorationProps {
  decoration: DecorationConfig;
  anchor: Vector3;
  visible: boolean;
}

function Decoration({ decoration, anchor, visible }: DecorationProps) {
  const meshRef = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const color = decoration.color ?? '#7dd3fc';
  const kind = decoration.material ?? 'standard';
  const appearance = useMemo<PieceAppearance>(() => ({ color }), [color]);
  const geometry = useSharedGeometry(decoration.geometry, appearance);
  const targetOpacity = decoration.opacity ?? (kind === 'standard' ? 1 : 0.6);

  const material = useMemo(() => {
    if (kind === 'halo') return createFresnelMaterial({ color, opacity: 0, base: 0, rim: 1.2, power: 2.4 });
    if (kind === 'glow') return createGlowMaterial(color, 0);
    return createPieceMaterial({});
  }, [kind, color]);
  useEffect(() => () => material.dispose(), [material]);

  const transform = useMemo(() => {
    const t = decoration.transform;
    return {
      position: toVector3(t.position).add(anchor),
      rotation: new Euler(t.rotation[0], t.rotation[1], t.rotation[2]),
      scale: t.scale,
    };
  }, [decoration.transform, anchor]);

  const level = useRef(visible ? 1 : 0);
  useLayoutEffect(() => {
    invalidate();
  }, [visible, invalidate]);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const goal = visible ? 1 : 0;
    level.current = dampScalar(level.current, goal, 2.5, Math.min(rawDelta, 1 / 20));
    if (Math.abs(level.current - goal) < 0.002) level.current = goal;
    else invalidate();
    if (material instanceof ShaderMaterial) material.uniforms.uOpacity!.value = level.current * targetOpacity;
    else if (material instanceof MeshBasicMaterial) material.opacity = level.current * targetOpacity;
    else mesh.scale.setScalar(transform.scale * level.current);
    mesh.visible = level.current > 0.002;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={transform.position}
      rotation={transform.rotation}
      scale={transform.scale}
      renderOrder={kind === 'standard' ? 0 : 6}
    />
  );
}
