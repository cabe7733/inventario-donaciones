import { Skeleton as HeroSkeleton } from '@heroui/react';
import type { ComponentProps } from 'react';

type HeroSkeletonProps = ComponentProps<typeof HeroSkeleton>;

interface SkeletonProps extends Omit<HeroSkeletonProps, 'animationType'> {
  className?: string;
}

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <HeroSkeleton animationType="shimmer" className={className} {...rest} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = '75%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
      <div className="h-4 rounded-lg bg-neutral-100" style={{ width: lastLineWidth }} />
    </div>
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <HeroSkeleton
      animationType="shimmer"
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  );
}
