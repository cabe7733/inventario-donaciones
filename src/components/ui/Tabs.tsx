import { clsx } from 'clsx';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex gap-1 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={clsx(
            'px-4 py-2.5 text-body font-medium transition-colors border-b-2 -mb-px',
            activeTab === tab.key
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-muted hover:text-fg hover:border-neutral-300',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
