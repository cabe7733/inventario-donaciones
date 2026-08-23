import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  ariaLabel: string;
}

export function Dropdown({ trigger, items, align = 'right', ariaLabel }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>

      {open && (
        <ul
          role="menu"
          aria-label={ariaLabel}
          className={clsx(
            'absolute z-30 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-elev-3',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it) => (
            <li key={it.key} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onClick();
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm transition-colors',
                  it.disabled
                    ? 'cursor-not-allowed text-muted opacity-50'
                    : it.danger
                      ? 'text-danger-700 hover:bg-danger-500/10'
                      : 'text-fg hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
