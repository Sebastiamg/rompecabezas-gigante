import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { MathUtils, PerspectiveCamera, Quaternion, Vector3, type DirectionalLight } from 'three';
import type { PuzzleRuntime } from '../../engine/puzzleRuntime';
import { toVector3 } from '../../engine/puzzleUtils';
import type { InteractionStore } from '../../interaction/interactionStore';
import type { LayoutMetrics } from '../../interaction/layout';
import { easeInOutCubic } from '../../three/animation';
import type { PuzzlePhase } from '../../types/puzzle';

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

interface CameraTween {
  fromDirection: Vector3;
  rotation: Quaternion;
  fromDistance: number;
  toDistance: number;
  t: number;
  duration: number;
  onDone?: () => void;
}

/** Transición del encuadre cuando cambia la zona libre (p. ej. aparece una tarjeta). */
interface Reframe {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Factor total de distancia a aplicar (1 = sin cambio). */
  ratio: number;
  /** Factor ya aplicado. */
  applied: number;
  t: number;
}

interface PuzzleCameraProps {
  runtime: PuzzleRuntime;
  metrics: LayoutMetrics | null;
  modelRadius: number;
  store: InteractionStore;
  phase: PuzzlePhase;
  /** Se incrementa al pulsar "restablecer vista". */
  resetViewSignal: number;
  /** Se incrementa al reiniciar el rompecabezas. */
  session: number;
}

const UP = new Vector3(0, 1, 0);
const MAX_HORIZONTAL_TAN_HALF = Math.tan(MathUtils.degToRad(30));
const REFRAME_SECONDS = 0.7;

/**
 * Cámara orbital + encuadre responsive:
 * - "Lens shift" (setViewOffset) centra el modelo en la zona libre entre el
 *   HUD, la bandeja y cualquier tarjeta que lo tape, sin deformarlo.
 * - La distancia se calcula para que el modelo quepa en esa zona en
 *   cualquier pantalla (360 px de ancho o escritorio).
 * - Si la zona libre cambia (aparece la tarjeta final), el encuadre se
 *   anima suavemente: la interfaz nunca tapa el modelo.
 * - Calcula dónde van las piezas de la bandeja (pegadas a la cámara).
 */
