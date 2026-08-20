import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-600 text-inverse hover:bg-primary-700 active:scale-[0.98]',
  secondary:
    'border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 active:scale-[0.98]',
  ghost: 'text-fg hover:bg-neutral-100 active:scale-[0.98] dark:hover:bg-neutral-100',
  danger: 'bg-danger-500 text-inverse hover:bg-danger-700 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-11 px-4 text-body-sm',
  md: 'h-12 px-5 text-body',
  lg: 'h-14 px-6 text-body-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}