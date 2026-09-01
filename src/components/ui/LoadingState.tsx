import { CircleNotch, ArrowClockwise } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { Button } from './Button';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Cargando...', className }: LoadingStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-4 py-12', className)} role="status">
      <div className="relative">
        <CircleNotch size={40} className="animate-spin text-accent-600" aria-hidden="true" />
      </div>
      <p className="text-body text-text-secondary">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Algo salió mal',
  message = 'No pudimos cargar la información. Por favor, intenta de nuevo.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-4 py-12 text-center', className)} role="alert">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-danger-500"
          aria-hidden="true"
        >
          <path
            d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm1 15v-2h-2v2h2zm0-4V10h-2v7h2z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <h2 className="text-h2">{title}</h2>
        <p className="mx-auto max-w-sm text-body text-text-secondary">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} icon={<ArrowClockwise size={18} />} className="mt-2">
          Reintentar
        </Button>
      )}
    </div>
  );
}
