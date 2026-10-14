import { Canvas } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import type { PuzzleRuntime } from '../../engine/puzzleRuntime';
import type { PuzzleActions } from '../../hooks/usePuzzle';
import { usePuzzleInteraction } from '../../hooks/usePuzzleInteraction';
import type { InteractionStore } from '../../interaction/interactionStore';
import type { LayoutMetrics } from '../../interaction/layout';
import { computeModelRadius, pieceGeometryRadius } from '../../three/modelBounds';
import type { PuzzleState } from '../../types/puzzle';
import { PuzzleCamera, SceneLights } from './PuzzleCamera';
import { PuzzleModel } from './PuzzleModel';
import { PuzzlePiece } from './PuzzlePiece';

interface PuzzleSceneProps {
  runtime: PuzzleRuntime;
  state: PuzzleState;
  stateRef: RefObject<PuzzleState>;
  actions: PuzzleActions;
  store: InteractionStore;
  metrics: LayoutMetrics | null;
  resetViewSignal: number;
}

/**
 * Lienzo 3D. Renderizado bajo demanda: si nada se mueve no se dibuja
 * ningún frame (batería y temperatura del teléfono lo agradecen).
 * DPR limitado a 1.5, sin sombras ni post-procesado.
 */
export function PuzzleScene(props: PuzzleSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      camera={{ fov: 45, near: 0.05, far: 500, position: [0, 0, 10] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <SceneContents {...props} />
    </Canvas>
  );
}

function SceneContents({ runtime, state, stateRef, actions, store, metrics, resetViewSignal }: PuzzleSceneProps) {
  usePuzzleInteraction({ runtime, store, stateRef, actions });

  const modelRadius = useMemo(() => computeModelRadius(runtime), [runtime]);
  const sizeReference = useMemo(() => {
    if (runtime.interaction.normalizeTraySize) return null;
    return Math.max(
      ...runtime.pieces.map((p) => pieceGeometryRadius(runtime, p.id) * p.config.targetTransform.scale),
    );
  }, [runtime]);

  const event = state.lastEvent;
  return (
    <>
      <SceneLights runtime={runtime} />
      <PuzzleCamera
        runtime={runtime}
        metrics={metrics}
        modelRadius={modelRadius}
        store={store}
        phase={state.phase}
        resetViewSignal={resetViewSignal}
        session={state.session}
      />
      <PuzzleModel runtime={runtime} state={state} store={store} modelRadius={modelRadius} />
      {runtime.pieces.map((piece, index) => {
        const progress = state.pieces[piece.id];
        if (!progress) return null;
        return (
          <PuzzlePiece
            key={piece.id}
            runtime={runtime}
            piece={piece}
            status={progress.status}
            slotId={progress.slotId}
            selected={state.selectedPieceId === piece.id}
            phase={state.phase}
            trayIndex={Math.max(0, state.trayOrder.indexOf(piece.id))}
            celebrateIndex={index}
            rejectSeq={event?.type === 'rejected' && event.pieceId === piece.id ? event.seq : 0}
            store={store}
            sizeReference={sizeReference}
          />
        );
      })}
    </>
  );
}
