import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describeEvent, type FeedbackMessage } from '../../engine/feedback';
import { formatLabel } from '../../engine/labels';
import { getHintTarget, getMetrics, hintLimit } from '../../engine/puzzleState';
import { usePuzzle } from '../../hooks/usePuzzle';
import { useLayoutMetrics } from '../../hooks/useLayoutMetrics';
import { usePuzzleProgress } from '../../hooks/usePuzzleProgress';
import {
  createInteractionStore,
  resetInteraction,
  revealSlots,
  rotatePiece,
} from '../../interaction/interactionStore';
import type { Puzzle3DConfig, PuzzleAnalyticsEvent } from '../../types/puzzle';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { OptionsSheet } from '../UI/OptionsSheet';
import { PuzzleCompletion } from './PuzzleCompletion';
import { FeedbackToast, InfoCard, SelectionBar } from './PuzzleFeedback';
import { HintCard } from './PuzzleHint';
import { PuzzleHUD } from './PuzzleHUD';
import { PuzzleInstructions } from './PuzzleInstructions';
import { PuzzlePiecePanel, TrayBackdrop } from './PuzzlePiecePanel';
import { PuzzleScene } from './PuzzleScene';

interface PuzzleExperienceProps {
  config: Puzzle3DConfig;
  /** Eventos de aprendizaje (intentos, errores, pistas, tiempo) para un futuro backend. */
  onEvent?: (event: PuzzleAnalyticsEvent) => void;
  /** Volver al catálogo. Si se omite, no se ofrece (experiencia de un solo rompecabezas). */
  onExit?: () => void;
}

interface ToastState {
  id: number;
  message: FeedbackMessage;
}

interface InfoState {
  pieceId: string;
  title: string;
  key: number;
  collapsed: boolean;
}

const REVEAL_MS = 3600;

/** Vibración breve en móviles compatibles (Android). En el resto no hace nada. */
function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Algunos navegadores lo bloquean sin interacción previa: no es importante.
  }
}

/**
 * Experiencia completa de un rompecabezas. Compone el motor (usePuzzle),
 * la escena 3D y la interfaz. Funciona con CUALQUIER configuración.
 */
