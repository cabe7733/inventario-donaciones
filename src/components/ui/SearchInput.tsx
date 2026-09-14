import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { clsx } from 'clsx';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, 'aria-label': ariaLabel, className }: SearchInputProps) {
  return (
    <div className={clsx('relative', className)}>
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'h-10 w-full rounded-lg border border-border-default bg-white py-2 pl-10 pr-10 text-body text-fg',
          'placeholder:text-text-tertiary',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100',
          'transition-colors',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary hover:bg-neutral-100 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
