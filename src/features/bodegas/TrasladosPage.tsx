import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWarehouses, transferStock, warehouseStock } from '../../lib/warehouseOps';
import { fetchProducts, fetchMedications, fetchKits } from '../../lib/db';
import type { Product, Medication, Kit } from '../../lib/db';
import { StockError } from '../../lib/movements';
import { formatNumber } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { useToast } from '../../components/ui/Toast';

type ItemType = 'product' | 'medication' | 'kit';
const ITEMS: { value: ItemType; label: string }[] = [
  { value: 'product', label: 'Productos' },
  { value: 'medication', label: 'Medicamentos' },
  { value: 'kit', label: 'Kits' },
];

interface TransferItem {
  item_type: ItemType;
  item_id: string;
  qty: number;
}

export function TrasladosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(true),
  });

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const { data: medications = [] } = useQuery({ queryKey: ['medications'], queryFn: fetchMedications });
  const { data: kits = [] } = useQuery({ queryKey: ['kits'], queryFn: fetchKits });

  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [items, setItems] = useState<TransferItem[]>([{ item_type: 'product', item_id: '', qty: 1 }]);
  const [busy, setBusy] = useState(false);
  const [itemStocks, setItemStocks] = useState<Map<string, number>>(new Map());

  // Load stocks for fromWarehouse
  useEffect(() => {
    if (!fromWarehouse) { setItemStocks(new Map()); return; }
    let cancelled = false;
    (async () => {
      const entries: [string, number][] = [];
      for (const it of items) {
        if (!it.item_id) continue;
        const stock = await warehouseStock(fromWarehouse, it.item_type, it.item_id);
        entries.push([it.item_id, stock]);
      }
      if (!cancelled) setItemStocks(new Map(entries));
    })();
    return () => { cancelled = true; };
  }, [fromWarehouse, items]);

  const getItem = (type: ItemType, id: string): Product | Medication | Kit | undefined => {
    const map = { product: products, medication: medications, kit: kits } as Record<string, Array<Product | Medication | Kit>>;
    return map[type]?.find((i: any) => i.id === id);
  };

  const addItem = () => setItems([...items, { item_type: 'product', item_id: '', qty: 1 }]);
  const removeItem = (i: number) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof TransferItem, value: any) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    if (field === 'item_type') next[i].item_id = '';
    setItems(next);
  };

  const valid = fromWarehouse && toWarehouse && fromWarehouse !== toWarehouse && items.some((it) => it.item_id && it.qty > 0);

  const run = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      for (const it of items) {
        if (!it.item_id || it.qty <= 0) continue;
        const item = getItem(it.item_type, it.item_id);
        if (!item) continue;
        await transferStock({
          warehouseOriginId: fromWarehouse,
          warehouseDestId: toWarehouse,
          itemType: it.item_type,
          itemId: it.item_id,
          loteId: null,
          qty: it.qty,
          unitId: (item as any).unit_id,
          fecha: new Date().toISOString(),
          centerId: '',
          nota: 'Traslado entre bodegas',
        });
      }
      const fromName = warehouses.find((w) => w.id === fromWarehouse)?.name ?? '';
      const toName = warehouses.find((w) => w.id === toWarehouse)?.name ?? '';
      toast.push({ message: `Traslado registrado: ${fromName} → ${toName}`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      // Reset form
      setFromWarehouse('');
      setToWarehouse('');
      setItems([{ item_type: 'product', item_id: '', qty: 1 }]);
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
                <Field id={`t-item-${i}`} label={i === 0 ? 'Item' : ''} error={!it.item_id && items.length > 1 ? undefined : undefined}>
                  <select
                    id={`t-item-${i}`}
                    value={it.item_id}
                    onChange={(e) => updateItem(i, 'item_id', e.target.value)}
                    className={inputWithError(undefined)}
                  >
                    <option value="">Seleccionar...</option>
                    {it.item_type === 'product' && products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {it.item_type === 'medication' && medications.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                    {it.item_type === 'kit' && kits.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="w-28">
                <Field id={`t-qty-${i}`} label={i === 0 ? 'Cantidad' : ''}>
                  <input
                    id={`t-qty-${i}`}
                    type="number"
                    min="1"
                    value={it.qty}
                    onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value, 10) || 1)}
                    className={inputWithError(undefined)}
                  />
                </Field>
              </div>
              {it.item_id && fromWarehouse && (
                <div className="text-caption text-muted">
                  Stock: {formatNumber(itemStocks.get(it.item_id) ?? 0)}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700"
                aria-label="Eliminar item"
              >
                ×
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
