import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  className?: string;
}

const colorStyles = {
  blue: 'bg-info-100 text-info-700',
  green: 'bg-success-100 text-success-700',
  yellow: 'bg-warning-100 text-warning-700',
  red: 'bg-danger-100 text-danger-700',
  purple: 'bg-primary-100 text-primary-700',
};

export function StatCard({ title, value, icon, color = 'blue', className }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted">{title}</span>
        <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', colorStyles[color])}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-h2 text-fg">{value}</p>
    </div>
  );
}
