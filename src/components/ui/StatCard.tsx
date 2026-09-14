import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'teal' | 'green' | 'yellow' | 'red' | 'blue';
  className?: string;
}

const colorStyles = {
  teal: 'bg-primary-50 text-primary-600 ring-1 ring-primary-200/40',
  green: 'bg-success-50 text-success-600 ring-1 ring-success-200/40',
  yellow: 'bg-warning-50 text-warning-600 ring-1 ring-warning-200/40',
  red: 'bg-danger-50 text-danger-600 ring-1 ring-danger-200/40',
  blue: 'bg-info-50 text-info-600 ring-1 ring-info-200/40',
};

const valueColors = {
  teal: 'text-primary-700',
  green: 'text-success-700',
  yellow: 'text-warning-700',
  red: 'text-danger-700',
  blue: 'text-info-700',
};

export function StatCard({ title, value, icon, color = 'teal', className }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border border-border/60 bg-surface-card p-5 transition-all duration-fast hover:shadow-elev-2 hover:border-border-default', className)}>
      <div className="flex items-center justify-between">
        <span className="text-caption text-text-secondary">{title}</span>
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', colorStyles[color])}>
          {icon}
        </div>
      </div>
      <p className={clsx('mt-3 text-numeric-lg font-semibold', valueColors[color])}>{value}</p>
    </div>
  );
}
