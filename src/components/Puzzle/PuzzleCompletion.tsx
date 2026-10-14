import type { Ref } from 'react';
import type { PuzzleRuntime } from '../../engine/puzzleRuntime';
import { formatDuration } from '../../engine/puzzleUtils';
import type { PuzzleMetrics } from '../../types/puzzle';
import { Button } from '../UI/Button';
import { Icon } from '../UI/Icon';

interface PuzzleCompletionProps {
  /** Se mide para reencuadrar el modelo en el espacio que la tarjeta deja libre. */
  ref?: Ref<HTMLElement>;
  runtime: PuzzleRuntime;
  metrics: PuzzleMetrics;
  onExplore: () => void;
  onRestart: () => void;
  onExit?: () => void;
}

/**
 * Recompensa final. Aparece con un pequeño retraso para dejar ver primero
 * la celebración 3D (destellos por capa + giro de cámara).
 */
export function PuzzleCompletion({ ref, runtime, metrics, onExplore, onRestart, onExit }: PuzzleCompletionProps) {
  const { completion } = runtime.config;
  const { labels } = runtime;
  // Piezas iguales (mismo nombre) se muestran una vez con su cantidad.
  const summary = new Map<string, number>();
  for (const piece of runtime.pieces) {
    if (piece.draggable) summary.set(piece.config.name, (summary.get(piece.config.name) ?? 0) + 1);
  }
  const stats = [
    { label: labels.statTime, value: formatDuration(metrics.elapsedMs) },
    { label: labels.statAttempts, value: metrics.attempts },
    { label: labels.statMistakes, value: metrics.mistakes },
    { label: labels.statHints, value: metrics.hintsUsed },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center p-3 safe-bottom lg:items-center lg:justify-end lg:pr-10">
      <section
        ref={ref}
        role="dialog"
        aria-labelledby="completion-title"
        className="pointer-events-auto max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-300/25 bg-ink-900/95 p-4 shadow-2xl shadow-black/50 animate-sheet-in [animation-delay:1.5s]"
      >
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
          <Icon name="sparkles" size={15} />
          {labels.completionKicker}
        </p>
        <h2 id="completion-title" className="mt-1.5 text-xl font-black uppercase leading-tight text-white">
          {completion.icon && <span aria-hidden="true">{completion.icon} </span>}
          {completion.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{completion.message}</p>

        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{labels.completionSummary}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {[...summary].map(([name, count]) => (
            <li
              key={name}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-2 pr-3 text-[12.5px] font-semibold text-slate-100"
            >
              <Icon name="check" size={15} className="shrink-0 text-emerald-300" />
              <span className="truncate">{name}</span>
              {count > 1 && <span className="text-slate-400">×{count}</span>}
            </li>
          ))}
        </ul>

        <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 px-1 py-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</dt>
              <dd className="text-base font-bold tabular-nums text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {completion.closing && <p className="mt-3 text-center text-base font-bold text-accent">{completion.closing}</p>}

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 whitespace-nowrap" onClick={onExplore}>
            {labels.explore}
          </Button>
          <Button size="sm" className="flex-1 whitespace-nowrap" onClick={onRestart}>
            {labels.playAgain}
          </Button>
        </div>
        {onExit && (
          <Button variant="secondary" size="sm" icon="grid" className="mt-2 w-full" onClick={onExit}>
            {labels.exitToCatalog}
          </Button>
        )}
      </section>
    </div>
  );
}
