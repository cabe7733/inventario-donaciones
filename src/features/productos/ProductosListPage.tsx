import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilSimple, Plus, Package, Trash, Warning } from '@phosphor-icons/react';
import { fetchProducts, fetchCategories, fetchUnits, deleteProduct, type Product, type Category, type Unit } from '../../lib/db';
import { searchWith } from '../../lib/search';
import { categoriasFor, unitsFor } from '../../lib/catalog';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ProductFormModal } from './ProductFormModal';

export function ProductosListPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [p, c, u] = await Promise.all([fetchProducts(), fetchCategories(), fetchUnits()]);
    setProducts(p);
    setCategories(c);
    setUnits(u);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const cats = useMemo(() => categoriasFor(categories, 'product'), [categories]);
  const unis = useMemo(() => unitsFor(units, 'product'), [units]);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const unitBy = useMemo(() => new Map(unis.map((u) => [u.id, u])), [unis]);
  const catBy = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const visible = useMemo(() => {
    let list = products.filter((p) => p.is_active);
    if (catFilter) list = list.filter((p) => p.category_id === catFilter);
    list = searchWith(list, ['name', 'aliases'], query);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products, catFilter, query]);

  const remove = async () => {
    if (!deleting) return;
    await deleteProduct(deleting.id, deleting.version);
    toast.push({ message: t('productos.deleted'), tone: 'success' });
    setDeleting(null);
    void reload();
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('productos.list.title')}</h1>
        <Button onClick={openNew}>
          <Plus size={18} aria-hidden="true" />
          {t('productos.new')}
        </Button>
      </header>

      <div className="relative">
        <input
          aria-label={t('common.search')}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg placeholder:text-muted focus:border-primary-500 focus:outline-none"
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('productos.list.cats')}>
        <button
          role="tab"
          aria-selected={catFilter === null}
          onClick={() => setCatFilter(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold ${
            catFilter === null ? 'bg-primary-600 text-inverse' : 'bg-card text-muted border border-border'
          }`}
        >
          {t('productos.list.all')}
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={catFilter === c.id}
            onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold ${
              catFilter === c.id ? 'bg-primary-600 text-inverse' : 'bg-card text-muted border border-border'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted">{t('common.loading')}</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('productos.list.empty')}
          description={t('productos.list.emptyHint')}
          action={
            <Button onClick={openNew}>
              <Plus size={18} aria-hidden="true" />
              {t('productos.new')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => {
            const unit = unitBy.get(p.unit_id);
            const low = p.min_stock != null && p.total_stock <= p.min_stock;
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold">{p.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {catBy.get(p.category_id ?? '') && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-700">
                          {catBy.get(p.category_id!)!.name}
                        </span>
                      )}
                      {low && (
                        <span className="flex items-center gap-1 rounded-full bg-warning-500/15 px-2 py-0.5 text-caption font-semibold text-warning-700">
                          <Warning size={12} aria-hidden="true" />
                          {t('productos.stock.low')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-numeric-lg text-primary-700">
                      {p.total_stock}
                      <span className="ml-1 text-caption text-muted">{unit?.abbreviation ?? ''}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`${t('common.edit')} ${p.name}`}
                      onClick={() => openEdit(p)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
                    >
                      <PencilSimple size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('common.delete')} ${p.name}`}
                      onClick={() => setDeleting(p)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
                    >
                      <Trash size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); void reload(); }}
        product={editing}
        categories={cats}
        units={unis}
      />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('productos.delete.title')}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('productos.delete.body', { name: deleting?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void remove()}>{t('common.delete')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
