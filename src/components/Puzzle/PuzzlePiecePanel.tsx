import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref, type RefObject } from 'react';
import { formatLabel } from '../../engine/labels';
import type { PuzzleRuntime, RuntimePiece } from '../../engine/puzzleRuntime';
import type { InteractionStore } from '../../interaction/interactionStore';
import type { LayoutMetrics } from '../../interaction/layout';
import type { PieceProgress, PuzzleLabels, PuzzleState } from '../../types/puzzle';
import { Icon } from '../UI/Icon';

interface PuzzlePiecePanelProps {
  ref?: Ref<HTMLElement>;
  runtime: PuzzleRuntime;
  state: PuzzleState;
  store: InteractionStore;
  onToggleSelect: (pieceId: string) => void;
}

/**
 * Bandeja de piezas. Cada hueco es un botón HTML transparente: debajo
 * se ve la pieza 3D real (el lienzo está detrás). Al presionar, el motor
 * 3D toma el control del gesto, así que arrastrar "desde el panel hacia
 * la escena" funciona igual con dedo, ratón o lápiz.
 */
/** Misma condición que la variante CSS `landscape-short`: bandeja en columna lateral. */
const SIDE_TRAY_QUERY = '(orientation: landscape) and (max-height: 560px)';
const SLOT_GAP = 4;
const LABEL_HEIGHT = 30;
const MAX_SLOT = 100;

/**
 * Columnas equilibradas: con 8 piezas en un teléfono → 4 + 4 (no 5 + 3), y
 * todas del mismo tamaño. Usa el ancho real de la bandeja y, si está en una
 * columna lateral (móvil horizontal), también su alto: añade columnas hasta
 * que todas las filas quepan en pantalla.
 */
function useBalancedColumns(ref: RefObject<HTMLElement | null>, count: number): number {
  const [box, setBox] = useState({ width: 0, height: Number.POSITIVE_INFINITY });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const side = window.matchMedia(SIDE_TRAY_QUERY);
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const height = side.matches ? window.innerHeight - rect.top - 10 : Number.POSITIVE_INFINITY;
      setBox((prev) => (prev.width === rect.width && prev.height === height ? prev : { width: rect.width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    side.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      side.removeEventListener('change', measure);
    };
  }, [ref]);

  if (count <= 0) return 1;
  const { width, height } = box;
  const minSlot = width >= 600 ? 96 : 64;
  const maxColumns = width > 0 ? Math.max(1, Math.floor((width + SLOT_GAP) / (minSlot + SLOT_GAP))) : Math.min(count, 4);
  let columns = Math.ceil(count / Math.ceil(count / maxColumns));
  while (columns < count && width > 0) {
    const slot = Math.min(MAX_SLOT, (width - SLOT_GAP * (columns - 1)) / columns);
    if (Math.ceil(count / columns) * (slot + LABEL_HEIGHT) <= height) break;
    columns++;
  }
  return Math.ceil(count / Math.ceil(count / columns));
}

export function PuzzlePiecePanel({ ref, runtime, state, store, onToggleSelect }: PuzzlePiecePanelProps) {
  const { labels } = runtime;
  const listRef = useRef<HTMLUListElement>(null);
  const columns = useBalancedColumns(listRef, state.trayOrder.length);
  const draggingName = state.draggingPieceId ? runtime.pieceById.get(state.draggingPieceId)?.config.name : null;
  return (
    <section
      ref={ref}
      aria-label={labels.trayTitle}
      className="pointer-events-auto col-start-1 row-start-3 safe-bottom safe-x pt-1.5 landscape-short:col-start-2 landscape-short:row-start-2 landscape-short:w-[min(50vw,400px)] landscape-short:pt-2"
    >
      <div className="mx-auto max-w-xl sm:max-w-2xl">
        <div className="flex items-baseline justify-between gap-3 px-1 pb-0.5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-accent">{labels.trayTitle}</h2>
          <p className="truncate text-[11px] text-slate-400" aria-live="polite">
            {draggingName ? formatLabel(labels.dragging, { name: draggingName }) : labels.trayHint}
          </p>
        </div>
        <ul
          ref={listRef}
          className="grid gap-x-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {state.trayOrder.map((id) => {
            const piece = runtime.pieceById.get(id);
            const progress = state.pieces[id];
            if (!piece || !progress) return null;
            return (
              <TraySlot
                key={id}
                piece={piece}
                progress={progress}
                selected={state.selectedPieceId === id}
                interactive={state.phase === 'playing'}
                compact={columns >= 5}
                store={store}
                labels={labels}
                onToggleSelect={onToggleSelect}
              />
            );
          })}
        </ul>
        <p id="tray-keyboard-help" className="sr-only">
          {labels.keyboardHelp}
        </p>
      </div>
    </section>
  );
}

