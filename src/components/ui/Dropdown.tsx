import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';

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
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: align === 'right' ? rect.right + window.scrollX : rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    updatePosition();

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => updatePosition();

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, align]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded-lg"
      >
        {trigger}
      </button>

      {open && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            top: position.top,
            left: align === 'right' ? 'auto' : position.left,
            right: align === 'right' ? window.innerWidth - position.left - position.width : 'auto',
            minWidth: Math.max(180, position.width),
          }}
          className="z-[100] animate-scale-in overflow-hidden rounded-xl border border-border bg-surface-card py-1 shadow-elev-4 origin-top"
        >
          {items.map((it) => (
            <li key={it.key} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                tabIndex={it.disabled ? -1 : 0}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onClick();
                }}
                className={clsx(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset',
                  it.disabled
                    ? 'cursor-not-allowed text-text-tertiary'
                    : it.danger
                      ? 'text-danger-600 hover:bg-danger-50'
                      : 'text-fg hover:bg-neutral-50',
                )}
              >
                {it.icon && (
                  <span className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    it.danger ? 'bg-danger-50 text-danger-600' : 'bg-neutral-100 text-text-secondary',
                  )}>
                    {it.icon}
                  </span>
                )}
                <span className="flex-1 font-medium">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
