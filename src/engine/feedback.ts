import type { PuzzleEvent } from '../types/puzzle';
import { formatLabel, joinList } from './labels';
import type { PuzzleRuntime } from './puzzleRuntime';

/**
 * Convierte eventos del motor en mensajes para el estudiante, usando el
 * contenido de la configuración. El tono nunca es punitivo: un error es
 * una oportunidad de aprender algo sobre la zona donde soltó la pieza.
 */

export type FeedbackTone = 'success' | 'warning' | 'neutral';

export interface FeedbackMessage {
  tone: FeedbackTone;
  title: string;
  body: string;
  pieceId: string;
}

export function describeEvent(runtime: PuzzleRuntime, event: PuzzleEvent): FeedbackMessage | null {
  const { labels } = runtime;
  switch (event.type) {
    case 'placed': {
      const piece = runtime.pieceById.get(event.pieceId);
      if (!piece) return null;
      return {
        tone: 'success',
        title: piece.config.feedback?.placed ?? formatLabel(labels.placedTitle, { name: piece.config.name }),
        body: piece.config.info?.summary ?? '',
        pieceId: event.pieceId,
      };
    }
    case 'rejected': {
      const piece = runtime.pieceById.get(event.pieceId);
      if (!piece) return null;
      const feedback = piece.config.feedback;
      let body: string;
      switch (event.reason) {
        case 'wrong-zone': {
          const zoneSlot = event.zoneSlotId ? runtime.slotById.get(event.zoneSlotId) : undefined;
          const specific =
            (zoneSlot ? (feedback?.wrongZone?.[zoneSlot.id] ?? feedback?.wrongZone?.[zoneSlot.group]) : undefined) ??
            feedback?.wrongZoneDefault;
          if (specific) {
            body = specific;
          } else {
            const zoneOwner = zoneSlot ? runtime.pieceById.get(zoneSlot.id) : undefined;
            body = `${zoneOwner?.config.feedback?.zoneDescription ?? labels.wrongZoneFallback} ${labels.tryAgain}`;
          }
          break;
        }
        case 'decoy': {
          const decoy = event.zoneSlotId ? runtime.slotById.get(event.zoneSlotId)?.decoy : undefined;
          body =
            (decoy ? feedback?.wrongZone?.[decoy.id] : undefined) ??
            decoy?.feedbackFor?.[piece.id] ??
            decoy?.feedbackFor?.[piece.group] ??
            decoy?.feedback ??
            labels.wrongZoneFallback;
          break;
        }
        case 'occupied':
          body = labels.occupied;
          break;
        case 'requires': {
          const names = event.missing.map((id) => runtime.pieceById.get(id)?.config.name ?? id);
          body = feedback?.requires ?? formatLabel(labels.requires, { list: joinList(names) });
          break;
        }
        case 'rotation':
          body = feedback?.rotation ?? labels.rotation;
          break;
        case 'scale':
          body = labels.tryAgain;
          break;
      }
      return { tone: 'warning', title: labels.incorrectTitle, body, pieceId: event.pieceId };
    }
    case 'missed':
      return { tone: 'neutral', title: '', body: labels.missed, pieceId: event.pieceId };
    case 'hint':
    case 'reset':
      return null;
  }
}
