import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { WarningCircle } from '@phosphor-icons/react';

export const inputClass =
  'h-10 w-full rounded-xl border border-border-default bg-surface-card dark:bg-neutral-900/60 px-3 py-2 text-body text-fg placeholder:text-text-tertiary transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none shadow-sm';

export const inputErrorClass = 'border-danger-500 dark:border-danger-400 focus:border-danger-500 focus:ring-danger-500/20';
export const inputDisabledClass = 'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800';

interface FieldProps {
  id?: string;
  label: string;
  required?: boolean;
  error?: string | FieldError;
  hint?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function Field({ id, label, required, error, hint, disabled, children }: FieldProps) {
  const errorMsg = typeof error === 'string' ? error : error?.message;
  const hasError = !!errorMsg;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={clsx(
          'text-label font-medium',
          hasError ? 'text-danger-600 dark:text-danger-400' : 'text-fg',
          disabled && 'opacity-50',
        )}
      >
        {label}
        {required && <span className="ml-0.5 text-danger-500" aria-hidden>*</span>}
      </label>
      <div className="relative">
        {children}
        {hasError && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <WarningCircle size={18} className="text-danger-500 dark:text-danger-400" aria-hidden />
          </div>
        )}
      </div>
      {errorMsg ? (
        <p className="flex items-center gap-1 text-caption text-danger-600 dark:text-danger-400 font-medium" role="alert">
          <span>{errorMsg}</span>
        </p>
      ) : hint ? (
        <p className="text-caption text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputWithError(error?: string | FieldError | boolean, disabled?: boolean) {
  const hasError = typeof error === 'object' ? !!error?.message : !!error;
  return clsx(
    inputClass,
    hasError && inputErrorClass,
    disabled && inputDisabledClass,
    hasError && 'pr-10',
  );
}

interface SelectFieldProps extends FieldProps {
  children: React.ReactNode;
  placeholder?: string;
}

export function SelectField({ id, label, required, error, hint, disabled, children, placeholder }: SelectFieldProps) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint} disabled={disabled}>
      <select
        id={id}
        disabled={disabled}
        className={clsx(
          inputClass,
          'appearance-none bg-[url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyA1bDMgMyAzLTMiIHN0cm9rZT0iIzZFNkU2NyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=)] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-10',
          error && inputErrorClass,
          disabled && inputDisabledClass,
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </Field>
  );
}
