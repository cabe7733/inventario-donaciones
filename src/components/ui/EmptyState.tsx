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
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      {IconCmp && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <IconCmp size={32} aria-hidden="true" />
        </span>
      )}
      <h2 className="text-h3">{title}</h2>
      {description && <p className="max-w-xs text-body text-muted">{description}</p>}
      {action}
    </div>
  );
}