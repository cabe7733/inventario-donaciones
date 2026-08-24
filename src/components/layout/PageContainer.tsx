import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export function PageContainer({ children, sidebar, className }: PageContainerProps) {
  if (sidebar) {
    return (
      <div className={clsx('mx-auto w-full max-w-6xl px-4 py-4 lg:px-8 lg:py-8', className)}>
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="min-w-0">{children}</div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-4">{sidebar}</aside>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:gap-6 lg:px-8 lg:py-8', className)}>
      {children}
    </div>
  );
}
