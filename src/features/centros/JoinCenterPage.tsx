import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

const joinSchema = z.object({
  invitationCode: z.string().uuid('Código de invitación inválido'),
});

type JoinFormData = z.infer<typeof joinSchema>;

export function JoinCenterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
  });

  const onSubmit = async (data: JoinFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        p_invitation_id: data.invitationCode,
      });

      if (acceptError) {
        setError(
          acceptError.message.includes('Invitación no encontrada')
            ? 'Invitación no encontrada o expirada'
            : acceptError.message,
        );
        return;
      }

      await refresh();
      navigate('/inicio', { replace: true });
    } catch {
      setError('Error al unirse al centro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Unirse a Centro</h1>
          <p className="mt-1 text-center text-body text-muted">
            Pega el código de invitación que recibiste por correo
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
              {error}
            </div>
          )}

          <Field id="invitationCode" label="Código de invitación" required error={errors.invitationCode?.message}>
            <input
              id="invitationCode"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              {...register('invitationCode')}
              className={inputWithError(errors.invitationCode)}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Uniéndose...' : 'Unirse al Centro'}
          </Button>
        </form>

        <p className="mt-6 text-center text-caption text-muted">
          ¿Quieres crear tu propio centro?{' '}
          <Link to="/onboarding/crear-centro" className="text-primary-600 hover:text-primary-700 font-medium">
            Crear centro
          </Link>
        </p>
      </div>
    </div>
  );
}
