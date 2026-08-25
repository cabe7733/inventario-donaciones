import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, X } from '@phosphor-icons/react';
import {
  createKit,
  updateKit,
  clearKitComponents,
  addKitComponent,
  type Kit,
  type Product,
  type Unit,
} from '../../lib/db';
import { newId } from '../../lib/ids';
import { buildKit, maxBuildableInWarehouse } from '../../lib/kitOps';
import { warehouseStocksBulk } from '../../lib/warehouseOps';
import { formatNumber } from '../../lib/format';
import { useAuth } from '../../components/auth/AuthProvider';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { useToast } from '../../components/ui/Toast';

interface CompRow {
  key: string;
  productId: string;
  productName: string;
  qty: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  kit: Kit | null;
  units: Unit[];
  products: Product[];
  comps: Array<{ productId: string; qty: number; productName: string }>;
  onBuilt?: () => void;
}

export function KitFormModal({ open, onClose, kit, units, products, comps, onBuilt }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const [name, setName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [rows, setRows] = useState<CompRow[]>([]);
  const [errors, setErrors] = useState<{ name?: string; warehouse?: string; comps?: string }>({});
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [maxBuild, setMaxBuild] = useState(0);
  const [stocks, setStocks] = useState<Map<string, number>>(new Map());

  // ponytail: la UI no muestra categoría ni unidad; para que el resto del flujo
  // (movimientos, reportes) siga funcionando, autogestionamos los valores al guardar.
  const fallbackUnitId = useMemo(() => units[0]?.id ?? '', [units]);

  useEffect(() => {
    if (!open) return;
    setName(kit?.name ?? '');
    setWarehouseId(kit?.warehouse_id ?? '');
    setRows(comps.map((c) => ({ key: newId(), productId: c.productId, productName: c.productName, qty: c.qty })));
    setErrors({});
    setMaxBuild(0);
  }, [open, kit, comps]);

  // Stock por bodega de cada producto, para mostrarlo en el autocompletar (igual que OrderFormPage).
  useEffect(() => {
    if (!warehouseId) { setStocks(new Map()); return; }
    let cancelled = false;
    warehouseStocksBulk(warehouseId)
      .then((m) => { if (!cancelled) setStocks(m); })
      .catch(() => { if (!cancelled) setStocks(new Map()); });
    return () => { cancelled = true; };
  }, [warehouseId]);

  const productItems = useMemo<AocItem[]>(
    () =>
      products
        .filter((p) => p.is_active)
        .map((p) => {
          const used = rows.some((r) => r.productId === p.id);
          const whStock = stocks.get(`product:${p.id}`) ?? 0;
          const stockLabel = warehouseId
            ? whStock > 0
              ? `Stock en bodega: ${formatNumber(whStock)}`
              : 'Sin stock en esta bodega'
            : undefined;
          return {
            id: p.id,
            label: p.name,
            sublabel: used ? t('kits.form.alreadyAdded') : stockLabel,
          };
        }),
    [products, rows, stocks, warehouseId, t],
  );

  const addProduct = (productId: string | null) => {
    if (!productId || rows.some((r) => r.productId === productId)) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setRows((prev) => [...prev, { key: newId(), productId, productName: p.name, qty: 1 }]);
  };

  const setQty = (key: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, qty: Math.max(1, qty) } : r)),
    );
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  // Simulador: cuántos kits se pueden armar con la bodega seleccionada
  useEffect(() => {
    if (!warehouseId || rows.length === 0) { setMaxBuild(0); return; }
    let cancelled = false;
    (async () => {
      const compsForSim = rows.map((r) => ({ product_id: r.productId, qty: r.qty }));
      const n = await maxBuildableInWarehouse(warehouseId, compsForSim);
      if (!cancelled) setMaxBuild(n);
    })();
    return () => { cancelled = true; };
  }, [warehouseId, rows]);

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!warehouseId) next.warehouse = t('kits.form.warehouseRequired');
    if (rows.length === 0) next.comps = t('kits.form.needComponent');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    if (!centerId) {
      toast.push({ message: 'No hay centro activo', tone: 'error' });
      return;
    }
    const unitId = kit?.unit_id ?? fallbackUnitId;
    if (!unitId) {
      toast.push({ message: 'No hay unidades configuradas', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (kit) {
        await updateKit(kit.id, {
          name: name.trim(),
          category_id: null,
          unit_id: unitId,
          warehouse_id: warehouseId,
        });
        await clearKitComponents(kit.id);
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          await addKitComponent({
            kit_id: kit.id,
            product_id: r.productId,
            qty: r.qty,
            unit_id: unitId,
            order: i,
          });
        }
        toast.push({ message: t('kits.saved'), tone: 'success' });
      } else {
        const kitId = newId();
        await createKit({
          id: kitId,
          name: name.trim(),
          category_id: null,
          unit_id: unitId,
          warehouse_id: warehouseId,
          total_stock: 0,
          is_active: true,
          center_id: centerId,
        });
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          await addKitComponent({
            kit_id: kitId,
            product_id: r.productId,
            qty: r.qty,
            unit_id: unitId,
            order: i,
          });
        }
        toast.push({ message: t('kits.created'), tone: 'success' });
      }
      onClose();
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al guardar',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Construye `qty` kits con la bodega seleccionada (decrementa stock de componentes)
  const generateAll = async () => {
    if (!kit || rows.length === 0 || !warehouseId || maxBuild < 1) {
      toast.push({ message: 'Guardá el kit antes de generar ensambles', tone: 'error' });
      return;
    }
    if (!centerId) return;
    setBuilding(true);
    try {
      await buildKit(kit.id, maxBuild, centerId, warehouseId);
      toast.push({
        message: t('kits.built', { qty: String(maxBuild), name: kit.name }),
        tone: 'success',
      });
      setMaxBuild(0);
      onBuilt?.();
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al ensamblar',
        tone: 'error',
      });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kit ? t('kits.form.editTitle') : t('kits.form.title')}
    >
      <div className="flex flex-col gap-4">
        <Field id="k-name" label={t('kits.form.name')} required error={errors.name}>
          <input
            id="k-name"
            className={inputWithError(errors.name)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('kits.form.name.placeholder')}
            autoFocus
          />
        </Field>

        <WarehouseSelect
          value={warehouseId}
          onChange={setWarehouseId}
          required
          label={t('kits.form.warehouse')}
          error={errors.warehouse}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-label text-fg">
            {t('kits.form.components')} <span className="text-danger-500"> *</span>
          </span>

          <AutocompleteOrCreate
            id="k-add-product"
            label={t('kits.form.addComponent')}
            placeholder={t('kits.form.addComponent.placeholder')}
            value={null}
            onChange={addProduct}
            items={productItems}
          />

          {rows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                >
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium">
                    {r.productName}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('a11y.decrement')}
                      onClick={() => setQty(r.key, r.qty - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center text-numeric">{r.qty}</span>
                    <button
                      type="button"
                      aria-label={t('a11y.increment')}
                      onClick={() => setQty(r.key, r.qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    onClick={() => removeRow(r.key)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-danger-700"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {errors.comps && (
            <p className="text-caption text-danger-700" role="alert">
              {errors.comps}
            </p>
          )}
        </div>

        {/* Simulador + Generar todos */}
        {rows.length > 0 && warehouseId && (
          <div
            role="alert"
            className={`flex flex-col gap-2 rounded-lg p-3 ${
              maxBuild > 0 ? 'bg-success-500/10' : 'bg-warning-500/10'
            }`}
          >
            <p
              className={`text-caption font-semibold ${
                maxBuild > 0 ? 'text-success-700' : 'text-warning-700'
              }`}
            >
              {maxBuild > 0
                ? t('kits.simulator.canBuild', { count: maxBuild })
                : t('kits.simulator.cannotBuild')}
            </p>
            {kit && maxBuild > 0 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={building}
                onClick={() => void generateAll()}
              >
                {t('kits.simulator.generateAll', { count: maxBuild })}
              </Button>
            )}
            {!kit && maxBuild > 0 && (
              <p className="text-caption text-muted">
                {t('kits.simulator.saveFirst')}
              </p>
            )}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
