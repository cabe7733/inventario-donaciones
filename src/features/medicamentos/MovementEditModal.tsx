import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { updateMedicationMovement } from '../../lib/medicationOps';
import { fetchLot, type Movement, type MedicationLot } from '../../lib/db';
import { fetchParties, type Party } from '../../lib/donorOps';

const editMovementSchema = z.object({
  qty: z.coerce.number().gt(0, 'La cantidad debe ser mayor a cero'),
  lote: z.string().min(1, 'Código de lote requerido'),
  fecha_vencimiento: z.string().optional(),
  fecha: z.string().min(1, 'Fecha requerida'),
  nota: z.string().optional(),
  party_id: z.string().optional(),
});

type EditMovementFormData = z.infer<typeof editMovementSchema>;

interface MovementEditModalProps {
  movement: Movement | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MovementEditModal({
  movement,
  open,
  onClose,
  onSuccess,
}: MovementEditModalProps) {
  const toast = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEntrada = movement?.kind === 'entrada';

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<EditMovementFormData>({
    resolver: zodResolver(editMovementSchema),
  });

  useEffect(() => {
    if (!open || !movement) return;

    void (async () => {
      let lotData: MedicationLot | null = null;
      if (movement.lote_id) {
        lotData = await fetchLot(movement.lote_id);
      }

      const partyList = await fetchParties(isEntrada ? 'donor' : 'recipient');
      setParties(partyList);

      reset({
        qty: movement.qty,
        lote: lotData?.lote ?? '',
        fecha_vencimiento: lotData?.fecha_vencimiento ?? '',
        fecha: movement.fecha.slice(0, 16), // YYYY-MM-DDTHH:mm
        nota: movement.nota ?? '',
        party_id: (isEntrada ? movement.donor_id : movement.recipient_id) ?? '',
      });
    })();
  }, [open, movement, reset, isEntrada]);

  if (!movement) return null;

  const onSubmit = async (data: EditMovementFormData) => {
    setIsSubmitting(true);
    try {
      await updateMedicationMovement({
        id: movement.id,
        qty: data.qty,
        loteCode: data.lote,
        fechaVencimiento: data.fecha_vencimiento || null,
        fecha: new Date(data.fecha).toISOString(),
        nota: data.nota || '',
        donorId: isEntrada ? (data.party_id || null) : null,
        recipientId: !isEntrada ? (data.party_id || null) : null,
      });

      toast.push({ message: 'Movimiento y lote actualizados correctamente', tone: 'success' });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.push({
        message: err instanceof Error ? err.message : 'Error al actualizar movimiento',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Editar ${isEntrada ? 'Entrada' : 'Salida'} de Medicamento`}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Lote y Vencimiento */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="lote" label="Código de Lote" required error={errors.lote?.message}>
            <input
              id="lote"
              {...register('lote')}
              className={inputWithError(errors.lote)}
              placeholder="Ej.: LOT-12345"
            />
          </Field>

          <Field id="fecha_vencimiento" label="Fecha de Vencimiento" error={errors.fecha_vencimiento?.message}>
            <Controller
              control={control}
              name="fecha_vencimiento"
              render={({ field }) => (
                <DatePicker
                  id="fecha_vencimiento"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        </div>

        {/* Cantidad y Fecha de movimiento */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="qty" label="Cantidad" required error={errors.qty?.message}>
            <input
              id="qty"
              type="number"
              step="any"
              {...register('qty')}
              className={inputWithError(errors.qty)}
            />
          </Field>

          <Field id="fecha" label="Fecha y hora de registro" required error={errors.fecha?.message}>
            <input
              id="fecha"
              type="datetime-local"
              {...register('fecha')}
              className={inputWithError(errors.fecha)}
            />
          </Field>
        </div>

        {/* Donante / Beneficiario */}
        <div>
          <label htmlFor="party_id" className="mb-1.5 block text-label text-fg">
            {isEntrada ? 'Donante' : 'Beneficiario'}
          </label>
          <select
            id="party_id"
            {...register('party_id')}
            className="w-full rounded-lg border border-border bg-surface p-2.5 text-body text-fg focus:border-primary-500 focus:outline-none"
          >
            <option value="">Seleccionar {isEntrada ? 'donante' : 'beneficiario'}...</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Observaciones */}
        <Field id="nota" label="Observación / Nota" error={errors.nota?.message}>
          <textarea
            id="nota"
            rows={3}
            {...register('nota')}
            className={inputWithError(errors.nota)}
          />
        </Field>

        <p className="text-caption text-muted">
          Los medicamentos tienen stock global (sin bodega asignada). La edición del código de lote o vencimiento actualizará la ficha del lote correspondiente.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