interface TraySlotProps {
  piece: RuntimePiece;
  progress: PieceProgress;
  selected: boolean;
  interactive: boolean;
  /** Muchas columnas en poco ancho: letra algo menor para que quepan los nombres. */
  compact: boolean;
  store: InteractionStore;
  labels: PuzzleLabels;
  onToggleSelect: (pieceId: string) => void;
}

function TraySlot({ piece, progress, selected, interactive, compact, store, labels, onToggleSelect }: TraySlotProps) {
  const placed = progress.status === 'placed';
  const locked = (placed && piece.lockOnPlace) || !interactive;
  const name = piece.config.name;
  const label = piece.config.shortName ?? name;

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (locked || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    store.controller?.begin(piece.id, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    });
  };
  const setHover = (hovered: boolean) => {
    if (hovered) store.hoverTrayId = piece.id;
    else if (store.hoverTrayId === piece.id) store.hoverTrayId = null;
    store.requestFrame();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (locked) return;
    // Apuntando con flechas: Enter coloca la pieza (lo gestiona la experiencia), no la deselecciona.
    if (event.key === 'Enter' && selected && store.aimSlotId) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleSelect(piece.id);
    }
  };

  return (
    <li className="flex min-w-0 justify-center">
      <button
        type="button"
        aria-label={placed ? `${name}: ${labels.placedBadge}` : name}
        aria-pressed={selected}
        aria-disabled={locked || undefined}
        aria-describedby="tray-keyboard-help"
        onPointerDown={handlePointerDown}
        onPointerEnter={(event) => event.pointerType === 'mouse' && !locked && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onKeyDown={handleKeyDown}
        className={`touch-drag group relative flex w-full max-w-[100px] flex-col items-center sm:max-w-[124px] rounded-2xl pb-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {/* Área donde se dibuja la pieza 3D (medida por la escena). */}
        <span data-tray-slot={piece.id} className="relative block aspect-square w-full max-w-[76px] sm:max-w-[96px] landscape-short:max-w-[76px]">
          {placed && (
            <span className="absolute inset-[14%] grid place-items-center rounded-full border border-dashed border-emerald-300/40 text-emerald-300">
              <Icon name="check" size={22} />
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 line-clamp-2 min-h-[2.3em] max-w-full text-center font-semibold leading-[1.15] hyphens-auto [overflow-wrap:anywhere] ${compact ? 'px-0 text-[11px] tracking-[-0.015em]' : 'px-0.5 text-[12px]'} ${
            placed ? 'text-emerald-300/85' : selected ? 'text-accent' : 'text-slate-100'
          }`}
        >
          {label}
          {placed && <span className="sr-only"> ({labels.placedBadge})</span>}
        </span>
      </button>
    </li>
  );
}

interface TrayBackdropProps {
  metrics: LayoutMetrics | null;
  state: PuzzleState;
}

/** Fondo de la bandeja y pedestales, dibujados DEBAJO del lienzo (no tiñen las piezas 3D). */
export function TrayBackdrop({ metrics, state }: TrayBackdropProps) {
  const tray = metrics?.trayRect;
  if (!metrics || !tray) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div
        className="absolute rounded-t-[28px] border-t border-white/10 bg-linear-to-b from-ink-800/80 to-ink-900/95 landscape-short:rounded-none landscape-short:rounded-l-[28px] landscape-short:border-l"
        style={{ left: tray.x, top: tray.y, width: tray.width, height: metrics.height - tray.y }}
      />
      {Object.entries(metrics.slots).map(([id, rect]) => {
        const selected = state.selectedPieceId === id || state.draggingPieceId === id;
        const placed = state.pieces[id]?.status === 'placed';
        return (
          <div
            key={id}
            className={`absolute rounded-full transition-[box-shadow,background-color] duration-300 ${
              selected
                ? 'bg-accent/15 shadow-[0_0_0_2px_rgb(103_232_249/0.7),0_0_24px_rgb(103_232_249/0.35)]'
                : placed
                  ? 'bg-emerald-400/[0.04]'
                  : 'bg-[radial-gradient(circle,rgb(148_163_184/0.16),rgb(148_163_184/0.04)_70%)] shadow-[0_0_0_1px_rgb(255_255_255/0.08)]'
            }`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          />
        );
      })}
    </div>
  );
}
