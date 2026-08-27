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

      // ponytail: onAuthStateChange dispara loadAuth async, pero navigate
      // ocurre antes; ProtectedRoute ve user=null y rebota a /auth/login.
      // refresh() fuerza el setState antes de navegar.
      await refresh();
      navigate('/inicio', { replace: true });
    } catch {
      setError('Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Iniciar Sesión</h1>
          <p className="mt-1 text-body text-muted">Accede a tu centro de acopio</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {justRegistered && (
            <div className="rounded-lg bg-success-500/10 p-3 text-caption text-success-700">
              Cuenta creada. Inicia sesión para continuar.
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
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

          <Field id="password" label="Contraseña" required error={errors.password?.message}>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className={inputWithError(errors.password)}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
        </form>

        <p className="mt-6 text-center text-caption text-muted">
          ¿No tienes cuenta?{' '}
          <Link to="/auth/registro" className="text-primary-600 hover:text-primary-700 font-medium">
            Crear cuenta
          </Link>
        </p>

        <footer className="mt-10 border-t border-border pt-4 text-center text-caption text-muted">
          <p className="font-medium text-fg">Donario</p>
          <p>© {new Date().getFullYear()} Esteban Ramirez Grajales</p>
          <p>CC 1004702039 · estebanramirezgrajales@gmail.com</p>
        </footer>
      </div>
    </div>
  );
}
