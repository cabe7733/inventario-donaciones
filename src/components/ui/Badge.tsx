import { Badge as HeroBadge } from '@heroui/react';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const colorMap: Record<BadgeVariant, string> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'accent',
  primary: 'accent',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  primary: 'bg-primary-500',
};

export function Badge({ children, variant = 'default', className, dot = false }: BadgeProps) {
  return (
    <HeroBadge
      color={colorMap[variant] as never}
      variant={variant === 'primary' ? 'primary' : 'soft'}
      className={className}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} aria-hidden />
      )}
      {children}
    </HeroBadge>
  );
}