export function PuzzleExperience({ config, onEvent, onExit }: PuzzleExperienceProps) {
  const { runtime, state, actions } = usePuzzle(config);
  const progress = usePuzzleProgress(runtime, state, onEvent);
  const { labels } = runtime;

  const store = useMemo(() => createInteractionStore(), []);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const completionRef = useRef<HTMLElement>(null);

  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissedCompletionSession, setDismissedCompletionSession] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [info, setInfo] = useState<InfoState | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const noticeId = useRef(0);

  const showNotice = useCallback((message: FeedbackMessage) => {
    noticeId.current -= 1;
    setToast({ id: noticeId.current, message });
    setLiveMessage(message.body);
  }, []);

  // Traduce cada evento del motor en retroalimentación visible y anunciada.
  useEffect(() => {
    const event = state.lastEvent;
    if (!event) return;
    if (event.type === 'reset') {
      setToast(null);
      setInfo(null);
      return;
    }
    const message = describeEvent(runtime, event);
    if (!message) return;
    if (event.type === 'placed') haptic(event.completes ? [20, 60, 20, 60, 40] : 18);
    else if (event.type === 'rejected') haptic([12, 50, 12]);
    setLiveMessage([message.title, message.body].filter(Boolean).join('. '));
    const piece = runtime.pieceById.get(message.pieceId);
    if (event.type === 'placed' && runtime.profile.showInfoOnPlace && piece?.config.info) {
      setInfo({ pieceId: message.pieceId, title: message.title, key: event.seq, collapsed: false });
      setToast(null);
    } else {
      setToast({ id: event.seq, message });
    }
  }, [state.lastEvent, runtime]);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.message.tone === 'warning' ? 5200 : 2600;
    const timer = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), duration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!info || info.collapsed) return;
    const timer = window.setTimeout(
      () => setInfo((current) => (current && current.key === info.key ? { ...current, collapsed: true } : current)),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [info]);

  // Anunciar la pista y, en su último nivel, iluminar el lugar libre correcto.
  useEffect(() => {
    const hint = state.activeHint;
    if (!hint) return;
    setLiveMessage(`${labels.hint}: ${hint.text ?? labels.hintReveal}${hint.exhausted ? ` ${labels.hintExhausted}` : ''}`);
    if (!hint.revealZone) return;
    const piece = runtime.pieceById.get(hint.pieceId);
    if (!piece) return;
    const freeSlots = runtime.slots
      .filter((slot) => slot.group === piece.group && !stateRef.current.slots[slot.id])
      .map((slot) => slot.id);
    revealSlots(store, freeSlots, REVEAL_MS);
  }, [state.activeHint, runtime, store, labels]);

  useEffect(() => {
    if (state.session > 0) resetInteraction(store);
  }, [state.session, store]);

  const handleHint = useCallback(() => {
    const target = getHintTarget(stateRef.current);
    if (!target) {
      showNotice({ tone: 'neutral', title: '', body: labels.hintSelectPiece, pieceId: '' });
      return;
    }
    actions.requestHint(target);
  }, [actions, labels, showNotice]);

  const rotate = useCallback(
    (pieceId: string) => {
      if (!runtime.interaction.allowRotation) return;
      rotatePiece(store, pieceId, runtime.interaction.rotationStep, runtime.interaction.rotationAxis);
    },
    [runtime, store],
  );

  const restart = useCallback(() => {
    setConfirmOpen(false);
    setMenuOpen(false);
    actions.reset();
  }, [actions]);

  const requestRestart = useCallback(() => {
    const current = stateRef.current;
    if (current.attempts > 0 || current.hintsUsed > 0) setConfirmOpen(true);
    else restart();
  }, [restart]);

  const toggleSelect = useCallback(
    (pieceId: string) => actions.select(stateRef.current.selectedPieceId === pieceId ? null : pieceId),
    [actions],
  );

  // Apuntar con teclado: el lugar elegido se resalta en 3D (store) y se anuncia (aria-live).
  const [aimSlotId, setAimSlotId] = useState<string | null>(null);
  const aimRef = useRef<string | null>(null);
  const setAim = useCallback(
    (slotId: string | null) => {
      aimRef.current = slotId;
      store.aimSlotId = slotId;
      store.requestFrame();
      setAimSlotId(slotId);
    },
    [store],
  );
  useEffect(() => {
    setAim(null);
  }, [state.selectedPieceId, state.draggingPieceId, state.phase, state.session, setAim]);

  // Teclado: Escape suelta/cierra; R gira; flechas eligen lugar; Enter coloca.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current;
      const selected = current.selectedPieceId;
      if (event.key === 'Escape') {
        if (aimRef.current) setAim(null);
        else if (current.activeHint) actions.dismissHint();
        else if (selected && !current.draggingPieceId) actions.select(null);
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        const pieceId = current.draggingPieceId ?? selected;
        if (pieceId) rotate(pieceId);
        return;
      }
      if (!selected || current.draggingPieceId || current.phase !== 'playing') return;
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      if (forward || event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const ids = runtime.slots.map((slot) => slot.id);
        const index = aimRef.current ? ids.indexOf(aimRef.current) : -1;
        const next = index < 0 ? (forward ? 0 : ids.length - 1) : (index + (forward ? 1 : -1) + ids.length) % ids.length;
        const slotId = ids[next] ?? null;
        setAim(slotId);
        const description = slotId
          ? (runtime.slotById.get(slotId)?.decoy?.description ??
            runtime.pieceById.get(slotId)?.config.feedback?.zoneDescription)
          : undefined;
        setLiveMessage(
          [formatLabel(labels.aimAnnounce, { index: next + 1, total: ids.length }), description].filter(Boolean).join('. '),
        );
      } else if (event.key === 'Enter' && aimRef.current) {
        event.preventDefault();
        store.controller?.placeAtSlot(selected, aimRef.current);
        setAim(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, rotate, runtime, labels, store, setAim]);

  const selectedPiece = state.selectedPieceId ? runtime.pieceById.get(state.selectedPieceId) : undefined;
  const hintPiece = state.activeHint ? runtime.pieceById.get(state.activeHint.pieceId) : undefined;
  const infoPiece = info ? runtime.pieceById.get(info.pieceId) : undefined;
  const dragging = state.draggingPieceId !== null;
  const completionOpen = state.phase === 'completed' && dismissedCompletionSession !== state.session;
  // Con la tarjeta final abierta, la cámara reencuadra el modelo en el espacio que queda libre.
  const metrics = useLayoutMetrics(
    rootRef,
    hudRef,
    trayRef,
    `${state.trayOrder.join('|')}#${completionOpen ? 'completion' : ''}`,
    completionRef,
  );
  const progressText = formatLabel(labels.progress, { placed: progress.placed, total: progress.total });

  let bottomContent = null;
  if (!dragging && state.phase === 'playing' && selectedPiece) {
    bottomContent = (
      <SelectionBar
        key={`sel-${selectedPiece.id}`}
        piece={selectedPiece}
        labels={labels}
        helpText={aimSlotId ? labels.aimHelp : labels.selectedHelp}
        canRotate={runtime.interaction.allowRotation}
        onRotate={() => rotate(selectedPiece.id)}
        onHint={() => actions.requestHint(selectedPiece.id)}
        onClose={() => actions.select(null)}
      />
    );
  } else if (!dragging && info && infoPiece && !completionOpen) {
    bottomContent = (
      <InfoCard
        key={`info-${info.key}-${info.collapsed ? 'c' : 'e'}`}
        piece={infoPiece}
        title={info.title}
        collapsed={info.collapsed}
        labels={labels}
        onExpand={() => setInfo((current) => (current ? { ...current, collapsed: false } : current))}
        onCollapse={() => setInfo((current) => (current ? { ...current, collapsed: true } : current))}
      />
    );
  }

  return (
    <div ref={rootRef} className="app-background relative h-dvh w-full overflow-hidden text-slate-100 select-none">
      <div className="app-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <TrayBackdrop metrics={metrics} state={state} />

      <div className="absolute inset-0 z-10">
        <PuzzleScene
          runtime={runtime}
          state={state}
          stateRef={stateRef}
          actions={actions}
          store={store}
          metrics={metrics}
          resetViewSignal={resetViewSignal}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] landscape-short:grid-cols-[minmax(0,1fr)_auto] landscape-short:grid-rows-[auto_minmax(0,1fr)]">
        <PuzzleHUD
          ref={hudRef}
          icon={config.icon}
          title={config.title}
          placed={progress.placed}
          total={progress.total}
          progressText={progressText}
          completed={progress.isComplete}
          labels={labels}
          onHint={handleHint}
          onResetView={() => setResetViewSignal((n) => n + 1)}
          onRestart={requestRestart}
          onMenu={onExit ? () => setMenuOpen(true) : undefined}
        />

        <div className="relative col-start-1 row-start-2 min-h-0">
          <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-3 pt-1">
            {toast && <FeedbackToast key={toast.id} message={toast.message} />}
            {state.activeHint && hintPiece && state.phase === 'playing' && (
              <HintCard
                key={state.activeHint.seq}
                hint={state.activeHint}
                piece={hintPiece}
                limit={hintLimit(runtime, hintPiece)}
                labels={labels}
                onClose={actions.dismissHint}
              />
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-2">{bottomContent}</div>
        </div>

        <PuzzlePiecePanel ref={trayRef} runtime={runtime} state={state} store={store} onToggleSelect={toggleSelect} />
      </div>

      {state.phase === 'intro' && (
        <PuzzleInstructions config={config} labels={labels} onStart={actions.start} onExit={onExit} />
      )}

      {completionOpen && (
        <PuzzleCompletion
          ref={completionRef}
          runtime={runtime}
          metrics={getMetrics(runtime, state, state.completedAt ?? Date.now())}
          onExplore={() => setDismissedCompletionSession(state.session)}
          onRestart={restart}
          onExit={onExit}
        />
      )}

      {menuOpen && onExit && (
        <OptionsSheet
          title={labels.menu}
          cancelLabel={labels.cancel}
          onClose={() => setMenuOpen(false)}
          options={[
            { icon: 'restart', title: labels.restart, description: labels.restartConfirmBody, onSelect: restart },
            { icon: 'grid', title: labels.exitToCatalog, onSelect: onExit },
          ]}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={labels.restartConfirmTitle}
          body={labels.restartConfirmBody}
          confirmLabel={labels.confirmRestart}
          cancelLabel={labels.cancel}
          onConfirm={restart}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </div>
  );
}
