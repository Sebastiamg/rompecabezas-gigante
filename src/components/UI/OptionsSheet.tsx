import { useEffect, useId } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export interface SheetOption {
  icon: IconName;
  title: string;
  description?: string;
  onSelect: () => void;
}

interface OptionsSheetProps {
  title: string;
  options: readonly SheetOption[];
  cancelLabel: string;
  onClose: () => void;
}

/** Hoja de opciones (abajo en móvil, centrada en pantallas grandes). */
export function OptionsSheet({ title, options, cancelLabel, onClose }: OptionsSheetProps) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-3 safe-bottom animate-fade-in sm:items-center"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-4 shadow-2xl animate-sheet-in"
      >
        <h2 id={titleId} className="px-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </h2>
        <ul className="mt-3 grid gap-2">
          {options.map((option, index) => (
            <li key={option.title}>
              <button
                type="button"
                autoFocus={index === 0}
                onClick={option.onSelect}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:bg-white/[0.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Icon name={option.icon} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-white">{option.title}</span>
                  {option.description && <span className="block text-xs text-slate-400">{option.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
