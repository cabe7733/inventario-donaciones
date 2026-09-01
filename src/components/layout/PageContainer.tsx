import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const maxWidthStyles = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-full',
};

export function PageContainer({ children, className, maxWidth = 'xl' }: PageContainerProps) {
  return (
    <div
      className={clsx(
        'mx-auto w-full px-4 py-6 lg:px-8 lg:py-8',
        maxWidthStyles[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={clsx('mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div>
        <h1 className="text-display-md">{title}</h1>
        {description && (
          <p className="mt-1 text-body text-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}

interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageSection({ children, title, description, actions, className }: PageSectionProps) {
  return (
    <section className={clsx('mb-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-h2">{title}</h2>}
            {description && (
              <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
