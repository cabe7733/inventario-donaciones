import { MagnifyingGlass, X } from '@phosphor-icons/react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export function SearchInput({ value, onChange, placeholder, 'aria-label': ariaLabel }: SearchInputProps) {
  return (
    <div className="relative">
      <MagnifyingGlass
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        aria-label={ariaLabel}
        className="h-11 w-full rounded-lg border border-border bg-card py-2 pl-10 pr-10 text-body text-fg placeholder:text-muted focus:border-primary-500 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
          aria-label="Limpiar búsqueda"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
