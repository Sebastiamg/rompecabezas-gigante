import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import { Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import type { PuzzleRuntime } from '../engine/puzzleRuntime';
import { canPickPiece } from '../engine/puzzleState';
import { quatToTuple, toVector3, vecToTuple } from '../engine/puzzleUtils';
import { findZoneAt, zoneSamplePoint } from '../engine/puzzleValidator';
import { getUserRotation, type InteractionStore, type PointerLike } from '../interaction/interactionStore';
import { trayBaseQuaternion } from '../interaction/trayOrientation';
import type { DropContext, PuzzleState } from '../types/puzzle';
import type { PuzzleActions } from './usePuzzle';

/** En táctil la pieza se dibuja por encima del dedo para que la mano no la tape. */
const TOUCH_LIFT_PX = 64;
/** Movimiento mínimo (px) para que un toque se convierta en arrastre. */
const DRAG_THRESHOLD: Record<string, number> = { mouse: 4, pen: 6, touch: 9 };
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 450;

interface ControlsLike {
  enabled: boolean;
}

interface Options {
  runtime: PuzzleRuntime;
  store: InteractionStore;
  stateRef: RefObject<PuzzleState>;
  actions: PuzzleActions;
}

/**
 * Interacción 3D basada en pointer events (ratón, dedo y lápiz por igual):
 *
 * 1. pointerdown en el hueco HTML de una pieza → `store.controller.begin()`.
 * 2. Si el puntero se mueve más que el umbral → arrastre: listeners en
 *    `window` (siguen funcionando aunque el dedo salga del lienzo).
 * 3. Cada movimiento: rayo cámara→puntero. La pieza se coloca sobre ese
 *    rayo a profundidad fija delante del modelo (nunca queda oculta) y el
 *    punto de suelta es la intersección del rayo con el plano de arrastre.
 * 4. pointerup → el motor valida. Sin movimiento = toque = seleccionar.
 *
 * Mientras hay una pieza en la mano los OrbitControls se desactivan, así
 * cámara y pieza nunca compiten por el mismo gesto. Todo se escribe en el
 * store mutable: React solo se entera de los eventos discretos.
 */
export function usePuzzleInteraction({ runtime, store, stateRef, actions }: Options): void {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  const tools = useMemo(
    () => ({
      raycaster: new Raycaster(),
      ndc: new Vector2(),
      plane: new Plane(),
      normal: new Vector3(),
      point: new Vector3(),
      quaternion: new Quaternion(),
    }),
    [],
  );

  useEffect(() => {
    store.requestFrame = () => invalidate();
    return () => {
      store.requestFrame = () => {};
    };
  }, [store, invalidate]);

  useEffect(() => {
    const { raycaster, ndc, plane, normal, point, quaternion } = tools;
    const canvas = gl.domElement;
    const drag = store.drag;
    let startX = 0;
    let startY = 0;

    const setNdc = (clientX: number, clientY: number, liftPx: number) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - liftPx - rect.top) / rect.height) * 2 + 1);
    };

    const intersectDragPlane = (out: Vector3): boolean => {
      const dragPlane = runtime.interaction.dragPlane;
      if (dragPlane.type === 'fixed') toVector3(dragPlane.normal, normal).normalize();
      else camera.getWorldDirection(normal).negate();
      plane.setFromNormalAndCoplanarPoint(normal, runtime.anchor);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, out) !== null;
    };

    const updateDrag = (clientX: number, clientY: number) => {
      setNdc(clientX, clientY, drag.pointerType === 'touch' ? TOUCH_LIFT_PX : 0);
      drag.view.set(ndc.x, ndc.y, 0.5).applyMatrix4(camera.projectionMatrixInverse);
      drag.view.multiplyScalar(store.trayDepth / -drag.view.z);
      drag.worldValid = intersectDragPlane(drag.world);
      drag.hoverSlotId = drag.worldValid ? (findZoneAt(runtime, drag.world)?.slot.id ?? null) : null;
    };

    const dropContext = (pieceId: string, worldPoint: Vector3): DropContext => {
      // Orientación en el mundo = cámara × giro del estudiante × reposo en bandeja.
      quaternion
        .copy(camera.quaternion)
        .multiply(getUserRotation(store, pieceId))
        .multiply(trayBaseQuaternion(runtime, pieceId));
      return { point: vecToTuple(worldPoint), quaternion: quatToTuple(quaternion), scale: 1 };
    };

    const isOverTray = (clientX: number, clientY: number) => {
      const tray = store.trayRect;
      if (!tray) return false;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return x >= tray.x && x <= tray.x + tray.width && y >= tray.y && y <= tray.y + tray.height;
    };

    const setControlsEnabled = (enabled: boolean) => {
      if (controls) controls.enabled = enabled;
    };

    function finish() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      drag.pressed = false;
      drag.active = false;
      drag.pieceId = null;
      drag.pointerId = null;
      drag.hoverSlotId = null;
      drag.worldValid = false;
      setControlsEnabled(true);
      invalidate();
    }

    function cancelActiveDrag() {
      if (drag.pieceId && drag.active) actions.cancelDrag(drag.pieceId);
      finish();
    }

    function onMove(event: PointerEvent) {
      if (event.pointerId !== drag.pointerId || !drag.pieceId) return;
      if (!drag.active) {
        const threshold = DRAG_THRESHOLD[event.pointerType] ?? 6;
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < threshold) return;
        drag.active = true;
        actions.beginDrag(drag.pieceId);
      }
      updateDrag(event.clientX, event.clientY);
      invalidate();
    }

    function onUp(event: PointerEvent) {
      if (event.pointerId !== drag.pointerId) return;
      const pieceId = drag.pieceId;
      if (pieceId && drag.active) {
        updateDrag(event.clientX, event.clientY);
        // Soltar sobre la bandeja = devolver la pieza sin contar intento.
        if (isOverTray(event.clientX, event.clientY) || !drag.worldValid) actions.cancelDrag(pieceId);
        else actions.drop(pieceId, dropContext(pieceId, drag.world));
      } else if (pieceId) {
        actions.select(stateRef.current?.selectedPieceId === pieceId ? null : pieceId);
      }
      finish();
    }

    function onCancel(event: PointerEvent) {
      if (event.pointerId === drag.pointerId) cancelActiveDrag();
    }

    const begin = (pieceId: string, pointer: PointerLike) => {
      const state = stateRef.current;
      if (!state || drag.pressed || !canPickPiece(runtime, state, pieceId)) return;
      drag.pieceId = pieceId;
      drag.pointerId = pointer.pointerId;
      drag.pointerType = pointer.pointerType;
      drag.pressed = true;
      drag.active = false;
      drag.worldValid = false;
      drag.hoverSlotId = null;
      startX = pointer.clientX;
      startY = pointer.clientY;
      setControlsEnabled(false);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      invalidate();
    };
    const placeAtSlot = (pieceId: string, slotId: string) => {
      const state = stateRef.current;
      const slot = runtime.slotById.get(slotId);
      if (!state || !slot || drag.pressed || !canPickPiece(runtime, state, pieceId)) return;
      actions.drop(pieceId, dropContext(pieceId, zoneSamplePoint(slot.zone, point)));
    };
    store.controller = { begin, placeAtSlot };

    // Alternativa sin arrastre: con una pieza seleccionada, tocar el modelo la intenta colocar ahí.
    let tap: { x: number; y: number; time: number; id: number } | null = null;
    const onCanvasDown = (event: PointerEvent) => {
      tap = event.isPrimary ? { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId } : null;
    };
    const onCanvasUp = (event: PointerEvent) => {
      const start = tap;
      tap = null;
      if (!start || event.pointerId !== start.id || drag.pressed) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_MOVE_PX) return;
      if (performance.now() - start.time > TAP_MAX_MS) return;
      const state = stateRef.current;
      const pieceId = state?.selectedPieceId;
      if (!state || !pieceId || state.phase !== 'playing') return;
      setNdc(event.clientX, event.clientY, 0);
      if (!intersectDragPlane(point) || !findZoneAt(runtime, point)) {
        actions.select(null); // tocar fuera del modelo = soltar la selección
        return;
      }
      actions.drop(pieceId, dropContext(pieceId, point));
    };
    const onVisibilityChange = () => {
      if (document.hidden && drag.pressed) cancelActiveDrag();
    };

    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointerup', onCanvasUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      store.controller = null;
      canvas.removeEventListener('pointerdown', onCanvasDown);
      canvas.removeEventListener('pointerup', onCanvasUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (drag.pressed) cancelActiveDrag();
    };
  }, [runtime, store, stateRef, actions, camera, gl, invalidate, controls, tools]);
}
