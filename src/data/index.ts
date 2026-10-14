import type { Puzzle3DConfig } from '../types/puzzle';
import { cellPuzzleConfig } from './cellPuzzle';
import { earthPuzzleConfig } from './earthPuzzle';
import { waterMoleculePuzzleConfig } from './waterMoleculePuzzle';

/**
 * Catálogo de rompecabezas. Para añadir uno nuevo: crea su archivo de
 * configuración y regístralo aquí. También se abre con ?puzzle=<id>.
 */
export const puzzleCatalog: readonly Puzzle3DConfig[] = [earthPuzzleConfig, cellPuzzleConfig, waterMoleculePuzzleConfig];

export function findPuzzle(id: string | null): Puzzle3DConfig | undefined {
  return id ? puzzleCatalog.find((puzzle) => puzzle.id === id) : undefined;
}
