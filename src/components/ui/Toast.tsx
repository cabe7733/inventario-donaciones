import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { newId } from '../../lib/ids';

type Tone = 'success' | 'error' | 'neutral';

interface Toast {
  id: string;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ push: (t: { message: string; tone?: Tone }) => void }>({
  push: () => {},
});

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-700 text-inverse',
  error: 'bg-danger-700 text-inverse',
  neutral: 'bg-neutral-800 text-inverse dark:bg-neutral-100 dark:text-inverse',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: { message: string; tone?: Tone }) => {
    const id = newId();
    setToasts((prev) => [...prev, { ...t, tone: t.tone ?? 'neutral', id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
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
            className={`animate-sheet-in rounded-full px-4 py-2 text-body-sm font-semibold shadow-elev-3 ${TONE_CLASS[t.tone]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}