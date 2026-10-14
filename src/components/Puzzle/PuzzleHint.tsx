import type { RuntimePiece } from '../../engine/puzzleRuntime';
import type { ActiveHint, PuzzleLabels } from '../../types/puzzle';
import { IconButton } from '../UI/Button';
import { Icon } from '../UI/Icon';

interface HintCardProps {
  hint: ActiveHint;
  piece: RuntimePiece;
  limit: number;
  labels: PuzzleLabels;
  onClose: () => void;
}

/** Pista progresiva: orienta sin regalar la respuesta (el contenido viene de la configuración). */
export function HintCard({ hint, piece, limit, labels, onClose }: HintCardProps) {
  return (
    <aside
      role="status"
      className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300/30 bg-[#241c0e]/95 py-2.5 pl-3.5 pr-1.5 shadow-xl shadow-black/30 animate-rise-in"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-300/15 text-amber-200">
          <Icon name="hint" size={17} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
            {labels.hint} · {piece.config.name}
            {limit > 0 && limit < Number.POSITIVE_INFINITY && (
              <span className="ml-1 font-semibold text-amber-200/60">
                ({Math.min(hint.level, limit)}/{limit})
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-amber-50">
            {hint.revealZone && !hint.text ? labels.hintReveal : hint.text}
          </p>
          {hint.revealZone && hint.text && <p className="mt-1 text-xs text-amber-100/80">{labels.hintReveal}</p>}
          {hint.exhausted && <p className="mt-1 text-xs font-medium text-amber-200/70">{labels.hintExhausted}</p>}
        </div>
        <IconButton icon="close" label={labels.close} tone="quiet" onClick={onClose} />
      </div>
    </aside>
  );
}
