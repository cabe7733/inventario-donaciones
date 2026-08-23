import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash } from '@phosphor-icons/react';
import { fetchProducts } from '../../lib/db';
import { createOrder } from '../../lib/orderOps';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

const orderSchema = z.object({
  order_type: z.enum(['entrada', 'salida']),
  // Donor (entrada)
  donor_full_name: z.string().optional(),
  donor_id_number: z.string().optional(),
  donor_phone: z.string().optional(),
  donor_email: z.string().email('Email inválido').optional().or(z.literal('')),
  donor_entity_name: z.string().optional(),
  // Vehicle (entrada)
  vehicle_plate: z.string().optional(),
  vehicle_type: z.string().optional(),
  vehicle_color: z.string().optional(),
  // Recipient (salida)
  recipient_full_name: z.string().optional(),
  recipient_id_number: z.string().optional(),
  recipient_phone: z.string().optional(),
  recipient_email: z.string().email('Email inválido').optional().or(z.literal('')),
  recipient_entity_name: z.string().optional(),
  recipient_type: z.enum(['person', 'entity']).optional(),
  // Notes
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderItem {
  item_type: 'product' | 'medication' | 'kit';
  item_id: string;
  qty: number;
}

export function OrderFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = (params.get('tipo') as 'entrada' | 'salida') ?? 'entrada';
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const [orderType, setOrderType] = useState<'entrada' | 'salida'>(initialType);
  const [items, setItems] = useState<OrderItem[]>([
    { item_type: 'product', item_id: '', qty: 1 },
  ]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  const productOptions = useMemo(
    () => products.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name })),
    [products],
  );

  const addItem = () => {
    setItems([...items, { item_type: 'product', item_id: '', qty: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const createMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const validItems = items.filter((item) => item.item_id && item.qty > 0);
      if (validItems.length === 0) throw new Error('Debe agregar al menos un item');

      return createOrder({
        order_type: orderType,
        donor_full_name: data.donor_full_name,
        donor_id_number: data.donor_id_number,
        donor_phone: data.donor_phone,
        donor_email: data.donor_email,
        donor_entity_name: data.donor_entity_name,
        vehicle_plate: data.vehicle_plate,
        vehicle_type: data.vehicle_type,
        vehicle_color: data.vehicle_color,
        recipient_full_name: data.recipient_full_name,
        recipient_id_number: data.recipient_id_number,
        recipient_phone: data.recipient_phone,
        recipient_email: data.recipient_email,
        recipient_entity_name: data.recipient_entity_name,
        recipient_type: data.recipient_type,
        items: validItems,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.push({
        message: orderType === 'entrada' ? 'Entrada registrada exitosamente' : 'Salida registrada exitosamente',
        tone: 'success',
      });
      navigate(orderType === 'entrada' ? '/entradas' : '/salidas');
    },
    onError: (error) => {
      toast.push({
        message: error instanceof Error ? error.message : 'Error al registrar',
        tone: 'error',
      });
    },
  });

  const onSubmit = (data: OrderFormData) => createMutation.mutateAsync(data);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header>
        <h1 className="text-h2">
          {orderType === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
        </h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Type selector */}
        <Segmented
          ariaLabel="Tipo de movimiento"
          value={orderType}
          onChange={setOrderType}
          options={[
            { value: 'entrada', label: 'Entrada' },
            { value: 'salida', label: 'Salida' },
          ]}
        />

        {/* Donor/Recipient section */}
        {orderType === 'entrada' ? (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Datos del Donante</h2>
            <Field id="donor_full_name" label="Nombre completo" error={errors.donor_full_name?.message}>
              <input id="donor_full_name" {...register('donor_full_name')} className={inputWithError(errors.donor_full_name)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="donor_id_number" label="Cédula/RFC" error={errors.donor_id_number?.message}>
                <input id="donor_id_number" {...register('donor_id_number')} className={inputWithError(errors.donor_id_number)} />
              </Field>
              <Field id="donor_phone" label="Teléfono" error={errors.donor_phone?.message}>
                <input id="donor_phone" {...register('donor_phone')} className={inputWithError(errors.donor_phone)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field id="donor_email" label="Email" error={errors.donor_email?.message}>
                <input id="donor_email" type="email" {...register('donor_email')} className={inputWithError(errors.donor_email)} />
              </Field>
              <Field id="donor_entity_name" label="Empresa/Entidad" error={errors.donor_entity_name?.message}>
                <input id="donor_entity_name" {...register('donor_entity_name')} className={inputWithError(errors.donor_entity_name)} />
              </Field>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Datos del Destinatario</h2>
            <Field id="recipient_full_name" label="Nombre completo" error={errors.recipient_full_name?.message}>
              <input id="recipient_full_name" {...register('recipient_full_name')} className={inputWithError(errors.recipient_full_name)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="recipient_id_number" label="Cédula/RFC" error={errors.recipient_id_number?.message}>
                <input id="recipient_id_number" {...register('recipient_id_number')} className={inputWithError(errors.recipient_id_number)} />
              </Field>
              <Field id="recipient_phone" label="Teléfono" error={errors.recipient_phone?.message}>
                <input id="recipient_phone" {...register('recipient_phone')} className={inputWithError(errors.recipient_phone)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field id="recipient_email" label="Email" error={errors.recipient_email?.message}>
                <input id="recipient_email" type="email" {...register('recipient_email')} className={inputWithError(errors.recipient_email)} />
              </Field>
              <Field id="recipient_entity_name" label="Empresa/Organización" error={errors.recipient_entity_name?.message}>
                <input id="recipient_entity_name" {...register('recipient_entity_name')} className={inputWithError(errors.recipient_entity_name)} />
              </Field>
            </div>
          </section>
        )}

        {/* Vehicle section (entrada only) */}
        {orderType === 'entrada' && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Vehículo (opcional)</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field id="vehicle_plate" label="Placa" error={errors.vehicle_plate?.message}>
                <input id="vehicle_plate" {...register('vehicle_plate')} className={inputWithError(errors.vehicle_plate)} />
              </Field>
              <Field id="vehicle_type" label="Tipo" error={errors.vehicle_type?.message}>
                <select id="vehicle_type" {...register('vehicle_type')} className={inputWithError(errors.vehicle_type)}>
                  <option value="">Seleccionar...</option>
                  <option value="auto">Auto</option>
                  <option value="camioneta">Camioneta</option>
                  <option value="van">Van</option>
                  <option value="camion">Camión</option>
                </select>
              </Field>
              <Field id="vehicle_color" label="Color" error={errors.vehicle_color?.message}>
                <input id="vehicle_color" {...register('vehicle_color')} className={inputWithError(errors.vehicle_color)} />
              </Field>
            </div>
          </section>
        )}

        {/* Items section */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Items del Pedido</h2>
            <Button type="button" variant="ghost" onClick={addItem}>
              <Plus size={18} className="mr-1" />
              Agregar item
            </Button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="flex-1">
                <Field id={`item-${index}`} label={index === 0 ? 'Producto' : ''} error={undefined}>
                  <select
                    id={`item-${index}`}
                    value={item.item_id}
                    onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                    className={inputWithError(undefined)}
                  >
                    <option value="">Seleccionar producto...</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="w-24">
                <Field id={`qty-${index}`} label={index === 0 ? 'Cantidad' : ''} error={undefined}>
                  <input
                    id={`qty-${index}`}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value, 10) || 1)}
                    className={inputWithError(undefined)}
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700"
                aria-label="Eliminar item"
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
        </section>

        {/* Notes */}
        <Field id="notes" label="Notas" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={3}
            {...register('notes')}
            className={inputWithError(errors.notes)}
          />
        </Field>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : `Registrar ${orderType === 'entrada' ? 'entrada' : 'salida'}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
