import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { fetchProducts } from '../../lib/db';
import { createOrder } from '../../lib/orderOps';
import type { PartyKind } from '../../lib/donorOps';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { useToast } from '../../components/ui/Toast';

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

  const partyKind: PartyKind = initialType === 'entrada' ? 'donor' : 'recipient';

  const [orderType, setOrderType] = useState<'entrada' | 'salida'>(initialType);
  const [warehouseId, setWarehouseId] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { item_type: 'product', item_id: '', qty: 1 },
  ]);

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
    mutationFn: async () => {
      const validItems = items.filter((item) => item.item_id && item.qty > 0);
      if (validItems.length === 0) throw new Error('Debe agregar al menos un item');
      if (!warehouseId) throw new Error('Selecciona una bodega');

      return createOrder({
        order_type: orderType,
        warehouse_id: warehouseId,
        donor_id: orderType === 'entrada' ? partyId ?? undefined : undefined,
        recipient_id: orderType === 'salida' ? partyId ?? undefined : undefined,
        vehicle_plate: orderType === 'entrada' ? vehiclePlate || undefined : undefined,
        vehicle_type: orderType === 'entrada' ? vehicleType || undefined : undefined,
        vehicle_color: orderType === 'entrada' ? vehicleColor || undefined : undefined,
        items: validItems,
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header>
        <h1 className="text-h2">
          {orderType === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
        </h1>
      </header>

      <div className="flex flex-col gap-6">
        {/* Type selector */}
        <Segmented
          ariaLabel="Tipo de movimiento"
          value={orderType}
          onChange={(val) => { setOrderType(val); setPartyId(null); }}
          options={[
            { value: 'entrada', label: 'Entrada' },
            { value: 'salida', label: 'Salida' },
          ]}
        />

        {/* Warehouse */}
        <WarehouseSelect value={warehouseId} onChange={setWarehouseId} required />

        {/* Donor/Recipient */}
        <QuickPartySelect
          kind={partyKind}
          value={partyId}
          onChange={setPartyId}
          required
          label={orderType === 'entrada' ? 'Donante' : 'Beneficiario'}
        />

        {/* Vehicle section (entrada only) */}
        {orderType === 'entrada' && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Vehículo (opcional)</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="vehicle_plate" label="Placa">
                <input id="vehicle_plate" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className={inputWithError(undefined)} />
              </Field>
              <Field id="vehicle_type" label="Tipo">
                <select id="vehicle_type" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputWithError(undefined)}>
                  <option value="">Seleccionar...</option>
                  <option value="auto">Auto</option>
                  <option value="camioneta">Camioneta</option>
                  <option value="van">Van</option>
                  <option value="camion">Camión</option>
                </select>
              </Field>
              <Field id="vehicle_color" label="Color">
                <input id="vehicle_color" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className={inputWithError(undefined)} />
              </Field>
            </div>
          </section>
        )}

        {/* Items section */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Items</h2>
            <Button type="button" variant="ghost" onClick={addItem}>
              <Plus size={18} className="mr-1" />
              Agregar
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
                    <option value="">Seleccionar...</option>
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

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => void createMutation.mutateAsync()}
          >
            {createMutation.isPending ? 'Registrando...' : `Registrar ${orderType === 'entrada' ? 'entrada' : 'salida'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
