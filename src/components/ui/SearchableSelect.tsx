import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { clsx } from 'clsx';

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  emptyText = 'Sin resultados',
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 200);
  }, [options, query]);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'h-11 w-full rounded-lg border border-border bg-surface-card px-3 text-left text-body text-fg',
          'flex items-center justify-between gap-2 transition-colors',
          'hover:border-primary-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-accent-500',
        )}
      >
        <span className={clsx('truncate', !value && 'text-text-tertiary')}>
          {value || placeholder}
        </span>
        <CaretDown size={16} className={clsx('text-text-tertiary transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface-card shadow-elev-4">
          <div className="relative border-b border-border">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              aria-hidden="true"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-body-sm text-fg placeholder:text-text-tertiary focus:outline-none"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-caption text-text-secondary">{emptyText}</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt} role="option" aria-selected={opt === value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-2.5 text-left text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset',
                      'hover:bg-neutral-50',
                      opt === value && 'bg-accent-50 text-accent-700',
                    )}
                  >
                    <span className="truncate font-medium">{opt}</span>
                    {opt === value && <Check size={16} className="text-accent-600" aria-hidden="true" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
