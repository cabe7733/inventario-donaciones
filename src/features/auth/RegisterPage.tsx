import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';

const registerSchema = z.object({
  first_name: z.string().min(1, 'Nombre requerido'),
  last_name: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
  doc_type: z.enum(['cc', 'ce', 'ti', 'nit', 'pasaporte']),
  doc_number: z.string().min(1, 'Número de documento requerido'),
  birth_date: z.string().min(1, 'Fecha de nacimiento requerida'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

type DocType = 'cc' | 'ce' | 'ti' | 'nit' | 'pasaporte';

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'cc', label: 'C.C.' },
  { value: 'ce', label: 'C.E.' },
  { value: 'ti', label: 'T.I.' },
  { value: 'nit', label: 'NIT' },
  { value: 'pasaporte', label: 'Pasaporte' },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      doc_type: 'cc',
    },
  });

  const docType = watch('doc_type');

  const onSubmit = async (data: RegisterFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            full_name: `${data.first_name} ${data.last_name}`,
            doc_type: data.doc_type,
            doc_number: data.doc_number,
            birth_date: data.birth_date,
          },
        },
      });

      if (authError) {
        setError(authError.message === 'User already registered'
          ? 'Este email ya está registrado'
          : authError.message);
        return;
      }

      // ponytail: signup abre sesión automática; la cerramos para que el
      // flujo pedido sea registro -> login. Confirm email debe estar OFF
      // en Supabase (Auth > Providers > Email).
      if (signUpData.session) {
        await supabase.auth.signOut();
      }

      navigate('/auth/login', {
        replace: true,
        state: { registered: true },
      });
    } catch {
      setError('Error al crear la cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Crear Cuenta</h1>
          <p className="mt-1 text-body text-muted">Regístrate en Donario</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
              {error}
            </div>
          )}

          <Field id="first_name" label="Nombre" required error={errors.first_name?.message}>
            <input
              id="first_name"
              autoComplete="given-name"
              {...register('first_name')}
              className={inputWithError(errors.first_name)}
            />
          </Field>

          <Field id="last_name" label="Apellido" required error={errors.last_name?.message}>
            <input
              id="last_name"
              autoComplete="family-name"
              {...register('last_name')}
              className={inputWithError(errors.last_name)}
            />
          </Field>

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

          <div>
            <label className="mb-1.5 block text-label text-fg">Tipo de documento</label>
            <Segmented<DocType>
              ariaLabel="Tipo de documento"
              value={docType}
              onChange={(val) => setValue('doc_type', val)}
              options={DOC_TYPE_OPTIONS}
            />
          </div>

          <Field id="doc_number" label="Número de documento" required error={errors.doc_number?.message}>
            <input
              id="doc_number"
              placeholder={docType === 'nit' ? 'Ej.: 900123456-7' : 'Ej.: 1234567890'}
              {...register('doc_number')}
              className={inputWithError(errors.doc_number)}
            />
          </Field>

          <Field id="birth_date" label="Fecha de nacimiento" required error={errors.birth_date?.message}>
            <input
              id="birth_date"
              type="date"
              {...register('birth_date')}
              className={inputWithError(errors.birth_date)}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-caption text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
