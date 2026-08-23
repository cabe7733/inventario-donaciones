import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createVolunteer, updateVolunteer, type Volunteer } from '../../lib/volunteerOps';
import { supabase } from '../../lib/supabase';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

const volunteerSchema = z.object({
  full_name: z.string().min(2, 'Nombre muy corto'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  id_number: z.string().optional(),
  availability: z.string().optional(),
});

type VolunteerFormData = z.infer<typeof volunteerSchema>;

interface VoluntarioFormModalProps {
  volunteer: Volunteer | null;
  onClose: () => void;
}

export function VoluntarioFormModal({ volunteer, onClose }: VoluntarioFormModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: volunteer
      ? {
          full_name: volunteer.full_name,
          email: volunteer.email ?? '',
          phone: volunteer.phone ?? '',
          id_number: volunteer.id_number ?? '',
          availability: volunteer.availability ?? '',
        }
      : {},
  });

  const createMutation = useMutation({
    mutationFn: async (data: VolunteerFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: membership } = await supabase
        .from('center_members')
        .select('center_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!membership) throw new Error('No tienes un centro asignado');

      return createVolunteer({
        center_id: membership.center_id,
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        id_number: data.id_number || null,
        skills: null,
        availability: data.availability || null,
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: VolunteerFormData) =>
      updateVolunteer(volunteer!.id, {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        id_number: data.id_number || null,
        availability: data.availability || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      onClose();
    },
  });

  const onSubmit = async (data: VolunteerFormData) => {
    setError(undefined);
    try {
      if (volunteer) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  return (
    <Modal open onClose={onClose} title={volunteer ? 'Editar Voluntario' : 'Nuevo Voluntario'}>
      <div className="flex flex-col gap-4 p-4">

        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field id="full_name" label="Nombre completo" required error={errors.full_name?.message}>
            <input id="full_name" {...register('full_name')} className={inputWithError(errors.full_name)} />
          </Field>

          <Field id="email" label="Email" error={errors.email?.message}>
            <input id="email" type="email" {...register('email')} className={inputWithError(errors.email)} />
          </Field>

          <Field id="phone" label="Teléfono" hint="Ej.: 300 123 4567" error={errors.phone?.message}>
            <input id="phone" type="tel" placeholder="300 123 4567" {...register('phone')} className={inputWithError(errors.phone)} />
          </Field>

          <Field id="id_number" label="Cédula o NIT" error={errors.id_number?.message}>
            <input id="id_number" placeholder="Ej.: 1234567890" {...register('id_number')} className={inputWithError(errors.id_number)} />
          </Field>

          <Field id="availability" label="Disponibilidad" error={errors.availability?.message}>
            <select id="availability" {...register('availability')} className={inputWithError(errors.availability)}>
              <option value="">Seleccionar...</option>
              <option value="tiempo completo">Tiempo completo</option>
              <option value="fines de semana">Fines de semana</option>
              <option value="flexible">Flexible</option>
              <option value="eventos especiales">Eventos especiales</option>
            </select>
          </Field>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
