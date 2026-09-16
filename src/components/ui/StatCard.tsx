import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'teal' | 'green' | 'yellow' | 'red' | 'blue';
  className?: string;
}

const colorStyles = {
  teal: 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 ring-1 ring-primary-200/40 dark:ring-primary-800/40',
  green: 'bg-success-50 dark:bg-emerald-950/60 text-success-600 dark:text-emerald-300 ring-1 ring-success-200/40 dark:ring-emerald-800/40',
  yellow: 'bg-warning-50 dark:bg-amber-950/60 text-warning-600 dark:text-amber-300 ring-1 ring-warning-200/40 dark:ring-amber-800/40',
  red: 'bg-danger-50 dark:bg-rose-950/60 text-danger-600 dark:text-rose-300 ring-1 ring-danger-200/40 dark:ring-rose-800/40',
  blue: 'bg-info-50 dark:bg-sky-950/60 text-info-600 dark:text-sky-300 ring-1 ring-info-200/40 dark:ring-sky-800/40',
};

const valueColors = {
  teal: 'text-primary-700 dark:text-primary-300',
  green: 'text-success-700 dark:text-emerald-300',
  yellow: 'text-warning-700 dark:text-amber-300',
  red: 'text-danger-700 dark:text-rose-300',
  blue: 'text-info-700 dark:text-sky-300',
};

export function StatCard({ title, value, icon, color = 'teal', className }: StatCardProps) {
  return (
    <div className={clsx('rounded-2xl border border-border/80 bg-surface-card p-5 transition-all duration-fast hover:shadow-elev-2 hover:border-border-default shadow-elev-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-text-secondary">{title}</span>
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-xl shadow-sm', colorStyles[color])}>
          {icon}
        </div>
      </div>
      <p className={clsx('mt-3 text-numeric-lg font-bold tracking-tight', valueColors[color])}>{value}</p>
    </div>
  );
}
