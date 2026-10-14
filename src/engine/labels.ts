import type { PuzzleLabels } from '../types/puzzle';

/**
 * Textos genéricos de la interfaz. Cada rompecabezas puede sobrescribir
 * cualquiera desde su configuración (`labels`), p. ej. para decir
 * "capas" en vez de "piezas" o para traducir la experiencia.
 */
export const defaultLabels: PuzzleLabels = {
  appName: 'Rompecabezas gigante',
  start: 'Comenzar',
  tips: [
    'Arrastra cada pieza con el dedo o el mouse.',
    'Gira la vista arrastrando sobre un espacio libre.',
    'Pellizca o usa la rueda del mouse para hacer zoom.',
  ],
  trayTitle: 'Piezas',
  trayHint: 'Arrastra una pieza hasta su lugar',
  progress: '{placed} / {total} piezas colocadas',
  placedTitle: '{name} en su lugar',
  placedBadge: 'Colocada',
  incorrectTitle: 'Posición incorrecta',
  wrongZoneFallback: 'Ese lugar corresponde a otra pieza.',
  tryAgain: 'Inténtalo de nuevo.',
  occupied: 'Ese lugar ya está ocupado por otra pieza.',
  requires: 'Antes necesitas colocar: {list}.',
  rotation: 'La orientación no coincide. Gira la pieza e inténtalo otra vez.',
  missed: 'Suelta la pieza sobre el modelo para colocarla.',
  hint: 'Pista',
  hintSelectPiece: 'Toca primero una pieza para ver su pista.',
  hintExhausted: 'Ya no quedan pistas para esta pieza. ¡Tú puedes!',
  hintReveal: 'Observa la zona que se ilumina en el modelo.',
  rotate: 'Girar',
  deselect: 'Soltar selección',
  selectedHelp: 'Arrástrala a su lugar o toca donde creas que va.',
  aimHelp: '← → elige el lugar · Enter coloca la pieza',
  aimAnnounce: 'Lugar {index} de {total}',
  keyboardHelp: 'Con teclado: Enter selecciona la pieza, las flechas eligen su lugar y Enter la coloca.',
  dragging: 'Moviendo {name}',
  resetCamera: 'Restablecer la vista',
  restart: 'Reiniciar',
  menu: 'Opciones',
  exitToCatalog: 'Elegir otro rompecabezas',
  restartConfirmTitle: '¿Reiniciar el rompecabezas?',
  restartConfirmBody: 'Todas las piezas volverán a la bandeja.',
  cancel: 'Cancelar',
  confirmRestart: 'Sí, reiniciar',
  completionKicker: 'Estructura completada',
  completionSummary: 'Has colocado correctamente:',
  completedBadge: 'Completado',
  explore: 'Explorar modelo',
  playAgain: 'Jugar de nuevo',
  statTime: 'Tiempo',
  statAttempts: 'Intentos',
  statMistakes: 'Errores',
  statHints: 'Pistas',
  close: 'Cerrar',
  showInfo: 'Ver información',
};

export function resolveLabels(overrides?: Partial<PuzzleLabels>): PuzzleLabels {
  return { ...defaultLabels, ...overrides };
}

/** Sustituye {clave} por su valor: formatLabel('{a} / {b}', { a: 1, b: 4 }) → "1 / 4". */
export function formatLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** "A", "A y B", "A, B y C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
