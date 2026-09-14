import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: ComponentType<IconProps>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: IconCmp, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center gap-4 py-16 text-center', className)}>
      {IconCmp && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-400 ring-1 ring-primary-200/50">
          <IconCmp size={28} weight="light" aria-hidden="true" />
        </div>
      )}
      <div className="space-y-1.5">
        <h2 className="text-h2 text-fg">{title}</h2>
        {description && (
          <p className="mx-auto max-w-sm text-body text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
