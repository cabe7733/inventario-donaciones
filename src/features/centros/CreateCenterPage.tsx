import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { DEPARTAMENTOS, municipiosFor } from '../../lib/colombia';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const centerSchema = z.object({
  // Step 1: Center data
  name: z.string().min(2, 'Nombre muy corto'),
  address: z.string().min(1, 'Dirección requerida'),
  city: z.string().optional(),
  state: z.string().min(1, 'Selecciona un departamento'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  // Step 2: Representative data
  entity_type: z.enum(['person', 'entity']),
  entity_name: z.string().min(1, 'Nombre requerido'),
  entity_rfc: z.string().min(1, 'Cédula o NIT requerido'),
  representative_name: z.string().optional(),
  representative_phone: z.string().optional(),
  representative_email: z.string().email('Email inválido').optional().or(z.literal('')),
}).refine(
  (data) => data.entity_type !== 'entity' || (data.representative_name && data.representative_name.length > 0),
  { message: 'Nombre del representante requerido', path: ['representative_name'] },
);

type CenterFormData = z.infer<typeof centerSchema>;

export function CreateCenterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CenterFormData>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      entity_type: 'person',
    },
  });

  const entityType = watch('entity_type');
  const state = watch('state');
  const city = watch('city') ?? '';
  const municipios = municipiosFor(state);

  const onSubmit = async (data: CenterFormData) => {
    setError(undefined);
    setIsSubmitting(true);

    try {
      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { error: rpcError } = await supabase.rpc('create_center', {
        p_name: data.name,
        p_slug: slug,
        p_address: data.address,
        p_city: data.city ?? '',
        p_state: data.state ?? '',
        p_phone: data.phone ?? '',
        p_email: data.email ?? '',
        p_entity_type: data.entity_type,
        p_entity_name: data.entity_name,
        p_entity_rfc: data.entity_rfc,
        p_representative_name: data.representative_name,
        p_representative_phone: data.representative_phone ?? '',
        p_representative_email: data.representative_email ?? '',
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      await refresh();
      navigate('/inicio', { replace: true });
    } catch {
      setError('Error al crear el centro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Crear Centro de Acopio</h1>
          <p className="mt-1 text-body text-muted">Paso {step} de 3</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Step 1: Center data */}
          {step === 1 && (
            <>
              <h2 className="text-h3 text-fg">Datos del Centro</h2>

              <Field id="name" label="Nombre del centro" required error={errors.name?.message}>
                <input id="name" {...register('name')} className={inputWithError(errors.name)} />
              </Field>

              <Field id="address" label="Dirección" required error={errors.address?.message}>
                <input id="address" {...register('address')} className={inputWithError(errors.address)} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field id="state" label="Departamento" required error={errors.state?.message}>
                  <SearchableSelect
                    id="state"
                    value={state ?? ''}
                    onChange={(v) => {
                      setValue('state', v, { shouldValidate: true });
                      if (city && !municipiosFor(v).includes(city)) {
                        setValue('city', '', { shouldValidate: false });
                      }
                    }}
                    options={DEPARTAMENTOS.map((d) => d.name)}
                    placeholder="Selecciona un departamento"
                  />
                </Field>

                <Field id="city" label="Municipio" error={errors.city?.message}>
                  <SearchableSelect
                    id="city"
                    value={city}
                    onChange={(v) => setValue('city', v, { shouldValidate: true })}
                    options={municipios}
                    placeholder={state ? 'Selecciona un municipio' : 'Primero elige un departamento'}
                    emptyText={state ? 'Sin resultados' : 'Selecciona un departamento'}
                    disabled={!state}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field id="phone" label="Teléfono" hint="Ej.: 300 123 4567" error={errors.phone?.message}>
                  <input id="phone" type="tel" placeholder="300 123 4567" {...register('phone')} className={inputWithError(errors.phone)} />
                </Field>

                <Field id="email-center" label="Email del centro" error={errors.email?.message}>
                  <input id="email-center" type="email" {...register('email')} className={inputWithError(errors.email)} />
                </Field>
              </div>

              <Button type="button" onClick={() => setStep(2)} className="w-full">
                Siguiente
              </Button>
            </>
          )}

          {/* Step 2: Representative data */}
          {step === 2 && (
            <>
              <h2 className="text-h3 text-fg">Representante Legal</h2>

              <div>
                <label className="mb-1.5 block text-label text-fg">Tipo</label>
                <Segmented
                  ariaLabel="Tipo de representante"
                  value={entityType}
                  onChange={(val) => setValue('entity_type', val)}
                  options={[
                    { value: 'person', label: 'Persona natural' },
                    { value: 'entity', label: 'Persona jurídica' },
                  ]}
                />
              </div>

              <Field id="entity_name" label={entityType === 'person' ? 'Nombre completo' : 'Razón social'} required error={errors.entity_name?.message}>
                <input id="entity_name" {...register('entity_name')} className={inputWithError(errors.entity_name)} />
              </Field>

              <Field id="entity_rfc" label={entityType === 'person' ? 'Cédula de ciudadanía' : 'NIT'} required error={errors.entity_rfc?.message}>
                <input
                  id="entity_rfc"
                  placeholder={entityType === 'person' ? 'Ej.: 1234567890' : 'Ej.: 900123456-7'}
                  {...register('entity_rfc')}
                  className={inputWithError(errors.entity_rfc)}
                />
              </Field>

              {entityType === 'entity' && (
                <Field id="representative_name" label="Nombre del representante" required error={errors.representative_name?.message}>
                  <input id="representative_name" {...register('representative_name')} className={inputWithError(errors.representative_name)} />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field id="representative_phone" label="Teléfono" error={errors.representative_phone?.message}>
                  <input id="representative_phone" type="tel" placeholder="300 123 4567" {...register('representative_phone')} className={inputWithError(errors.representative_phone)} />
                </Field>

                <Field id="representative_email" label="Email" error={errors.representative_email?.message}>
                  <input id="representative_email" type="email" {...register('representative_email')} className={inputWithError(errors.representative_email)} />
                </Field>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1">
                  Atrás
                </Button>
                <Button type="button" onClick={() => setStep(3)} className="flex-1">
                  Siguiente
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <>
              <h2 className="text-h3 text-fg">Confirmación</h2>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-2 font-medium text-fg">Centro de Acopio</h3>
                <p className="text-body text-muted">{watch('name')}</p>
                <p className="text-caption text-muted">{watch('address')}</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-2 font-medium text-fg">Representante Legal</h3>
                <p className="text-body text-muted">{watch('entity_name')}</p>
                <p className="text-caption text-muted">{watch('entity_rfc')}</p>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1">
                  Atrás
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Creando...' : 'Crear Centro'}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
