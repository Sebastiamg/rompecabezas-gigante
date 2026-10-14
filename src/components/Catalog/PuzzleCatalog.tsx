import type { Difficulty, Puzzle3DConfig } from '../../types/puzzle';
import { Icon } from '../UI/Icon';

const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Fácil',
  medium: 'Intermedio',
  hard: 'Difícil',
};

interface PuzzleCatalogProps {
  puzzles: readonly Puzzle3DConfig[];
  onSelect: (id: string) => void;
}

/** Pantalla de inicio: lista genérica de rompecabezas a partir de sus configuraciones. */
export function PuzzleCatalog({ puzzles, onSelect }: PuzzleCatalogProps) {
  return (
    <div className="app-background relative h-dvh w-full overflow-y-auto text-slate-100">
      <div className="app-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <main className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center px-4 py-8 safe-top safe-bottom sm:px-6">
        <header className="text-center animate-pop-in">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-accent">Rompecabezas gigante</p>
          <h1 className="mt-3 text-[28px] font-black leading-tight text-white sm:text-4xl">¿Qué quieres construir hoy?</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-300">
            Elige un modelo y ármalo en 3D, pieza por pieza.
          </p>
        </header>
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {puzzles.map((puzzle, index) => (
            <CatalogCard key={puzzle.id} puzzle={puzzle} index={index} onSelect={onSelect} />
          ))}
        </ul>
      </main>
    </div>
  );
}

interface CatalogCardProps {
  puzzle: Puzzle3DConfig;
  index: number;
  onSelect: (id: string) => void;
}

function CatalogCard({ puzzle, index, onSelect }: CatalogCardProps) {
  const pieceCount = puzzle.pieces.filter((piece) => piece.draggable ?? true).length;
  // accentColor en formato #rrggbb: se le añade transparencia en hexadecimal.
  const accent = puzzle.accentColor ?? '#67e8f9';
  return (
    <li className="animate-rise-in" style={{ animationDelay: `${120 + index * 90}ms` }}>
      <button
        type="button"
        onClick={() => onSelect(puzzle.id)}
        className="group relative flex h-full w-full items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-ink-900/80 p-4 text-left shadow-xl shadow-black/30 transition hover:border-white/25 hover:bg-ink-800/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:flex-col sm:items-start sm:p-5"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-30 blur-2xl"
          style={{ background: accent }}
        />
        <span
          aria-hidden="true"
          className="relative grid size-16 shrink-0 place-items-center rounded-2xl text-4xl"
          style={{ background: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}55` }}
        >
          {puzzle.icon}
        </span>
        <span className="relative min-w-0 flex-1">
          {puzzle.subject && (
            <span className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
              {puzzle.subject}
            </span>
          )}
          <span className="mt-0.5 block text-lg font-extrabold leading-tight text-white">{puzzle.title}</span>
          <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-slate-300 sm:line-clamp-none">
            {puzzle.description}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{pieceCount} piezas</span>
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{DIFFICULTY_LABEL[puzzle.difficulty]}</span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white transition group-hover:translate-x-0.5 sm:absolute sm:bottom-5 sm:right-5"
        >
          <Icon name="arrow-right" size={18} />
        </span>
      </button>
    </li>
  );
}
