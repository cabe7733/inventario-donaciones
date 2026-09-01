import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { CircleNotch } from '@phosphor-icons/react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-[#F5F0E8] hover:bg-accent-700 active:bg-accent-800 shadow-elev-1 hover:shadow-elev-2',
  secondary: 'bg-primary-100 text-primary-700 hover:bg-primary-200 active:bg-primary-300',
  ghost: 'bg-transparent text-text-secondary hover:bg-neutral-100 hover:text-fg active:bg-neutral-200',
  danger: 'bg-danger-600 text-[#F5F0E8] hover:bg-danger-700 active:bg-danger-800 shadow-elev-1 hover:shadow-elev-2',
  outline: 'bg-transparent border border-border text-text-secondary hover:bg-neutral-50 hover:text-fg hover:border-primary-300 active:bg-neutral-100',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-body-sm gap-1.5',
  md: 'h-11 px-4 text-body gap-2',
  lg: 'h-12 px-6 text-body gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-100',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
        'active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <CircleNotch size={size === 'sm' ? 14 : 18} className="animate-spin" aria-hidden />
      ) : icon ? (
        <span className="flex items-center justify-center" aria-hidden>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
