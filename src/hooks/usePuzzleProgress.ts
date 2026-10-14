import { useCallback, useEffect, useRef } from 'react';
import type { PuzzleRuntime } from '../engine/puzzleRuntime';
import { countPlaced, getMetrics } from '../engine/puzzleState';
import type { PuzzleAnalyticsEvent, PuzzleState } from '../types/puzzle';

/**
 * Progreso derivado + emisión de eventos de aprendizaje (intentos,
 * errores, pistas, tiempo). `onEvent` es el punto de enganche para un
 * futuro backend o LMS; hoy basta con escucharlo o dejarlo vacío.
 */
export function usePuzzleProgress(
  runtime: PuzzleRuntime,
  state: PuzzleState,
  onEvent?: (event: PuzzleAnalyticsEvent) => void,
) {
  const placed = countPlaced(runtime, state);
  const total = runtime.draggableIds.length;
  const puzzleId = runtime.config.id;

  const onEventRef = useRef(onEvent);
  const stateRef = useRef(state);
  useEffect(() => {
    onEventRef.current = onEvent;
    stateRef.current = state;
  });

  // Inicio: transición de la introducción al juego.
  const previousPhase = useRef(state.phase);
  useEffect(() => {
    if (previousPhase.current === 'intro' && state.phase === 'playing' && state.startedAt !== null) {
      onEventRef.current?.({ type: 'started', puzzleId, at: state.startedAt });
    }
    previousPhase.current = state.phase;
  }, [state.phase, state.startedAt, puzzleId]);

  // Un aviso por evento del motor (el reducer solo crea un `lastEvent` nuevo cuando ocurre algo).
  useEffect(() => {
    const event = state.lastEvent;
    const emit = onEventRef.current;
    if (!event || !emit) return;
    const now = Date.now();
    switch (event.type) {
      case 'placed': {
        const metrics = getMetrics(runtime, stateRef.current, now);
        emit({ type: 'piece-placed', puzzleId, pieceId: event.pieceId, at: now, metrics });
        if (event.completes) emit({ type: 'completed', puzzleId, at: now, metrics });
        break;
      }
      case 'rejected':
        emit({ type: 'mistake', puzzleId, pieceId: event.pieceId, reason: event.reason, at: now });
        break;
      case 'hint':
        emit({ type: 'hint', puzzleId, pieceId: event.pieceId, level: event.level, at: now });
        break;
      case 'reset':
        emit({ type: 'reset', puzzleId, at: now });
        break;
      case 'missed':
        break;
    }
  }, [state.lastEvent, puzzleId, runtime]);

  const getMetricsNow = useCallback(() => getMetrics(runtime, stateRef.current, Date.now()), [runtime]);

  return {
    placed,
    total,
    ratio: total > 0 ? placed / total : 1,
    isComplete: state.phase === 'completed',
    getMetricsNow,
  };
}
