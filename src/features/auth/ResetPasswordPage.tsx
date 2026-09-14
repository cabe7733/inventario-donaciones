import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      navigate('/auth/login', {
        replace: true,
        state: { passwordReset: true },
      });
    } catch {
      setError('Error al actualizar la contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Nueva Contraseña</h1>
          <p className="mt-1 text-body text-muted">Ingresa tu nueva clave de acceso</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
              {error}
            </div>
          )}

          <Field id="password" label="Nueva contraseña" required error={errors.password?.message}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className={inputWithError(errors.password)}
            />
          </Field>

          <Field id="confirmPassword" label="Confirmar contraseña" required error={errors.confirmPassword?.message}>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={inputWithError(errors.confirmPassword)}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Guardando...' : 'Cambiar contraseña'}
          </Button>
        </form>
      </div>
    </div>
  );
}
