import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CaretLeft } from '@phosphor-icons/react';
import { fetchCenter, updateCenter, type Center } from '../../lib/centerOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { DEPARTAMENTOS, municipiosFor } from '../../lib/colombia';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useToast } from '../../components/ui/Toast';

const centerSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  address: z.string().min(1, 'Dirección requerida'),
  city: z.string().optional(),
  state: z.string().min(1, 'Selecciona un departamento'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
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

export function EditCenterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { centerId, role } = useAuth();
  const [center, setCenter] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CenterFormData>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      entity_type: 'person',
    },
  });

  const entityType = watch('entity_type');
  const state = watch('state');
  const city = watch('city') ?? '';
  const municipios = municipiosFor(state);

  useEffect(() => {
    if (!centerId) return;
    fetchCenter(centerId).then((c) => {
      setCenter(c);
      if (c) {
        reset({
          name: c.name ?? '',
          address: c.address ?? '',
          city: c.city ?? '',
          state: c.state ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          entity_type: (c.entity_type as 'person' | 'entity' | null) ?? 'person',
          entity_name: c.entity_name ?? '',
          entity_rfc: c.entity_rfc ?? '',
          representative_name: c.representative_name ?? '',
          representative_phone: c.representative_phone ?? '',
          representative_email: c.representative_email ?? '',
        });
      }
      setLoading(false);
    });
  }, [centerId, reset]);

  const onSubmit = async (data: CenterFormData) => {
    setError(undefined);
    setIsSubmitting(true);
    try {
      await updateCenter({
        name: data.name,
        address: data.address,
        city: data.city ?? '',
        state: data.state ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        entity_type: data.entity_type,
        entity_name: data.entity_name,
        entity_rfc: data.entity_rfc,
        representative_name: data.representative_name ?? '',
        representative_phone: data.representative_phone ?? '',
        representative_email: data.representative_email ?? '',
      });
      toast.push({ message: 'Centro actualizado', tone: 'success' });
      navigate('/centro');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar el centro');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-4 lg:p-6">Cargando...</div>;
  }

  if (!center) {
    return <div className="p-4 lg:p-6">Centro no encontrado</div>;
  }

  const canEdit = role === 'super_admin';

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Link to="/centro" className="inline-flex items-center gap-1 text-caption text-muted hover:text-primary-700">
          <CaretLeft size={14} aria-hidden="true" /> Volver
        </Link>
        <div className="rounded-lg border border-warning-500/40 bg-warning-500/10 p-3 text-caption text-warning-700">
          Solo el super_admin del centro puede modificar los datos del centro.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Link to="/centro" className="inline-flex items-center gap-1 text-caption text-muted hover:text-primary-700">
        <CaretLeft size={14} aria-hidden="true" /> Volver a Mi Centro
      </Link>

      <header>
        <h1 className="text-h2">Editar centro</h1>
        <p className="mt-1 text-caption text-muted">
          Modifica los datos del centro de acopio.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-h3">Datos del Centro</h2>

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
            <Field id="email" label="Email del centro" error={errors.email?.message}>
              <input id="email" type="email" {...register('email')} className={inputWithError(errors.email)} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-h3">Representante Legal</h2>

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
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/centro')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
