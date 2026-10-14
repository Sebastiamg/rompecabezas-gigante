import type {
  DropContext,
  PieceProgress,
  PuzzleMetrics,
  PuzzlePhase,
  PuzzleState,
} from '../types/puzzle';
import type { PuzzleRuntime, RuntimePiece } from './puzzleRuntime';
import { seededShuffle } from './puzzleUtils';
import { evaluateDrop } from './puzzleValidator';

/**
 * Estado lógico del rompecabezas: reducer puro, sin three.js ni React.
 * Solo cambia ante eventos discretos (seleccionar, soltar, pedir pista...),
 * nunca en cada frame: las posiciones durante el arrastre viven en refs.
 */

export type PuzzleAction =
  | { type: 'start'; now: number }
  | { type: 'select'; pieceId: string | null }
  | { type: 'drag-start'; pieceId: string }
  | { type: 'drag-cancel'; pieceId: string }
  | { type: 'drop'; pieceId: string; context: DropContext; now: number }
  | { type: 'hint'; pieceId: string }
  | { type: 'dismiss-hint' }
  | { type: 'reset'; seed: number; now: number };

export function createInitialState(
  runtime: PuzzleRuntime,
  seed = 1,
  session = 0,
  phase: PuzzlePhase = 'intro',
): PuzzleState {
  const pieces: Record<string, PieceProgress> = {};
  const slots: Record<string, string | null> = {};
  for (const piece of runtime.pieces) {
    const fixed = !piece.draggable;
    pieces[piece.id] = {
      status: fixed ? 'placed' : 'tray',
      slotId: fixed ? piece.id : null,
      attempts: 0,
      mistakes: 0,
      hintLevel: 0,
      placedAt: null,
    };
    slots[piece.id] = fixed ? piece.id : null;
  }
  const trayIds = runtime.draggableIds;
  return {
    phase,
    pieces,
    slots,
    trayOrder: runtime.interaction.shuffleTray ? seededShuffle(trayIds, seed) : [...trayIds],
    selectedPieceId: null,
    draggingPieceId: null,
    attempts: 0,
    mistakes: 0,
    hintsUsed: 0,
    activeHint: null,
    startedAt: null,
    completedAt: null,
    lastEvent: null,
    seq: 0,
    session,
  };
}

/** ¿Puede el estudiante tomar esta pieza ahora? */
export function canPickPiece(runtime: PuzzleRuntime, state: PuzzleState, pieceId: string): boolean {
  const piece = runtime.pieceById.get(pieceId);
  const progress = state.pieces[pieceId];
  if (!piece || !progress || !piece.draggable || state.phase !== 'playing') return false;
  return progress.status !== 'placed' || !piece.lockOnPlace;
}

function withPiece(state: PuzzleState, pieceId: string, patch: Partial<PieceProgress>): PuzzleState['pieces'] {
  const prev = state.pieces[pieceId];
  if (!prev) return state.pieces;
  return { ...state.pieces, [pieceId]: { ...prev, ...patch } };
}

/** Número de niveles de pista disponibles para una pieza según la dificultad. */
export function hintLimit(runtime: PuzzleRuntime, piece: RuntimePiece): number {
  const levels = piece.hints.length + (runtime.profile.revealZoneAfterHints ? 1 : 0);
  return Math.min(runtime.profile.maxHintsPerPiece, levels);
}

