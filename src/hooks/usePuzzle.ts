import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { buildRuntime } from '../engine/puzzleRuntime';
import { createInitialState, puzzleReducer, type PuzzleAction } from '../engine/puzzleState';
import type { DropContext, Puzzle3DConfig, PuzzleState } from '../types/puzzle';

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

/**
 * Estado y acciones de un rompecabezas. Genérico: recibe cualquier
 * configuración. (Si cambia la configuración, monta de nuevo el
 * componente con `key={config.id}` para empezar con estado limpio.)
 */
export function usePuzzle(config: Puzzle3DConfig) {
  const runtime = useMemo(() => buildRuntime(config), [config]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    for (const warning of runtime.warnings) console.warn(`[rompecabezas:${config.id}] ${warning}`);
  }, [runtime, config.id]);

  const reducer = useCallback(
    (state: PuzzleState, action: PuzzleAction) => puzzleReducer(runtime, state, action),
    [runtime],
  );
  const [state, dispatch] = useReducer(reducer, runtime, (rt) => createInitialState(rt, randomSeed()));

  const actions = useMemo(
    () => ({
      start: () => dispatch({ type: 'start', now: Date.now() }),
      select: (pieceId: string | null) => dispatch({ type: 'select', pieceId }),
      beginDrag: (pieceId: string) => dispatch({ type: 'drag-start', pieceId }),
      cancelDrag: (pieceId: string) => dispatch({ type: 'drag-cancel', pieceId }),
      drop: (pieceId: string, context: DropContext) => dispatch({ type: 'drop', pieceId, context, now: Date.now() }),
      requestHint: (pieceId: string) => dispatch({ type: 'hint', pieceId }),
      dismissHint: () => dispatch({ type: 'dismiss-hint' }),
      reset: () => dispatch({ type: 'reset', seed: randomSeed(), now: Date.now() }),
    }),
    [],
  );

  return { runtime, state, actions };
}

export type PuzzleActions = ReturnType<typeof usePuzzle>['actions'];
