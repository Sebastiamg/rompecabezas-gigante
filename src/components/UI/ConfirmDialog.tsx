import { useEffect, useId } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 animate-fade-in"
      onPointerDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-5 shadow-2xl animate-pop-in"
      >
        <h2 id={titleId} className="text-lg font-bold text-white">
          {title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm text-slate-300">
          {body}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button size="sm" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
