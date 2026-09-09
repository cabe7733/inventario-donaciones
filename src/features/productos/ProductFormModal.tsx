import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { newId } from '../../lib/ids';
import { addCategory, addUnit } from '../../lib/catalog';
import { createProduct, updateProduct, type Category, type Product, type Unit } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface Props {
  open: boolean;
  onClose: (createdId?: string) => void;
  product: Product | null;
  categories: Category[];
  units: Unit[];
}

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  aliases: z.string(),
  category_id: z.string().nullable(),
  unit_id: z.string().min(1, 'La unidad es obligatoria'),
  min_stock: z.string(),
});

type FormData = z.infer<typeof schema>;

function parseMinStock(v: string): number | null {
  const s = v.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ProductFormModal({ open, onClose, product, categories, units }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      aliases: '',
      category_id: null,
      unit_id: '',
      min_stock: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: product?.name ?? '',
      aliases: product?.aliases?.join(', ') ?? '',
      category_id: product?.category_id ?? null,
      unit_id: product?.unit_id ?? '',
      min_stock: product?.min_stock != null ? String(product.min_stock) : '',
    });
  }, [open, product, reset]);

  const categoryItems = useMemo<AocItem[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories],
  );
  const unitItems = useMemo<AocItem[]>(
    () => units.map((u) => ({ id: u.id, label: u.name, sublabel: u.abbreviation })),
    [units],
  );

  const createCategory = async (label: string) => {
    if (!centerId) throw new Error('No hay centro activo');
    return addCategory(label, 'product', 'box', categories.length, 'primary-600', centerId);
  };
  const createUnit = async (label: string) => {
    if (!centerId) throw new Error('No hay centro activo');
    return addUnit(label, 'product', undefined, centerId);
  };

  const onSubmit = async (data: FormData) => {
    if (!centerId) {
      toast.push({ message: 'No hay centro activo', tone: 'error' });
      return;
    }
    try {
      const aliasList = data.aliases.split(',').map((a) => a.trim()).filter(Boolean);
      const minStock = parseMinStock(data.min_stock);
      if (product) {
        await updateProduct(product.id, {
          name: data.name,
          aliases: aliasList,
          category_id: data.category_id,
          unit_id: data.unit_id,
          min_stock: minStock,
        });
        toast.push({ message: t('productos.saved'), tone: 'success' });
      } else {
        const id = newId();
        await createProduct({
          id,
          name: data.name,
          aliases: aliasList,
          category_id: data.category_id,
          unit_id: data.unit_id,
          min_stock: minStock,
          total_stock: 0,
          is_active: true,
          center_id: centerId,
        });
        toast.push({ message: t('productos.created'), tone: 'success' });
        onClose(id);
        return;
      }
      onClose();
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al guardar',
        tone: 'error',
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? t('productos.form.editTitle') : t('productos.form.title')}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="p-name" label={t('productos.form.name')} required error={errors.name?.message}>
          <input id="p-name" className={inputWithError(errors.name?.message)} {...register('name')} placeholder={t('productos.form.name.placeholder')} autoFocus />
        </Field>
        <Field id="p-aliases" label={t('productos.form.aliases')} hint={t('productos.form.aliases.hint')}>
          <input id="p-aliases" className={inputWithError(errors.aliases?.message)} {...register('aliases')} />
        </Field>
        <AutocompleteOrCreate id="p-category" label={t('productos.form.category')} value={watch('category_id')} onChange={(v) => setValue('category_id', v)} items={categoryItems} onCreate={createCategory} error={errors.category_id?.message} />
        <AutocompleteOrCreate id="p-unit" label={t('productos.form.unit')} required value={watch('unit_id')} onChange={(v) => setValue('unit_id', v ?? '')} items={unitItems} onCreate={createUnit} error={errors.unit_id?.message} />
        <Field id="p-minstock" label={t('productos.form.minStock')} hint={t('productos.form.minStock.hint')} error={errors.min_stock?.message}>
          <input id="p-minstock" className={inputWithError(errors.min_stock?.message)} {...register('min_stock')} inputMode="decimal" />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onClose()}>{t('common.cancel')}</Button>
          <Button type="submit" loading={isSubmitting}>{isSubmitting ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
