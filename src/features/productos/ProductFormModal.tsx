import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { db } from '../../db';
import { deviceId, newId, nowISO } from '../../lib/ids';
import { addCategory, addUnit } from '../../lib/catalog';
import type { Category, Product, Unit } from '../../db/types';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  units: Unit[];
}

const schema = z.object({
  name: z.string().trim().min(1),
  aliases: z.string(),
  categoryId: z.string().nullable(),
  unitId: z.string().min(1),
  minStock: z.preprocess((v) => {
    const s = String(v).trim();
    if (s === '') return null;
    return Number(s);
  }, z.number().min(0).nullable()),
});

export function ProductFormModal({ open, onClose, product, categories, units }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [minStock, setMinStock] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof z.infer<typeof schema>, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setAliases(product?.aliases.join(', ') ?? '');
    setCategoryId(product?.categoryId ?? null);
    setUnitId(product?.unitId ?? null);
    setMinStock(product?.minStock != null ? String(product.minStock) : '');
    setErrors({});
  }, [open, product]);

  const categoryItems = useMemo<AocItem[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories],
  );
  const unitItems = useMemo<AocItem[]>(
    () => units.map((u) => ({ id: u.id, label: u.name, sublabel: u.abbreviation })),
    [units],
  );

  const createCategory = (label: string) => addCategory(label, 'product', 'box', categories.length);

  const createUnit = (label: string) => addUnit(label, 'product');

  const save = async () => {
    const parsed = schema.safeParse({ name, aliases, categoryId, unitId, minStock });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof typeof errors] = t('common.required');
      }
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: parsed.data.name,
        aliases: parsed.data.aliases.split(',').map((a) => a.trim()).filter(Boolean),
        categoryId: parsed.data.categoryId,
        unitId: parsed.data.unitId,
        minStock: parsed.data.minStock,
      };
      if (product) {
        await db.products.update(product.id, {
          ...data,
          _version: product._version + 1,
          _syncedAt: null,
          updatedAt: nowISO(),
        });
        toast.push({ message: t('productos.form.saved'), tone: 'success' });
      } else {
        await db.products.add({
          id: newId(),
          ...data,
          totalStock: 0,
          isActive: 1,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          _version: 1,
          _deleted: 0,
          _syncedAt: null,
          _deviceId: deviceId(),
          _clientUuid: newId(),
        });
        toast.push({ message: t('productos.form.created'), tone: 'success' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? t('productos.form.editTitle') : t('productos.form.title')}
    >
      <div className="flex flex-col gap-4">
        <Field id="p-name" label={t('productos.form.name')} required error={errors.name}>
          <input
            id="p-name"
            className={inputWithError(errors.name)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('productos.form.name.placeholder')}
            autoFocus
          />
        </Field>

        <Field id="p-aliases" label={t('productos.form.aliases')} hint={t('productos.form.aliases.hint')}>
          <input
            id="p-aliases"
            className={inputWithError(errors.aliases)}
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
          />
        </Field>

        <AutocompleteOrCreate
          id="p-category"
          label={t('productos.form.category')}
          value={categoryId}
          onChange={setCategoryId}
          items={categoryItems}
          onCreate={createCategory}
          error={errors.categoryId}
        />

        <AutocompleteOrCreate
          id="p-unit"
          label={t('productos.form.unit')}
          required
          value={unitId}
          onChange={setUnitId}
          items={unitItems}
          onCreate={createUnit}
          error={errors.unitId}
        />

        <Field id="p-minstock" label={t('productos.form.minStock')} hint={t('productos.form.minStock.hint')} error={errors.minStock}>
          <input
            id="p-minstock"
            className={inputWithError(errors.minStock)}
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            inputMode="decimal"
          />
        </Field>

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