import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle } from '@phosphor-icons/react';
import { createWarehouse, updateWarehouse, type Warehouse } from '../../lib/warehouseOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

const createSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  address: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  address: z.string().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

interface BodegaFormModalProps {
  warehouse: Warehouse | null;
  onClose: () => void;
}

export function BodegaFormModal({ warehouse, onClose }: BodegaFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { centerId } = useAuth();
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<Warehouse | null>(null);

  const isEditing = !!warehouse;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: {
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      if (!centerId) throw new Error('No hay centro asignado');
      return createWarehouse({
        center_id: centerId,
        name: data.name,
        address: data.address || undefined,
      });
    },
    onSuccess: (created_warehouse) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setCreated(created_warehouse);
      toast.push({ message: `Bodega creada con código ${created_warehouse.code}`, tone: 'success' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditFormData) =>
      updateWarehouse(warehouse!.id, {
        name: data.name,
        address: data.address || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.push({ message: 'Bodega actualizada', tone: 'success' });
      onClose();
    },
  });

  const onSubmit = async (data: CreateFormData | EditFormData) => {
    setError(undefined);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync(data as EditFormData);
      } else {
        await createMutation.mutateAsync(data as CreateFormData);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg);
    }
  };

  const handleClose = () => {
    setCreated(null);
    setError(undefined);
    onClose();
  };

  if (created) {
    return (
      <Modal open onClose={handleClose} title="Bodega creada">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-success-500/15 p-3 text-body-sm text-success-700">
            <CheckCircle size={20} weight="bold" aria-hidden="true" />
            <span>La bodega fue creada con éxito.</span>
          </div>

          <Field id="created-name" label="Nombre">
            <input
              id="created-name"
              value={created.name}
              disabled
              className={inputWithError(undefined)}
            />
          </Field>

          <Field id="created-address" label="Dirección">
            <input
              id="created-address"
              value={created.address ?? ''}
              disabled
              className={inputWithError(undefined)}
            />
          </Field>

          <Field
            id="created-code"
            label="Código"
            hint="Generado automáticamente. No se puede modificar."
          >
            <input
              id="created-code"
              value={created.code}
              disabled
              className={`${inputWithError(undefined)} font-mono font-semibold`}
            />
          </Field>

          <div className="flex justify-end">
            <Button onClick={handleClose}>Listo</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={handleClose} title={isEditing ? 'Editar Bodega' : 'Nueva Bodega'}>
      <div className="flex flex-col gap-4 p-4">
        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field id="name" label="Nombre" required error={errors.name?.message}>
            <input id="name" {...register('name')} className={inputWithError(errors.name)} />
          </Field>

          <Field id="address" label="Dirección" error={errors.address?.message}>
            <input id="address" {...register('address')} className={inputWithError(errors.address)} />
          </Field>

          <p className="text-caption text-muted">
            El código se generará automáticamente al guardar.
          </p>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>
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