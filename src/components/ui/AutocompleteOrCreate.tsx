import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { normalize } from '../../lib/search';
import { Field, inputWithError } from './Field';

export interface AocItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface AocProps {
  id?: string;
  label: string;
  placeholder?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  items: AocItem[];
  onCreate?: (label: string) => Promise<string>;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function AutocompleteOrCreate({
  id,
  label,
  placeholder,
  value,
  onChange,
  items,
  onCreate,
  required,
  error,
  hint,
}: AocProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;

  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return items.slice(0, 8);
    const needle = q;
    return items
      .filter((i) => normalize(`${i.label} ${i.sublabel ?? ''}`).includes(needle))
      .slice(0, 8);
  }, [items, query]);

  const canCreate =
    onCreate && query.trim().length > 0 && !matches.some((i) => normalize(i.label) === normalize(query));

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = async (item: AocItem) => {
    onChange(item.id);
    setQuery('');
    close();
  };

  const create = async () => {
    const label = query.trim();
    if (!onCreate || !label || busy) return;
    setBusy(true);
    try {
      const id = await onCreate(label);
      onChange(id);
      setQuery('');
      close();
    } finally {
      setBusy(false);
    }
  };

  const total = matches.length + (canCreate ? 1 : 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setActive((a) => Math.min(a + 1, total - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(a - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (active >= 0 && active < matches.length) void pick(matches[active]);
        else if (active >= matches.length && canCreate) void create();
        else if (canCreate) void create();
        break;
      case 'Escape':
        close();
        break;
    }
  };

  const inputValue = selected ? selected.label : query;

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div ref={rootRef} className="relative">
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute inset-y-0 left-3 my-auto text-text-tertiary"
          aria-hidden="true"
        />
        <input
          id={id}
          className={clsx(inputWithError(open && error), 'pl-9 pr-10')}
          placeholder={placeholder}
          value={inputValue}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="aoc-list"
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => setTimeout(close, 120)}
          onChange={(e) => {
            if (value !== null) onChange(null);
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        {inputValue.length > 0 && (
          <button
            type="button"
            aria-label={t('a11y.clear')}
            onClick={() => {
              setQuery('');
              onChange(null);
              setOpen(true);
            }}
            className="absolute inset-y-0 right-1 my-auto flex w-9 items-center justify-center rounded-md text-text-tertiary hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        {open && (
          <ul
            id="aoc-list"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-surface-card py-1 shadow-elev-4"
          >
            {matches.map((item, i) => (
              <li key={item.id} role="option" aria-selected={item.id === value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(item)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset',
                    i === active ? 'bg-accent-50' : 'hover:bg-neutral-50',
                  )}
                >
                  <span className="flex-1">
                    <span className="block font-medium text-fg">{item.label}</span>
                    {item.sublabel && <span className="block text-caption text-text-secondary">{item.sublabel}</span>}
                  </span>
                  {item.id === value && <Check size={18} className="text-accent-600" aria-hidden="true" />}
                </button>
              </li>
            ))}

            {canCreate && (
              <>
                {matches.length > 0 && <li role="separator" className="mx-3 my-1 border-t border-border" />}
                <li role="option">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void create()}
                    onMouseEnter={() => setActive(matches.length)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset',
                      active >= matches.length && 'bg-accent-50',
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                      {busy ? '…' : <Plus size={18} aria-hidden="true" />}
                    </span>
                    <span className="font-medium text-accent-600">
                      {busy ? '…' : `${t('common.createNew')} "${query.trim()}"`}
                    </span>
                  </button>
                </li>
              </>
            )}

            {matches.length === 0 && !canCreate && (
              <li className="px-3 py-2.5 text-caption text-text-secondary">{t('common.noResults')}</li>
            )}
          </ul>
        )}
      </div>
    </Field>
  );
}
