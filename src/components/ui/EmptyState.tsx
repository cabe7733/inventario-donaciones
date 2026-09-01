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
    <div className={clsx('flex flex-col items-center gap-4 py-12 text-center', className)}>
      {IconCmp && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
          <IconCmp size={32} weight="duotone" aria-hidden="true" />
        </div>
      )}
      <div className="space-y-1">
        <h2 className="text-h2">{title}</h2>
        {description && (
          <p className="mx-auto max-w-sm text-body text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
