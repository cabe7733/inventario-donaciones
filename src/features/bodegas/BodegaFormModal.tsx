import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createWarehouse, updateWarehouse, type Warehouse } from '../../lib/warehouseOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

const warehouseSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  code: z.string().min(1, 'Código requerido').max(10, 'Máximo 10 caracteres'),
  address: z.string().optional(),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

interface BodegaFormModalProps {
  warehouse: Warehouse | null;
  onClose: () => void;
}

export function BodegaFormModal({ warehouse, onClose }: BodegaFormModalProps) {
  const queryClient = useQueryClient();
  const { centerId } = useAuth();
  const [error, setError] = useState<string>();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: warehouse
      ? { name: warehouse.name, code: warehouse.code, address: warehouse.address ?? '' }
      : {},
  });

  const createMutation = useMutation({
    mutationFn: async (data: WarehouseFormData) => {
      if (!centerId) throw new Error('No hay centro asignado');
      return createWarehouse({
        center_id: centerId,
        name: data.name,
        code: data.code,
        address: data.address || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: WarehouseFormData) =>
      updateWarehouse(warehouse!.id, {
        name: data.name,
        code: data.code,
        address: data.address || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
  });

  const onSubmit = async (data: WarehouseFormData) => {
    setError(undefined);
    try {
      if (warehouse) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg.includes('duplicate') ? 'Ya existe una bodega con ese código' : msg);
    }
  };

  return (
    <Modal open onClose={onClose} title={warehouse ? 'Editar Bodega' : 'Nueva Bodega'}>
      <div className="flex flex-col gap-4 p-4">
        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field id="name" label="Nombre" required error={errors.name?.message}>
            <input id="name" {...register('name')} className={inputWithError(errors.name)} />
          </Field>

          <Field id="code" label="Código" required hint="Referencia corta, ej: BOD-01" error={errors.code?.message}>
            <input id="code" {...register('code')} className={inputWithError(errors.code)} />
          </Field>

          <Field id="address" label="Dirección" error={errors.address?.message}>
            <input id="address" {...register('address')} className={inputWithError(errors.address)} />
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
