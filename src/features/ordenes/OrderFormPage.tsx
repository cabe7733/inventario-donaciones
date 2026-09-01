import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { fetchProducts } from '../../lib/db';
import { createOrder, replaceOrder, fetchOrderWithItems } from '../../lib/orderOps';
import { warehouseStocksBulk } from '../../lib/warehouseOps';
import { formatNumber } from '../../lib/format';
import type { PartyKind } from '../../lib/donorOps';
import type { AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { QuickProductSelect } from '../../components/ui/QuickProductSelect';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';

interface OrderItem {
  item_type: 'product' | 'medication' | 'kit';
  item_id: string;
  // ponytail: qty como string para permitir vacío en el input.
  // Se parsea al validar. '' = sin llenar.
  qty: string;
}

export function OrderFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = (params.get('tipo') as 'entrada' | 'salida') ?? 'entrada';
  const editingId = params.get('id');
  const isEditing = !!editingId;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const { data: existingOrder, isLoading: loadingOrder } = useQuery({
    queryKey: ['order', editingId],
    queryFn: () => fetchOrderWithItems(editingId!),
    enabled: isEditing,
  });

  const [orderType, setOrderType] = useState<'entrada' | 'salida'>(initialType);
  const [warehouseId, setWarehouseId] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { item_type: 'product', item_id: '', qty: '' },
  ]);

  // Cargar datos al editar.
  useEffect(() => {
    if (!existingOrder) return;
    setOrderType(existingOrder.order_type);
    setWarehouseId(existingOrder.warehouse_id);
    setPartyId(existingOrder.donor_id ?? existingOrder.recipient_id ?? null);
    setVehiclePlate(existingOrder.vehicle_plate ?? '');
    setVehicleType(existingOrder.vehicle_type ?? '');
    setVehicleColor(existingOrder.vehicle_color ?? '');
    const loaded = (existingOrder.order_items ?? []).map((it) => ({
      item_type: it.item_type,
      item_id: it.item_id,
      qty: String(it.qty),
    }));
    setItems(loaded.length > 0 ? loaded : [{ item_type: 'product', item_id: '', qty: '' }]);
  }, [existingOrder]);

  const partyKind: PartyKind = orderType === 'entrada' ? 'donor' : 'recipient';

  const productOptions = useMemo(
    () => products.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name })),
    [products],
  );

  const [stocks, setStocks] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!warehouseId) { setStocks(new Map()); return; }
    let cancelled = false;
    warehouseStocksBulk(warehouseId)
      .then((m) => { if (!cancelled) setStocks(m); })
      .catch(() => { if (!cancelled) setStocks(new Map()); });
    return () => { cancelled = true; };
  }, [warehouseId]);

  const stockByItem = (itemId: string) => stocks.get(`product:${itemId}`) ?? 0;

  const addItem = () => {
    setItems([...items, { item_type: 'product', item_id: '', qty: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    if (field === 'item_id') {
      const newId = String(value);
      if (newId && items.some((it, i) => i !== index && it.item_id === newId)) {
        toast.push({ message: 'Este producto ya fue agregado', tone: 'error' });
        return;
      }
    }
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // ponytail: en modo edición, "sumar el stock disponible al que ya tenía la
  // orden" — porque replace_order revierte los movements previos antes de
  // aplicar los nuevos, así que al volver a enviar las mismas cantidades
  // el saldo neto queda correcto sin "Stock insuficiente".
  const effectiveStockByItem = (itemId: string): number => {
    const base = stockByItem(itemId);
    if (!isEditing || !existingOrder) return base;
    const sameItem = existingOrder.order_items?.find(
      (it) => it.item_type === 'product' && it.item_id === itemId,
    );
    return sameItem ? base + sameItem.qty : base;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validar filas: cada item con producto seleccionado debe tener cantidad > 0.
      const parsed: Array<{ item_type: 'product' | 'medication' | 'kit'; item_id: string; qty: number }> = [];
      for (const it of items) {
        if (!it.item_id) continue;
        const qtyNum = Number.parseInt(it.qty, 10);
        if (!(qtyNum >= 1)) {
          throw new Error('La cantidad es obligatoria para todos los productos');
        }
        parsed.push({ item_type: it.item_type, item_id: it.item_id, qty: qtyNum });
      }
      if (parsed.length === 0) throw new Error('Debe agregar al menos un item');
      if (!warehouseId) throw new Error('Selecciona una bodega');

      const baseInput = {
        warehouse_id: warehouseId,
        donor_id: orderType === 'entrada' ? partyId ?? undefined : undefined,
        recipient_id: orderType === 'salida' ? partyId ?? undefined : undefined,
        vehicle_plate: orderType === 'entrada' ? vehiclePlate || undefined : undefined,
        vehicle_type: orderType === 'entrada' ? vehicleType || undefined : undefined,
        vehicle_color: orderType === 'entrada' ? vehicleColor || undefined : undefined,
        items: parsed,
      };

      if (isEditing) {
        await replaceOrder(editingId!, baseInput);
        return 'updated' as const;
      }
      await createOrder({ order_type: orderType, ...baseInput });
      return 'created' as const;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', editingId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      toast.push({
        message: result === 'updated'
          ? 'Orden actualizada exitosamente'
          : orderType === 'entrada' ? 'Entrada registrada exitosamente' : 'Salida registrada exitosamente',
        tone: 'success',
      });
      navigate(orderType === 'entrada' ? '/entradas' : '/salidas');
    },
    onError: (error) => {
      toast.push({
        message: error instanceof Error ? error.message : 'Error al guardar',
        tone: 'error',
      });
    },
  });

  if (isEditing && role !== 'super_admin') {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-h2">Editar orden</h1>
        <p className="text-body text-muted">Solo el super admin puede editar órdenes.</p>
      </div>
    );
  }

  if (isEditing && loadingOrder) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-h2">Editar orden</h1>
        <p className="text-body text-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header>
        <h1 className="text-h2">
          {isEditing
            ? `Editar ${orderType === 'entrada' ? 'entrada' : 'salida'}`
            : (orderType === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida')}
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
          <h2 className="text-h3">Items</h2>

          {items.map((item, index) => {
            const stock = item.item_id ? effectiveStockByItem(item.item_id) : 0;
            const usedInOtherRow = (id: string) =>
              items.some((it, i) => i !== index && it.item_id === id);
            const itemOptions: AocItem[] = productOptions
              .filter((p) => !usedInOtherRow(p.id))
              .map((p) => {
                const whStock = stocks.get(`product:${p.id}`) ?? 0;
                return {
                  id: p.id,
                  label: p.name,
                  sublabel: warehouseId
                    ? whStock > 0
                      ? `Stock en bodega: ${formatNumber(whStock)}`
                      : 'Sin stock en esta bodega'
                    : undefined,
                };
              });
            return (
              <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <QuickProductSelect
                    label={index === 0 ? 'Producto' : ''}
                    value={item.item_id || null}
                    onChange={(id) => updateItem(index, 'item_id', id ?? '')}
                    items={itemOptions}
                    onCreated={(newProduct) => {
                      void queryClient.invalidateQueries({ queryKey: ['products'] });
                      updateItem(index, 'item_id', newProduct.id);
                    }}
                  />
                </div>
                <div className="w-24">
                  <Field id={`qty-${index}`} label={index === 0 ? 'Cantidad' : ''} error={undefined}>
                    <input
                      id={`qty-${index}`}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(index, 'qty', e.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="Cantidad"
                      className={inputWithError(undefined)}
                    />
                  </Field>
                </div>
                {item.item_id && warehouseId && (
                  stock <= 0 ? (
                    <p className="text-caption text-danger-700 sm:max-w-[14rem] sm:self-center">
                      Este producto no tiene stock en la bodega seleccionada.
                    </p>
                  ) : (
                    <p className="text-caption text-muted sm:self-center">
                      Stock disponible: {formatNumber(stock)}
                    </p>
                  )
                )}
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700"
                  aria-label="Eliminar item"
                >
                  <Trash size={18} />
                </button>
              </div>
            );
          })}

          <div>
            <Button type="button" variant="ghost" onClick={addItem}>
              <Plus size={18} className="mr-1" />
              Agregar
            </Button>
          </div>
        </section>

        {/* Actions */}
          <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={saveMutation.isPending}
            onClick={() => void saveMutation.mutateAsync()}
          >
            {saveMutation.isPending
              ? (isEditing ? 'Guardando...' : 'Registrando...')
              : (isEditing ? 'Guardar cambios' : `Registrar ${orderType === 'entrada' ? 'entrada' : 'salida'}`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
