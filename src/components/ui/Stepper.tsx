import { Minus, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/format';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function Stepper({ value, onChange, min = 1, max, step = 1, suffix }: StepperProps) {
  const { t } = useTranslation();
  const clamp = (n: number) => {
    if (Number.isNaN(n)) return min;
    return Math.min(max ?? n, Math.max(min, n));
  };

  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        aria-label={t('a11y.decrement')}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-default bg-surface-card text-fg transition-colors hover:bg-neutral-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <div className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border-default bg-surface-card min-w-[64px]">
        <span className="text-numeric-lg font-medium" role="status">
          {formatNumber(value)}
          {suffix && <span className="ml-1 text-caption text-text-tertiary">{suffix}</span>}
        </span>
      </div>
      <button
        type="button"
        aria-label={t('a11y.increment')}
        onClick={() => onChange(clamp(value + step))}
        disabled={max !== undefined && value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-default bg-surface-card text-fg transition-colors hover:bg-neutral-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
