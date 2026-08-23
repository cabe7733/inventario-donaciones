import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';

export const inputClass =
  'h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg placeholder:text-muted focus:border-primary-500 focus:outline-none';

interface FieldProps {
  id?: string;
  label: string;
  required?: boolean;
  error?: string | FieldError;
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, required, error, hint, children }: FieldProps) {
  const errorMsg = typeof error === 'string' ? error : error?.message;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-fg">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      {children}
      {errorMsg ? (
        <p className="text-caption text-danger-700" role="alert">
          {errorMsg}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputWithError(error?: string | FieldError | boolean) {
  const hasError = typeof error === 'object' ? !!error?.message : !!error;
  return clsx(inputClass, hasError && 'border-danger-500');
}