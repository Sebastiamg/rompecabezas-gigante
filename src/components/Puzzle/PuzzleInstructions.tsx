import type { Puzzle3DConfig, PuzzleLabels } from '../../types/puzzle';
import { Button } from '../UI/Button';
import { Icon, type IconName } from '../UI/Icon';

interface PuzzleInstructionsProps {
  config: Puzzle3DConfig;
  labels: PuzzleLabels;
  onStart: () => void;
  onExit?: () => void;
}

const TIP_ICONS: readonly IconName[] = ['hand', 'orbit', 'zoom'];

/** Pantalla inicial muy breve: misión + cómo se juega + COMENZAR. */
export function PuzzleInstructions({ config, labels, onStart, onExit }: PuzzleInstructionsProps) {
  const { intro } = config;
  return (
    <div
      className="absolute inset-0 z-40 overflow-y-auto bg-ink-950/75 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
    >
      <div className="flex min-h-full items-center justify-center px-5 py-8 safe-top safe-bottom">
        <div className="w-full max-w-sm text-center animate-pop-in">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-accent">
            {intro.kicker ?? labels.appName}
          </p>
          {config.icon && (
            <div className="mt-4 text-6xl drop-shadow-[0_0_24px_rgb(103_232_249/0.35)]" aria-hidden="true">
              {config.icon}
            </div>
          )}
          <h1 id="intro-title" className="mt-3 text-[28px] font-black uppercase leading-tight tracking-wide text-white">
            {intro.heading}
          </h1>
          <div className="mt-3 space-y-1 text-[15px] leading-relaxed text-slate-300">
            {intro.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <ul className="mt-6 grid gap-2 text-left">
            {labels.tips.map((tip, index) => (
              <li
                key={tip}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-snug text-slate-200"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Icon name={TIP_ICONS[index % TIP_ICONS.length] ?? 'hand'} size={17} />
                </span>
                {tip}
              </li>
            ))}
          </ul>
          <Button className="mt-7 w-full uppercase" onClick={onStart} autoFocus>
            {intro.startLabel ?? labels.start}
          </Button>
          {onExit && (
            <Button variant="secondary" size="sm" icon="grid" className="mt-3 w-full" onClick={onExit}>
              {labels.exitToCatalog}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
