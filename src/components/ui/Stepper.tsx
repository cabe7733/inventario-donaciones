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
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label={t('a11y.decrement')}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card text-fg transition-colors disabled:opacity-40"
      >
        <Minus size={20} aria-hidden="true" />
      </button>
      <div className="flex h-14 flex-1 items-center justify-center rounded-lg border border-border bg-card">
        <span className="text-numeric-lg" aria-live="polite">
          {formatNumber(value)}
          {suffix && <span className="ml-1 text-caption text-muted">{suffix}</span>}
        </span>
      </div>
      <button
        type="button"
        aria-label={t('a11y.increment')}
        onClick={() => onChange(clamp(value + step))}
        disabled={max !== undefined && value >= max}
        className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card text-fg transition-colors disabled:opacity-40"
      >
        <Plus size={20} aria-hidden="true" />
      </button>
    </div>
  );
}