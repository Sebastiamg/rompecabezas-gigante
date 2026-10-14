import type { Difficulty, DifficultyProfile, Puzzle3DConfig } from '../types/puzzle';

/**
 * Perfiles de dificultad. Afectan al motor de forma genérica
 * (tolerancia del snap, ayudas visuales, pistas) sin que el contenido
 * tenga que cambiar. Un rompecabezas puede ajustar cualquier valor con
 * `difficultyOverrides`.
 */
export const difficultyProfiles: Readonly<Record<Difficulty, DifficultyProfile>> = {
  easy: {
    snapThresholdMultiplier: 1.35,
    maxHintsPerPiece: Number.POSITIVE_INFINITY,
    revealZoneAfterHints: true,
    showGhosts: 'always',
    showDropGuides: 'while-dragging',
    highlightHoveredZone: true,
    showInfoOnPlace: true,
  },
  medium: {
    snapThresholdMultiplier: 1,
    maxHintsPerPiece: 3,
    revealZoneAfterHints: true,
    showGhosts: 'always',
    showDropGuides: 'while-dragging',
    highlightHoveredZone: true,
    showInfoOnPlace: true,
  },
  hard: {
    snapThresholdMultiplier: 0.75,
    maxHintsPerPiece: 1,
    revealZoneAfterHints: false,
    showGhosts: 'never',
    showDropGuides: 'never',
    highlightHoveredZone: true,
    showInfoOnPlace: true,
  },
};

export function resolveDifficulty(config: Pick<Puzzle3DConfig, 'difficulty' | 'difficultyOverrides'>): DifficultyProfile {
  return { ...difficultyProfiles[config.difficulty], ...config.difficultyOverrides };
}
