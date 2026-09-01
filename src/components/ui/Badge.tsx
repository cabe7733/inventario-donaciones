import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-700',
  success: 'bg-success-50 text-success-700 ring-1 ring-success-200',
  warning: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200',
  info: 'bg-info-50 text-info-700 ring-1 ring-info-200',
  primary: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  primary: 'bg-accent-500',
};

export function Badge({ children, variant = 'default', className, dot = false }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full', dotStyles[variant])} aria-hidden />
      )}
      {children}
    </span>
  );
}
