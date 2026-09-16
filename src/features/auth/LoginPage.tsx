import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered === true;
  const passwordReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true;
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Credenciales inválidas'
          : authError.message);
        return;
      }

      await refresh();
      navigate('/inicio', { replace: true });
    } catch {
      setError('Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface p-4">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-300/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary-200/25 blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-500 to-primary-600 shadow-[0_8px_32px_rgb(var(--color-primary-500)/0.3)]">
            <img src="/donario_logo.png" alt="" className="h-10 w-10 object-contain" aria-hidden="true" />
          </div>
          <h1 className="text-display-sm tracking-tight text-fg">Donario</h1>
          <p className="mt-1 text-body text-text-secondary">Centro de acopio</p>
        </div>

        <div className="rounded-2xl border border-border bg-neutral-0 p-6 shadow-elev-3">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {justRegistered && (
              <div className="rounded-xl bg-success-50 p-3 text-caption text-success-700 ring-1 ring-success-200/50">
                Cuenta creada. Inicia sesión para continuar.
              </div>
            )}
            {passwordReset && (
              <div className="rounded-xl bg-success-50 p-3 text-caption text-success-700 ring-1 ring-success-200/50">
                Contraseña actualizada. Inicia sesión con tu nueva contraseña.
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-danger-50 p-3 text-caption text-danger-700 ring-1 ring-danger-200/50">
                {error}
              </div>
            )}

            <Field id="email" label="Email" required error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={inputWithError(errors.email)}
              />
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="mb-1.5 block text-label text-fg">
                  Contraseña <span className="text-danger-500">*</span>
                </label>
                <Link
                  to="/auth/recuperar-password"
                  className="text-caption text-primary-600 hover:text-primary-700"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className={inputWithError(errors.password)}
              />
              {errors.password?.message && (
                <p className="mt-1 text-caption text-danger-600">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full mt-1">
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-caption text-text-secondary">
          ¿No tienes cuenta?{' '}
          <Link to="/auth/registro" className="text-primary-600 hover:text-primary-700 font-medium">
            Crear cuenta
          </Link>
        </p>

        <footer className="mt-8 text-center text-caption text-text-tertiary">
          <p className="font-medium text-text-secondary">Donario</p>
          <p>© {new Date().getFullYear()} Esteban Ramirez Grajales</p>
        </footer>
      </div>
    </div>
  );
}