export function puzzleReducer(runtime: PuzzleRuntime, state: PuzzleState, action: PuzzleAction): PuzzleState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'intro') return state;
      return { ...state, phase: 'playing', startedAt: action.now };

    case 'select': {
      if (action.pieceId === state.selectedPieceId) return state;
      if (action.pieceId !== null && !canPickPiece(runtime, state, action.pieceId)) return state;
      const keepHint = action.pieceId === null || state.activeHint?.pieceId === action.pieceId;
      return { ...state, selectedPieceId: action.pieceId, activeHint: keepHint ? state.activeHint : null };
    }

    case 'drag-start': {
      const { pieceId } = action;
      if (!canPickPiece(runtime, state, pieceId)) return state;
      const prev = state.pieces[pieceId];
      if (!prev) return state;
      // Sacar una pieza ya colocada (solo si lockOnPlace = false) libera su lugar.
      const slots = prev.slotId ? { ...state.slots, [prev.slotId]: null } : state.slots;
      return {
        ...state,
        pieces: withPiece(state, pieceId, { status: 'dragging', slotId: null }),
        slots,
        draggingPieceId: pieceId,
        selectedPieceId: pieceId,
        activeHint: state.activeHint?.pieceId === pieceId ? state.activeHint : null,
      };
    }

    case 'drag-cancel': {
      if (state.draggingPieceId !== action.pieceId) return state;
      return {
        ...state,
        pieces: withPiece(state, action.pieceId, { status: 'tray' }),
        draggingPieceId: null,
        selectedPieceId: null,
      };
    }

    case 'drop': {
      const { pieceId, now } = action;
      const prev = state.pieces[pieceId];
      if (!prev || state.phase !== 'playing' || prev.status === 'placed') return state;
      const outcome = evaluateDrop(runtime, state, pieceId, action.context);
      const seq = state.seq + 1;
      const base = { ...state, draggingPieceId: null, selectedPieceId: null, seq };

      if (outcome.kind === 'missed') {
        return {
          ...base,
          pieces: withPiece(state, pieceId, { status: 'tray' }),
          lastEvent: { seq, type: 'missed', pieceId },
        };
      }
      if (outcome.kind === 'rejected') {
        return {
          ...base,
          pieces: withPiece(state, pieceId, {
            status: 'tray',
            attempts: prev.attempts + 1,
            mistakes: prev.mistakes + 1,
          }),
          attempts: state.attempts + 1,
          mistakes: state.mistakes + 1,
          lastEvent: {
            seq,
            type: 'rejected',
            pieceId,
            reason: outcome.reason,
            zoneSlotId: outcome.zoneSlotId,
            missing: outcome.missing,
          },
        };
      }
      const pieces = withPiece(state, pieceId, {
        status: 'placed',
        slotId: outcome.slotId,
        attempts: prev.attempts + 1,
        placedAt: now,
      });
      const completes = runtime.draggableIds.every((id) => pieces[id]?.status === 'placed');
      return {
        ...base,
        pieces,
        slots: { ...state.slots, [outcome.slotId]: pieceId },
        attempts: state.attempts + 1,
        activeHint: state.activeHint?.pieceId === pieceId ? null : state.activeHint,
        phase: completes ? 'completed' : state.phase,
        completedAt: completes ? now : state.completedAt,
        lastEvent: { seq, type: 'placed', pieceId, slotId: outcome.slotId, completes },
      };
    }

    case 'hint': {
      const { pieceId } = action;
      const piece = runtime.pieceById.get(pieceId);
      const prev = state.pieces[pieceId];
      if (!piece || !prev || state.phase !== 'playing' || prev.status === 'placed') return state;
      const seq = state.seq + 1;
      const textCount = piece.hints.length;
      const limit = hintLimit(runtime, piece);

      if (prev.hintLevel >= limit) {
        // Agotadas: se vuelve a mostrar la última ayuda, sin contarla otra vez.
        const lastText = textCount > 0 ? (piece.hints[Math.min(prev.hintLevel, textCount) - 1] ?? null) : null;
        return {
          ...state,
          seq,
          activeHint: {
            pieceId,
            level: prev.hintLevel,
            text: lastText,
            revealZone: prev.hintLevel > textCount,
            exhausted: true,
            seq,
          },
        };
      }
      const level = prev.hintLevel + 1;
      const revealZone = level > textCount;
      return {
        ...state,
        seq,
        pieces: withPiece(state, pieceId, { hintLevel: level }),
        hintsUsed: state.hintsUsed + 1,
        activeHint: {
          pieceId,
          level,
          text: revealZone ? null : (piece.hints[level - 1] ?? null),
          revealZone,
          exhausted: false,
          seq,
        },
        lastEvent: { seq, type: 'hint', pieceId, level },
      };
    }

    case 'dismiss-hint':
      return state.activeHint ? { ...state, activeHint: null } : state;

    case 'reset': {
      const phase = state.phase === 'intro' ? 'intro' : 'playing';
      const next = createInitialState(runtime, action.seed, state.session + 1, phase);
      const seq = state.seq + 1;
      return {
        ...next,
        startedAt: phase === 'playing' ? action.now : null,
        lastEvent: { seq, type: 'reset' },
        seq,
      };
    }
  }
}

// ─── Selectores ──────────────────────────────────────────────────────

export function countPlaced(runtime: PuzzleRuntime, state: PuzzleState): number {
  return runtime.draggableIds.filter((id) => state.pieces[id]?.status === 'placed').length;
}

export function getMetrics(runtime: PuzzleRuntime, state: PuzzleState, now: number): PuzzleMetrics {
  const perPiece: Record<string, { attempts: number; mistakes: number; hintsUsed: number }> = {};
  for (const id of runtime.draggableIds) {
    const p = state.pieces[id];
    if (p) perPiece[id] = { attempts: p.attempts, mistakes: p.mistakes, hintsUsed: p.hintLevel };
  }
  const end = state.completedAt ?? now;
  return {
    attempts: state.attempts,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    completedPieces: countPlaced(runtime, state),
    totalPieces: runtime.draggableIds.length,
    elapsedMs: state.startedAt ? end - state.startedAt : 0,
    perPiece,
  };
}

/**
 * Pieza a la que se refiere el botón "Pista": la seleccionada o, si no
 * hay, la última que el estudiante intentó colocar sin éxito.
 */
export function getHintTarget(state: PuzzleState): string | null {
  if (state.selectedPieceId) return state.selectedPieceId;
  const event = state.lastEvent;
  if (event && (event.type === 'rejected' || event.type === 'missed' || event.type === 'hint')) {
    return state.pieces[event.pieceId]?.status === 'placed' ? null : event.pieceId;
  }
  return null;
}
