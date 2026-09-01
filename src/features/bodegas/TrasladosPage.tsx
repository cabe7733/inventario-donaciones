import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { fetchWarehouses, transferStock, warehouseStocksBulk } from '../../lib/warehouseOps';
import { fetchProducts, fetchMedications, fetchKits } from '../../lib/db';
import type { Product, Medication, Kit } from '../../lib/db';
import { StockError } from '../../lib/movements';
import { formatNumber } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { AutocompleteOrCreate } from '../../components/ui/AutocompleteOrCreate';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../components/auth/AuthProvider';

type ItemType = 'product' | 'medication' | 'kit';
const ITEMS: { value: ItemType; label: string }[] = [
  { value: 'product', label: 'Productos' },
  { value: 'medication', label: 'Medicamentos' },
  { value: 'kit', label: 'Kits' },
];

interface TransferItem {
  item_type: ItemType;
  item_id: string;
  // ponytail: qty como string para permitir vacío en el input; se parsea al validar.
  qty: string;
}

export function TrasladosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { centerId } = useAuth();

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(true),
  });

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const { data: medications = [] } = useQuery({ queryKey: ['medications'], queryFn: fetchMedications });
  const { data: kits = [] } = useQuery({ queryKey: ['kits'], queryFn: fetchKits });

  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [items, setItems] = useState<TransferItem[]>([{ item_type: 'product', item_id: '', qty: '' }]);
  const [busy, setBusy] = useState(false);
  const [stocks, setStocks] = useState<Map<string, number>>(new Map());

  // Bulk stock per (item_type, item_id) for the selected from-warehouse.
  useEffect(() => {
    if (!fromWarehouse) { setStocks(new Map()); return; }
    let cancelled = false;
    warehouseStocksBulk(fromWarehouse)
      .then((m) => { if (!cancelled) setStocks(m); })
      .catch(() => { if (!cancelled) setStocks(new Map()); });
    return () => { cancelled = true; };
  }, [fromWarehouse]);

  const itemOptions = useMemo(() => {
    const make = <T extends { id: string; name: string }>(rows: T[], type: ItemType) =>
      rows.map((r) => {
        const stock = stocks.get(`${type}:${r.id}`) ?? 0;
        return {
          id: r.id,
          label: r.name,
          sublabel: fromWarehouse
            ? stock > 0
              ? `Stock en bodega: ${formatNumber(stock)}`
              : 'Sin stock en esta bodega'
            : undefined,
        };
      });
    return {
      product: make(products, 'product'),
      medication: make(medications, 'medication'),
      kit: make(kits, 'kit'),
    };
  }, [products, medications, kits, stocks, fromWarehouse]);

  const getItem = (type: ItemType, id: string): Product | Medication | Kit | undefined => {
    const map = { product: products, medication: medications, kit: kits } as Record<string, Array<Product | Medication | Kit>>;
    return map[type]?.find((i: any) => i.id === id);
  };

  const addItem = () => setItems([...items, { item_type: 'product', item_id: '', qty: '' }]);
  const removeItem = (i: number) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof TransferItem, value: any) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    if (field === 'item_type') next[i].item_id = '';
    setItems(next);
  };

  const qtyNum = (it: TransferItem) => Number.parseInt(it.qty, 10) || 0;

  const valid = fromWarehouse && toWarehouse && fromWarehouse !== toWarehouse && items.some((it) => it.item_id && qtyNum(it) > 0);

  const run = async () => {
    if (!valid) return;
    if (!centerId) {
      toast.push({ message: 'No hay centro activo', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      for (const it of items) {
        const qty = qtyNum(it);
        if (!it.item_id || qty <= 0) continue;
        const item = getItem(it.item_type, it.item_id);
        if (!item) continue;
        await transferStock({
          warehouseOriginId: fromWarehouse,
          warehouseDestId: toWarehouse,
          itemType: it.item_type,
          itemId: it.item_id,
          loteId: null,
          qty,
          unitId: (item as any).unit_id,
          fecha: new Date().toISOString(),
          centerId,
          nota: 'Traslado entre bodegas',
        });
      }
      const fromName = warehouses.find((w) => w.id === fromWarehouse)?.name ?? '';
      const toName = warehouses.find((w) => w.id === toWarehouse)?.name ?? '';
      toast.push({ message: `Traslado registrado: ${fromName} → ${toName}`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      // Reset form
      setFromWarehouse('');
      setToWarehouse('');
      setItems([{ item_type: 'product', item_id: '', qty: '' }]);
    } catch (e) {
      if (e instanceof StockError) toast.push({ message: e.message, tone: 'error' });
      else toast.push({ message: 'Error al registrar traslado', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header>
        <h1 className="text-h2">{t('bodegas.traslados.title')}</h1>
      </header>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WarehouseSelect value={fromWarehouse} onChange={setFromWarehouse} required label={t('bodegas.traslados.origen')} />
          <WarehouseSelect value={toWarehouse} onChange={setToWarehouse} required label={t('bodegas.traslados.destino')} />
        </div>

        {fromWarehouse && toWarehouse && fromWarehouse === toWarehouse && (
          <p className="text-caption text-danger-700">La bodega origen y destino no pueden ser la misma.</p>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Items a trasladar</h2>
            <Button type="button" variant="ghost" onClick={addItem}>
              <Plus size={18} className="mr-1" />
              {t('common.add')}
            </Button>
          </div>

          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field id={`t-type-${i}`} label={i === 0 ? 'Tipo' : ''}>
                  <select
                    id={`t-type-${i}`}
                    value={it.item_type}
                    onChange={(e) => updateItem(i, 'item_type', e.target.value)}
                    className={inputWithError(undefined)}
                  >
                    {ITEMS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex-1">
                <AutocompleteOrCreate
                  id={`t-item-${i}`}
                  label={i === 0 ? 'Item' : ''}
                  placeholder="Buscar item..."
                  value={it.item_id || null}
                  onChange={(id) => updateItem(i, 'item_id', id ?? '')}
                  items={itemOptions[it.item_type]}
                />
              </div>
              <div className="w-28">
                <Field id={`t-qty-${i}`} label={i === 0 ? 'Cantidad' : ''}>
                  <input
                    id={`t-qty-${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={it.qty}
                    onChange={(e) => updateItem(i, 'qty', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className={inputWithError(undefined)}
                  />
                </Field>
              </div>
              {it.item_id && fromWarehouse && (() => {
                const stock = stocks.get(`${it.item_type}:${it.item_id}`) ?? 0;
                if (stock <= 0) {
                  return (
                    <p className="text-caption text-danger-700 sm:max-w-[14rem]">
                      Este item no tiene stock en la bodega de origen.
                    </p>
                  );
                }
                return (
                  <p className="text-caption text-muted sm:self-center">
                    Stock disponible: {formatNumber(stock)}
                  </p>
                );
              })()}
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700"
                aria-label="Eliminar item"
              >
                <Trash size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="primary" disabled={!valid || busy} onClick={() => void run()}>
            {busy ? 'Registrando...' : t('bodegas.traslados.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
