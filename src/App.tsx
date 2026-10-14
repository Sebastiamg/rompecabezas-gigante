import { useCallback, useEffect, useState } from 'react';
import { PuzzleCatalog } from './components/Catalog/PuzzleCatalog';
import { PuzzleExperience } from './components/Puzzle/PuzzleExperience';
import { findPuzzle, puzzleCatalog } from './data';
import type { PuzzleAnalyticsEvent } from './types/puzzle';

function logLearningEvent(event: PuzzleAnalyticsEvent) {
  // Punto de enganche para un futuro backend/LMS. En desarrollo solo se registra en consola.
  if (import.meta.env.DEV) console.info('[rompecabezas]', event.type, event);
}

const readPuzzleId = () => new URLSearchParams(window.location.search).get('puzzle');

export default function App() {
  const [puzzleId, setPuzzleId] = useState<string | null>(readPuzzleId);

  // El botón "atrás" del navegador vuelve al catálogo (o al rompecabezas anterior).
  useEffect(() => {
    const onPopState = () => setPuzzleId(readPuzzleId());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const onlyPuzzle = puzzleCatalog.length === 1 ? puzzleCatalog[0] : undefined;
  const config = findPuzzle(puzzleId) ?? onlyPuzzle;

  useEffect(() => {
    document.title = config ? `${config.title} · Rompecabezas Gigante` : 'Rompecabezas Gigante';
  }, [config]);

  const open = useCallback((id: string) => {
    window.history.pushState(null, '', `?puzzle=${encodeURIComponent(id)}`);
    setPuzzleId(id);
  }, []);

  const exit = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname);
    setPuzzleId(null);
  }, []);

  if (!config) return <PuzzleCatalog puzzles={puzzleCatalog} onSelect={open} />;
  // `key` reinicia por completo el estado al cambiar de rompecabezas.
  return (
    <PuzzleExperience
      key={config.id}
      config={config}
      onEvent={logLearningEvent}
      onExit={onlyPuzzle ? undefined : exit}
    />
  );
}
