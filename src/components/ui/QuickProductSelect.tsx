import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '@phosphor-icons/react';
import { fetchCategories, fetchProduct, fetchUnits, type Product } from '../../lib/db';
import { categoriasFor, unitsFor } from '../../lib/catalog';
import { AutocompleteOrCreate, type AocItem } from './AutocompleteOrCreate';
import { ProductFormModal } from '../../features/productos/ProductFormModal';

interface Props {
  items: AocItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreated?: (newProduct: Product) => void;
  label?: string;
}

export function QuickProductSelect({ items, value, onChange, onCreated, label }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof fetchCategories>>>([]);
  const [units, setUnits] = useState<Awaited<ReturnType<typeof fetchUnits>>>([]);
  const [optimistic, setOptimistic] = useState<AocItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void Promise.all([fetchCategories(), fetchUnits()]).then(([c, u]) => {
      setCategories(c);
      setUnits(u);
    });
  }, []);

  const cats = useMemo(() => categoriasFor(categories, 'product'), [categories]);
  const unis = useMemo(() => unitsFor(units, 'product'), [units]);

  const mergedItems = useMemo(
    // ponytail: prepend the just-created product so the input shows its name
    // immediately, without waiting for the parent's query refetch.
    () => (optimistic ? [optimistic, ...items.filter((i) => i.id !== optimistic.id)] : items),
    [items, optimistic],
  );

  const onFormClose = async (createdId?: string) => {
    setShowForm(false);
    if (!onCreated || !createdId) return;
    const created = await fetchProduct(createdId);
    if (created) {
      setOptimistic({ id: created.id, label: created.name });
      onCreated(created);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <AutocompleteOrCreate
        label={label ?? t('ordenes.producto')}
        placeholder={t('ordenes.searchOrCreateProduct')}
        value={value}
        onChange={(id) => {
          onChange(id);
          if (id !== optimistic?.id) setOptimistic(null);
        }}
        items={mergedItems}
        onCreate={() => {
          setShowForm(true);
          return Promise.resolve('');
        }}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-medium text-accent-600 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
        >
          <Plus size={14} aria-hidden="true" />
          {t('productos.quickNew')}
        </button>
      </div>
      {showForm && (
        <ProductFormModal
          open={showForm}
          onClose={onFormClose}
          product={null}
          categories={cats}
          units={unis}
        />
      )}
    </div>
  );
}
