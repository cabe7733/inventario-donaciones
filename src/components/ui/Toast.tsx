import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { newId } from '../../lib/ids';

type Tone = 'success' | 'error' | 'neutral';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  tone: Tone;
  action?: ToastAction;
}

interface ToastPush {
  message: string;
  tone?: Tone;
  action?: ToastAction;
}

const ToastContext = createContext<{ push: (t: ToastPush) => void }>({
  push: () => {},
});

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-700 text-inverse',
  error: 'bg-danger-700 text-inverse',
  neutral: 'bg-neutral-800 text-inverse dark:bg-neutral-100 dark:text-neutral-900',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: ToastPush) => {
    const id = newId();
    setToasts((prev) => [...prev, { ...t, tone: t.tone ?? 'neutral', id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-sheet-in pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-semibold shadow-elev-3 ${TONE_CLASS[t.tone]}`}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="whitespace-nowrap text-caption font-bold underline underline-offset-2 opacity-90 hover:opacity-100"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
