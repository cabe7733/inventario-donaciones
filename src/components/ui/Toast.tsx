import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from '@phosphor-icons/react';
import { newId } from '../../lib/ids';
import { clsx } from 'clsx';

type Tone = 'success' | 'error' | 'info' | 'neutral';

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
  duration?: number;
}

const ToastContext = createContext<{ push: (t: ToastPush) => void }>({
  push: () => {},
});

const TONE_CLASS: Record<Tone, { bg: string; icon: React.ReactNode; iconBg: string }> = {
  success: {
    bg: 'bg-success-600',
    icon: <CheckCircle size={20} weight="fill" />,
    iconBg: 'bg-success-500',
  },
  error: {
    bg: 'bg-danger-600',
    icon: <XCircle size={20} weight="fill" />,
    iconBg: 'bg-danger-500',
  },
  info: {
    bg: 'bg-info-600',
    icon: <Info size={20} weight="fill" />,
    iconBg: 'bg-info-500',
  },
  neutral: {
    bg: 'bg-neutral-800',
    icon: <Info size={20} weight="fill" />,
    iconBg: 'bg-neutral-600',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { bg, icon, iconBg } = TONE_CLASS[toast.tone];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(
        'animate-slide-in-right pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 shadow-elev-4',
        bg,
      )}
    >
      <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', iconBg)}>
        <span className="text-white">{icon}</span>
      </div>
      <p className="flex-1 text-body-sm font-medium text-white">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
          className="shrink-0 text-caption font-semibold text-white/90 underline underline-offset-2 hover:text-white"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: ToastPush) => {
    const id = newId();
    const duration = t.duration ?? 4000;
    setToasts((prev) => [...prev, { ...t, tone: t.tone ?? 'neutral', id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notificaciones"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--header-height)+16px)] z-50 flex flex-col items-center gap-2 lg:bottom-6 lg:right-6 lg:left-auto lg:max-w-sm lg:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
