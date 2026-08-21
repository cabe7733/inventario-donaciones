import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';

interface EmptyStateProps {
  icon?: ComponentType<IconProps>;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: IconCmp, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      {IconCmp && (
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
          <IconCmp size={40} weight="light" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-1">
        <h2 className="text-h3">{title}</h2>
        {description && <p className="mx-auto max-w-xs text-body text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
