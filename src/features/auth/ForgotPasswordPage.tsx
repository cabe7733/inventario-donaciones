import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/auth/restablecer`;
      const { error: authError } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSent(true);
    } catch {
      setError('Error al solicitar recuperación de contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Recuperar Contraseña</h1>
          <p className="mt-1 text-body text-muted">Te enviaremos un enlace a tu correo</p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4 rounded-lg bg-card p-6 border border-border text-center">
            <div className="rounded-lg bg-success-500/10 p-4 text-body text-success-700">
              Hemos enviado las instrucciones para restablecer tu contraseña a tu correo electrónico.
            </div>
            <p className="text-caption text-muted">
              Por favor revisa tu bandeja de entrada o carpeta de spam y sigue el enlace adjunto.
            </p>
            <Link to="/auth/login" className="mt-2 text-primary-600 hover:text-primary-700 font-medium">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
                {error}
              </div>
            )}

            <Field id="email" label="Email registrado" required error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                {...register('email')}
                className={inputWithError(errors.email)}
              />
            </Field>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Enviando correo...' : 'Enviar correo de recuperación'}
            </Button>
          </form>
        )}

        {!sent && (
          <p className="mt-6 text-center text-caption text-muted">
            <Link to="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Volver a iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
