import type { Ref } from 'react';
import type { PuzzleLabels } from '../../types/puzzle';
import { IconButton } from '../UI/Button';
import { Icon } from '../UI/Icon';

interface PuzzleHUDProps {
  ref?: Ref<HTMLElement>;
  icon?: string;
  title: string;
  placed: number;
  total: number;
  progressText: string;
  completed: boolean;
  labels: PuzzleLabels;
  onHint: () => void;
  onResetView: () => void;
  onRestart: () => void;
  /** Si se indica, el tercer botón abre un menú de opciones (reiniciar / otro rompecabezas). */
  onMenu?: () => void;
}

/** Barra superior compacta: título, progreso discreto y tres acciones. */
export function PuzzleHUD({
  ref,
  icon,
  title,
  placed,
  total,
  progressText,
  completed,
  labels,
  onHint,
  onResetView,
  onRestart,
  onMenu,
}: PuzzleHUDProps) {
  const ratio = total > 0 ? placed / total : 1;
  return (
    <header ref={ref} className="pointer-events-none col-span-full safe-top safe-x pb-1">
      <div className="pointer-events-auto relative mx-auto flex max-w-3xl items-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/85 py-1.5 pl-3 pr-1.5 shadow-xl shadow-black/30">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-[15px] font-bold leading-tight text-white">
            {icon && <span aria-hidden="true">{icon}</span>}
            <span className="truncate">{title}</span>
          </h1>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium tabular-nums text-slate-300">
            {completed && <Icon name="check" size={13} className="text-emerald-300" />}
            {completed ? labels.completedBadge : progressText}
          </p>
        </div>
        <IconButton icon="hint" label={labels.hint} showLabel="wide" tone="accent" onClick={onHint} disabled={completed} />
        <IconButton icon="view-reset" label={labels.resetCamera} onClick={onResetView} />
        {onMenu ? (
          <IconButton icon="menu" label={labels.menu} onClick={onMenu} aria-haspopup="dialog" />
        ) : (
          <IconButton icon="restart" label={labels.restart} onClick={onRestart} />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-[3px] bg-white/5"
          role="progressbar"
          aria-label={progressText}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={placed}
        >
          <div
            className="h-full bg-linear-to-r from-accent to-emerald-300 transition-[width] duration-700 ease-out"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    </header>
  );
}
