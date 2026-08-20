import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-in absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-elev-4 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3">{title}</h2>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}