import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createParty, updateParty, type Party, type PartyKind } from '../../lib/donorOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

const partySchema = z.object({
  full_name: z.string().min(2, 'Nombre muy corto'),
  kind: z.enum(['person', 'entity']),
  id_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
});

type PartyFormData = z.infer<typeof partySchema>;

interface Props {
  party: Party | null;
  kind: PartyKind;
  onClose: () => void;
}

export function PersonaFormModal({ party, kind, onClose }: Props) {
  const queryClient = useQueryClient();
  const { centerId } = useAuth();
  const [error, setError] = useState<string>();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: party
      ? {
          full_name: party.full_name,
          kind: party.kind,
          id_number: party.id_number ?? '',
          phone: party.phone ?? '',
          email: party.email ?? '',
          address: party.address ?? '',
        }
      : { kind: 'person' },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PartyFormData) => {
      if (!centerId) throw new Error('No hay centro asignado');
      return createParty(kind, {
        center_id: centerId,
        full_name: data.full_name,
        kind: data.kind,
        id_number: data.id_number || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', kind] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PartyFormData) =>
      updateParty(kind, party!.id, {
        full_name: data.full_name,
        kind: data.kind,
        id_number: data.id_number || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties', kind] });
      onClose();
    },
  });

  const onSubmit = async (data: PartyFormData) => {
    setError(undefined);
    try {
      if (party) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg.includes('duplicate') ? 'Ya existe un registro con ese documento' : msg);
    }
  };

  const label = kind === 'donor' ? 'Donante' : 'Beneficiario';

  return (
    <Modal open onClose={onClose} title={party ? `Editar ${label}` : `Nuevo ${label}`}>
      <div className="flex flex-col gap-4 p-4">
        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field id="full_name" label="Nombre completo" required error={errors.full_name?.message}>
            <input id="full_name" {...register('full_name')} className={inputWithError(errors.full_name)} />
          </Field>

          <div>
            <label className="mb-1.5 block text-label text-fg">Tipo</label>
            <select {...register('kind')} className={inputWithError(errors.kind)}>
              <option value="person">Persona</option>
              <option value="entity">Entidad / Empresa</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field id="id_number" label="Cédula / NIT" error={errors.id_number?.message}>
              <input id="id_number" {...register('id_number')} className={inputWithError(errors.id_number)} />
            </Field>
            <Field id="phone" label="Teléfono" error={errors.phone?.message}>
              <input id="phone" type="tel" {...register('phone')} className={inputWithError(errors.phone)} />
            </Field>
          </div>

          <Field id="email" label="Email" error={errors.email?.message}>
            <input id="email" type="email" {...register('email')} className={inputWithError(errors.email)} />
          </Field>

          <Field id="address" label="Dirección" error={errors.address?.message}>
            <input id="address" {...register('address')} className={inputWithError(errors.address)} />
          </Field>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
