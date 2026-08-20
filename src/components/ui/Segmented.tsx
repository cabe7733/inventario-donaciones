import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-flow-col auto-cols-fr overflow-hidden rounded-lg border border-border bg-card p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex h-11 items-center justify-center gap-1.5 rounded-md text-body-sm font-semibold transition-colors',
            value === o.value
              ? o.value === 'salida'
                ? 'bg-secondary-600 text-inverse'
                : 'bg-primary-600 text-inverse'
              : 'text-muted',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}