import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, X } from '@phosphor-icons/react';
import { createKit, updateKit, clearKitComponents, addKitComponent, type Category, type Kit, type Product, type Unit } from '../../lib/db';
import { addCategory, addUnit } from '../../lib/catalog';
import { newId } from '../../lib/ids';
import { useAuth } from '../../components/auth/AuthProvider';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
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
  categories: Category[];
  units: Unit[];
  products: Product[];
  comps: Array<{ productId: string; qty: number; productName: string }>;
}

export function KitFormModal({ open, onClose, kit, categories, units, products, comps }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [rows, setRows] = useState<CompRow[]>([]);
  const [errors, setErrors] = useState<{ name?: string; unit?: string; comps?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(kit?.name ?? '');
    setCategoryId(kit?.category_id ?? null);
    setUnitId(kit?.unit_id ?? null);
    setRows(comps.map((c) => ({ key: newId(), productId: c.productId, productName: c.productName, qty: c.qty })));
    setErrors({});
  }, [open, kit, comps]);

  const categoryItems = useMemo<AocItem[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories],
  );
  const unitItems = useMemo<AocItem[]>(
    () => units.map((u) => ({ id: u.id, label: u.name, sublabel: u.abbreviation })),
    [units],
  );
  const productItems = useMemo<AocItem[]>(
    () =>
      products
        .filter((p) => p.is_active)
        .map((p) => {
          const used = rows.some((r) => r.productId === p.id);
          return { id: p.id, label: p.name, sublabel: used ? t('kits.form.alreadyAdded') : undefined };
        }),
    [products, rows, t],
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

  const onCreateCategory = async (label: string) => {
    if (!centerId) throw new Error('No hay centro activo');
    return addCategory(label, 'product', 'box', categories.length, 'primary-600', centerId);
  };

  const onCreateUnit = async (label: string) => {
    if (!centerId) throw new Error('No hay centro activo');
    return addUnit(label, 'product', undefined, centerId);
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!unitId) next.unit = t('common.required');
    if (rows.length === 0) next.comps = t('kits.form.needComponent');
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    if (!centerId) {
      toast.push({ message: 'No hay centro activo', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (kit) {
        await updateKit(kit.id, {
          name: name.trim(),
          category_id: categoryId,
          unit_id: unitId!,
        });
        await clearKitComponents(kit.id);
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          await addKitComponent({
            kit_id: kit.id,
            product_id: r.productId,
            qty: r.qty,
            unit_id: unitId!,
            order: i,
          });
        }
        toast.push({ message: t('kits.saved'), tone: 'success' });
      } else {
        const kitId = newId();
        await createKit({
          id: kitId,
          name: name.trim(),
          category_id: categoryId,
          unit_id: unitId!,
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
            unit_id: unitId!,
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

        <AutocompleteOrCreate
          id="k-category"
          label={t('kits.form.category')}
          value={categoryId}
          onChange={setCategoryId}
          items={categoryItems}
          onCreate={onCreateCategory}
        />

        <AutocompleteOrCreate
          id="k-unit"
          label={t('kits.form.unit')}
          required
          value={unitId}
          onChange={setUnitId}
          items={unitItems}
          onCreate={onCreateUnit}
          error={errors.unit}
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
