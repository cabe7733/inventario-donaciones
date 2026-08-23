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

// ponytail: select nativo con búsqueda para listas medianas. Sin dependencias
// externas. Si crece a miles de opciones, cambiar a AutocompleteOrCreate.
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
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'h-11 w-full rounded-lg border border-border bg-card px-3 text-left text-body text-fg',
          'flex items-center justify-between gap-2 transition-colors',
          'hover:border-primary-300 focus:border-primary-500 focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-primary-500',
        )}
      >
        <span className={clsx('truncate', !value && 'text-muted')}>
          {value || placeholder}
        </span>
        <CaretDown size={16} className={clsx('text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-elev-3">
          <div className="relative border-b border-border">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-body-sm text-fg placeholder:text-muted focus:outline-none"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-caption text-muted">{emptyText}</li>
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
                      'flex w-full items-center justify-between px-3 py-2 text-left text-body-sm transition-colors',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      opt === value && 'bg-primary-50 text-primary-700 dark:bg-primary-900/20',
                    )}
                  >
                    <span className="truncate">{opt}</span>
                    {opt === value && <Check size={16} className="text-primary-700" aria-hidden="true" />}
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
