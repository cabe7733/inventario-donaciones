import { clsx } from 'clsx';

interface Tab {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex gap-0.5 rounded-lg bg-neutral-100 p-1', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-disabled={tab.disabled}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.key)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-4 py-2 text-body-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
            activeTab === tab.key
              ? 'bg-surface-card text-fg shadow-elev-1'
              : 'text-text-secondary hover:text-fg',
            tab.disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-caption font-semibold',
                activeTab === tab.key
                  ? 'bg-accent-100 text-accent-700'
                  : 'bg-neutral-200 text-neutral-600',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
