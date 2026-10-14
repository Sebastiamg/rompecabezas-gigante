import type { FeedbackMessage } from '../../engine/feedback';
import type { RuntimePiece } from '../../engine/puzzleRuntime';
import type { PuzzleLabels } from '../../types/puzzle';
import { IconButton } from '../UI/Button';
import { Icon } from '../UI/Icon';

/** Aviso breve (error amable, ayuda). Texto + icono: nunca depende solo del color. */
export function FeedbackToast({ message }: { message: FeedbackMessage }) {
  const styles = {
    warning: { box: 'border-orange-300/35 bg-[#2b1a13]/95', badge: 'bg-orange-300/15 text-orange-200', icon: 'close' },
    success: { box: 'border-emerald-300/35 bg-[#0f2a22]/95', badge: 'bg-emerald-300/15 text-emerald-200', icon: 'check' },
    neutral: { box: 'border-white/10 bg-ink-800/95', badge: 'bg-white/10 text-slate-200', icon: 'info' },
  } as const;
  const style = styles[message.tone];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-xl shadow-black/30 animate-rise-in ${style.box}`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${style.badge}`}>
        <Icon name={style.icon} size={17} />
      </span>
      <div className="min-w-0 pt-0.5">
        {message.title && (
          <p className="text-xs font-extrabold uppercase tracking-wider text-white">{message.title}</p>
        )}
        <p className="text-sm leading-snug text-slate-200">{message.body}</p>
      </div>
    </div>
  );
}

interface InfoCardProps {
  piece: RuntimePiece;
  title: string;
  collapsed: boolean;
  labels: PuzzleLabels;
  onExpand: () => void;
  onCollapse: () => void;
}

/** Lo que se aprende al colocar una pieza. Se minimiza sola para no tapar el modelo. */
export function InfoCard({ piece, title, collapsed, labels, onExpand, onCollapse }: InfoCardProps) {
  const info = piece.config.info;
  if (!info) return null;
  const dot = (
    <span
      className="size-2.5 shrink-0 rounded-full ring-2 ring-white/15"
      style={{ background: piece.config.appearance.color }}
      aria-hidden="true"
    />
  );
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300/30 bg-ink-900/90 px-4 text-sm font-semibold text-emerald-100 shadow-lg shadow-black/30 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`${labels.showInfo}: ${info.title}`}
      >
        <Icon name="info" size={17} className="text-emerald-300" />
        {dot}
        {info.title}
      </button>
    );
  }
  return (
    <article className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-300/30 bg-ink-900/95 p-3 shadow-2xl shadow-black/40 animate-rise-in">
      <header className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Icon name="check" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">{title}</p>
          <h3 className="flex items-center gap-2 text-base font-bold text-white">
            {dot}
            {info.title}
          </h3>
        </div>
        <IconButton icon="close" label={labels.close} tone="quiet" onClick={onCollapse} className="-mr-1 -mt-1" />
      </header>
      <p className="mt-1 text-[13px] leading-snug text-slate-200">{info.summary}</p>
      {info.facts && info.facts.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-1">
          {info.facts.map((fact) => (
            <div key={fact.label} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">
              <dt className="inline text-slate-400">{fact.label}: </dt>
              <dd className="inline font-semibold text-slate-100">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

interface SelectionBarProps {
  piece: RuntimePiece;
  labels: PuzzleLabels;
  helpText: string;
  canRotate: boolean;
  onRotate: () => void;
  onHint: () => void;
  onClose: () => void;
}

/** Acciones de la pieza seleccionada (girar, pista) + cómo colocarla. */
export function SelectionBar({ piece, labels, helpText, canRotate, onRotate, onHint, onClose }: SelectionBarProps) {
  return (
    <div className="pointer-events-auto flex w-full max-w-md items-center gap-1.5 rounded-2xl border border-accent/30 bg-ink-900/95 py-1.5 pl-3 pr-1.5 shadow-xl shadow-black/30 animate-rise-in">
      <span
        className="size-3 shrink-0 rounded-full ring-2 ring-white/20"
        style={{ background: piece.config.appearance.color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{piece.config.name}</p>
        <p className="line-clamp-2 text-[11.5px] leading-tight text-slate-400">{helpText}</p>
      </div>
      {canRotate && <IconButton icon="rotate" label={labels.rotate} onClick={onRotate} />}
      <IconButton icon="hint" label={labels.hint} tone="accent" onClick={onHint} />
      <IconButton icon="close" label={labels.deselect} tone="quiet" onClick={onClose} />
    </div>
  );
}