export function PuzzleCamera({ runtime, metrics, modelRadius, store, phase, resetViewSignal, session }: PuzzleCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const tween = useRef<CameraTween | null>(null);
  const reframe = useRef<Reframe | null>(null);
  const framing = useRef({ ready: false, distance: 0, width: 1, height: 1, offsetX: 0, offsetY: 0, tanHalf: 0.4 });
  const slots = useRef<LayoutMetrics['slots']>({});

  const cameraConfig = runtime.config.model.camera;
  const minZoom = cameraConfig.minZoom ?? 0.55;
  const maxZoom = cameraConfig.maxZoom ?? 2;
  const homeDirection = useMemo(() => toVector3(cameraConfig.direction).normalize(), [cameraConfig]);
  const temp = useMemo(() => ({ offset: new Vector3(), direction: new Vector3(), q: new Quaternion() }), []);

  /** Coloca las piezas de la bandeja según la proyección actual. */
  const updateTrayHomes = useCallback(() => {
    const f = framing.current;
    const worldPerPixel = (2 * store.trayDepth * f.tanHalf) / f.height;
    store.trayHomes.clear();
    for (const [id, rect] of Object.entries(slots.current)) {
      const view = new Vector3(
        ((rect.x + rect.width / 2) / f.width) * 2 - 1,
        1 - ((rect.y + rect.height / 2) / f.height) * 2,
        0.5,
      ).applyMatrix4(camera.projectionMatrixInverse);
      view.multiplyScalar(store.trayDepth / -view.z);
      store.trayHomes.set(id, { view, radius: (Math.min(rect.width, rect.height) / 2) * 0.84 * worldPerPixel });
    }
  }, [camera, store]);

  const applyViewOffset = useCallback(
    (x: number, y: number) => {
      const f = framing.current;
      f.offsetX = x;
      f.offsetY = y;
      camera.setViewOffset(f.width, f.height, x, y, f.width, f.height);
      updateTrayHomes();
    },
    [camera, updateTrayHomes],
  );

  const setZoomLimits = useCallback(
    (low: number, high: number) => {
      const controls = controlsRef.current;
      if (!controls) return;
      controls.minDistance = low * minZoom;
      controls.maxDistance = high * maxZoom;
    },
    [minZoom, maxZoom],
  );

  useLayoutEffect(() => {
    if (!metrics || metrics.width < 1 || metrics.height < 1) return;
    const { width, height, free } = metrics;
    const f = framing.current;
    // En pantallas anchas se limita el campo de visión horizontal (≤ 60°) para
    // evitar la distorsión de perspectiva en los bordes.
    const baseTanHalf = Math.tan(MathUtils.degToRad(cameraConfig.fov ?? 45) / 2);
    const tanHalf = Math.min(baseTanHalf, MAX_HORIZONTAL_TAN_HALF / (width / height));
    camera.fov = MathUtils.radToDeg(2 * Math.atan(tanHalf));
    camera.near = 0.05;
    camera.far = 500;

    const targetX = width / 2 - (free.x + free.width / 2);
    const targetY = height / 2 - (free.y + free.height / 2);
    const minSide = Math.max(60, Math.min(free.width, free.height));
    const halfAngle = Math.atan((tanHalf * minSide) / height);
    const distance = (modelRadius * (cameraConfig.framing ?? 1.15)) / Math.sin(halfAngle);

    const previousDistance = f.distance;
    const sizeChanged = width !== f.width || height !== f.height;
    f.width = width;
    f.height = height;
    f.tanHalf = tanHalf;
    f.distance = distance;
    slots.current = metrics.slots;
    store.trayRect = metrics.trayRect;
    // La bandeja vive delante del modelo incluso con el zoom al máximo.
    store.trayDepth = MathUtils.clamp((distance * minZoom - modelRadius) * 0.6, 0.25, 4);

    const controls = controlsRef.current;
    if (controls) controls.target.copy(runtime.anchor);

    if (!f.ready) {
      camera.position.copy(runtime.anchor).addScaledVector(homeDirection, distance);
      f.ready = true;
      reframe.current = null;
      applyViewOffset(targetX, targetY);
      setZoomLimits(distance, distance);
    } else {
      const ratio = previousDistance > 0 ? distance / previousDistance : 1;
      if (sizeChanged) {
        // Cambio de tamaño de la ventana: se aplica al instante (conserva ángulo y zoom relativo).
        temp.offset.subVectors(camera.position, runtime.anchor).multiplyScalar(ratio);
        camera.position.copy(runtime.anchor).add(temp.offset);
        if (tween.current) {
          tween.current.fromDistance *= ratio;
          tween.current.toDistance *= ratio;
        }
        reframe.current = null;
        applyViewOffset(targetX, targetY);
        setZoomLimits(distance, distance);
      } else {
        // La zona libre cambió (tarjeta, bandeja...): transición suave.
        if (tween.current) tween.current.toDistance *= ratio; // el movimiento en curso absorbe el cambio
        reframe.current = {
          fromX: f.offsetX,
          fromY: f.offsetY,
          toX: targetX,
          toY: targetY,
          ratio: tween.current ? 1 : ratio,
          applied: 1,
          t: 0,
        };
        updateTrayHomes();
        // Durante la transición se admiten ambos rangos de zoom para que no haya saltos.
        setZoomLimits(Math.min(previousDistance, distance), Math.max(previousDistance, distance));
      }
    }
    camera.lookAt(runtime.anchor);
    camera.updateMatrixWorld();
    controls?.update();
    invalidate();
  }, [
    metrics,
    size.width,
    size.height,
    modelRadius,
    camera,
    cameraConfig,
    homeDirection,
    runtime,
    store,
    invalidate,
    temp,
    minZoom,
    applyViewOffset,
    updateTrayHomes,
    setZoomLimits,
  ]);

  const startTween = useCallback(
    (toDirection: Vector3, toDistance: number, duration: number, onDone?: () => void) => {
      const offset = new Vector3().subVectors(camera.position, runtime.anchor);
      const fromDistance = offset.length();
      const fromDirection = offset.normalize();
      tween.current = {
        fromDirection,
        rotation: new Quaternion().setFromUnitVectors(fromDirection, toDirection.clone().normalize()),
        fromDistance,
        toDistance,
        t: 0,
        duration,
        onDone,
      };
      invalidate();
    },
    [camera, runtime, invalidate],
  );

  const stopAutoRotate = useCallback(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  // ↻ Restablecer vista, o reinicio del rompecabezas.
  useEffect(() => {
    if (resetViewSignal === 0 && session === 0) return;
    stopAutoRotate();
    startTween(homeDirection, framing.current.distance, 0.9);
  }, [resetViewSignal, session, homeDirection, startTween, stopAutoRotate]);

  // Movimiento cinematográfico breve al completar + órbita lenta.
  useEffect(() => {
    if (phase !== 'completed') {
      stopAutoRotate();
      return;
    }
    const hero = homeDirection.clone().applyAxisAngle(UP, 0.55);
    hero.y += 0.12;
    startTween(hero.normalize(), framing.current.distance * 0.94, 1.8, () => {
      const controls = controlsRef.current;
      if (controls && runtime.config.completion.orbit !== false) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.7;
        invalidate();
      }
    });
  }, [phase, homeDirection, startTween, stopAutoRotate, runtime, invalidate]);

  // Prioridad -2: antes de que OrbitControls (prioridad -1) aplique su amortiguación.
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const active = tween.current;
    if (active) {
      active.t = Math.min(1, active.t + delta / active.duration);
      const k = easeInOutCubic(active.t);
      temp.q.identity().slerp(active.rotation, k);
      temp.direction.copy(active.fromDirection).applyQuaternion(temp.q);
      camera.position
        .copy(runtime.anchor)
        .addScaledVector(temp.direction, MathUtils.lerp(active.fromDistance, active.toDistance, k));
      camera.lookAt(runtime.anchor);
      if (active.t >= 1) {
        tween.current = null;
        active.onDone?.();
      }
      invalidate();
    }

    const change = reframe.current;
    if (change) {
      change.t = Math.min(1, change.t + delta / REFRAME_SECONDS);
      const k = easeInOutCubic(change.t);
      applyViewOffset(MathUtils.lerp(change.fromX, change.toX, k), MathUtils.lerp(change.fromY, change.toY, k));
      if (change.ratio !== 1) {
        const desired = MathUtils.lerp(1, change.ratio, k);
        temp.offset.subVectors(camera.position, runtime.anchor).multiplyScalar(desired / change.applied);
        camera.position.copy(runtime.anchor).add(temp.offset);
        change.applied = desired;
      }
      if (change.t >= 1) {
        reframe.current = null;
        setZoomLimits(framing.current.distance, framing.current.distance);
      }
      invalidate();
    }
  }, -2);

  // Si el estudiante toma la cámara, se cancela cualquier animación automática.
  const handleStart = useCallback(() => {
    tween.current = null;
    stopAutoRotate();
  }, [stopAutoRotate]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.085}
      rotateSpeed={0.75}
      zoomSpeed={0.85}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI - 0.12}
      onStart={handleStart}
    />
  );
}

/** Luz principal pegada a la cámara: el modelo siempre se ve bien iluminado desde donde se mira. */
export function SceneLights({ runtime }: { runtime: PuzzleRuntime }) {
  const keyRef = useRef<DirectionalLight>(null);
  const rimRef = useRef<DirectionalLight>(null);
  const offsets = useMemo(
    () => ({ key: new Vector3(-0.55, 0.75, 0.6), rim: new Vector3(0.8, 0.25, -0.9), temp: new Vector3() }),
    [],
  );

  useFrame(({ camera }) => {
    const anchor = runtime.anchor;
    for (const [light, offset] of [
      [keyRef.current, offsets.key],
      [rimRef.current, offsets.rim],
    ] as const) {
      if (!light) continue;
      offsets.temp.copy(offset).applyQuaternion(camera.quaternion).multiplyScalar(10);
      light.position.copy(anchor).add(offsets.temp);
      light.target.position.copy(anchor);
      light.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfe8ff', '#1c2333', 0.55]} />
      <directionalLight ref={keyRef} intensity={2.1} color="#fff7ed" />
      <directionalLight ref={rimRef} intensity={0.9} color="#93c5fd" />
    </>
  );
}
