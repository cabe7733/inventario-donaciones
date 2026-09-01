import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DotsThree, FileArrowDown, PencilSimple, Plus, Package, Trash, UploadSimple, Warning } from '@phosphor-icons/react';
import { fetchProducts, fetchCategories, fetchUnits, deleteProduct, restoreProduct, importProductsFromRows, type Product, type Category, type Unit } from '../../lib/db';
import { searchWith } from '../../lib/search';
import { categoriasFor, unitsFor } from '../../lib/catalog';
import { parseProductFile } from '../../lib/parseCsv';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImportDialog, type ImportDialogConfig, type ParsedImportRow } from '../../components/ui/ImportDialog';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { SkeletonList } from '../../components/ui/Skeleton';
import { SearchInput } from '../../components/ui/SearchInput';
import { PageContainer } from '../../components/layout/PageContainer';
import { ProductFormModal } from './ProductFormModal';

const PRODUCTS_TEMPLATE = '# bodega = código de la bodega (BOD-01, BOD-02, PRINCIPAL). Si está vacío, usa PRINCIPAL.\nproducto;categoria;cantidad;unidad;bodega;cedula\nArroz 1 kg;Alimentos;25;bolsa;PRINCIPAL;1234567890\nLeche entera;Lácteos;40;caja;PRINCIPAL;0987654321\n';

export function ProductosListPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, centerId } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

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
    const item = deleting;
    await deleteProduct(item.id);
    toast.push({
      message: t('productos.deleted'),
      tone: 'success',
      action: {
        label: t('common.undo'),
        onClick: async () => {
          await restoreProduct(item.id);
          void reload();
        },
      },
    });
    setDeleting(null);
    void reload();
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  const downloadProductsTemplate = () => {
    const blob = new Blob([PRODUCTS_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig: ImportDialogConfig = {
    scope: 'products',
    onImport: async (rows) => {
      const data = (rows as any[]).map((r) => ({
        product: String(r.product ?? ''),
        category: String(r.category ?? ''),
        qty: Number(r.qty ?? 0),
        unit: r.unit ? String(r.unit) : undefined,
        warehouse: r.warehouse ? String(r.warehouse) : undefined,
        donor_id_number: r.donor_id_number ? String(r.donor_id_number) : undefined,
      }));
      const stats = await importProductsFromRows(data, user?.id, centerId ?? undefined);
      const s = stats as Record<string, number>;
      const ok = s.ok ?? 0;
      const donorMissing = s.donorMissing ?? 0;
      const warehouseMissing = s.warehouseMissing ?? 0;
      const parts: string[] = [`${ok} OK`];
      if (donorMissing) parts.push(`${donorMissing} sin donante`);
      if (warehouseMissing) parts.push(`${warehouseMissing} sin bodega`);
      const summary = parts.join(', ');
      toast.push({
        message: ok === 0 ? `Importación falló: ${summary}` : `Importación: ${summary}`,
        tone: ok === 0 || donorMissing || warehouseMissing ? 'error' : 'success',
      });
      void reload();
      return stats as { ok: number; [k: string]: unknown };
    },
    templateFilename: 'plantilla-productos.csv',
    templateContent: PRODUCTS_TEMPLATE,
    parseFile: (text) => parseProductFile(text) as unknown as ParsedImportRow[],
    validateRow: (r) => {
      if (!r.product) return { ok: false, reason: 'Falta nombre del producto' };
      if (!r.category) return { ok: false, reason: 'Falta categoría' };
      if (typeof r.qty !== 'number' || !Number.isFinite(r.qty) || r.qty < 0) {
        return { ok: false, reason: 'Cantidad inválida' };
      }
      if (!('donor_id_number' in r) || !r.donor_id_number) {
        return { ok: false, reason: 'Falta cédula del donante' };
      }
      return { ok: true };
    },
  };

  return (
    <PageContainer className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('productos.list.title')}</h1>
        <div className="flex items-center gap-2">
          <Dropdown
            ariaLabel="Más acciones"
            align="right"
            trigger={
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
                <DotsThree size={20} weight="bold" aria-hidden="true" />
              </span>
            }
            items={[
              {
                key: 'import',
                label: 'Importar archivo',
                icon: <UploadSimple size={16} aria-hidden="true" />,
                onClick: () => setImportOpen(true),
              },
              {
                key: 'template',
                label: 'Descargar plantilla',
                icon: <FileArrowDown size={16} aria-hidden="true" />,
                onClick: () => downloadProductsTemplate(),
              },
            ]}
          />
          <Button onClick={openNew}>
            <Plus size={18} aria-hidden="true" />
            {t('productos.new')}
          </Button>
        </div>
      </header>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('common.search')}
        aria-label={t('common.search')}
      />

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent_0,black_12px,black_calc(100%-12px),transparent_100%)]"
        role="tablist"
        aria-label={t('productos.list.cats')}
      >
        <button
          role="tab"
          aria-selected={catFilter === null}
          onClick={() => setCatFilter(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors ${
            catFilter === null ? 'bg-primary-600 text-inverse' : 'bg-card text-muted border border-border hover:border-primary-300'
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
            className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors ${
              catFilter === c.id ? 'bg-primary-600 text-inverse' : 'bg-card text-muted border border-border hover:border-primary-300'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList />
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
        <ul className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                  <div className="flex items-center gap-1">
                    <span className="text-numeric-lg text-primary-700">
                      {p.total_stock}
                      <span className="ml-1 text-caption text-muted">{unit?.abbreviation ?? ''}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('common.edit')} ${p.name}`}
                      onClick={() => openEdit(p)}
                      className="h-11 w-11 px-0"
                    >
                      <PencilSimple size={18} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('common.delete')} ${p.name}`}
                      onClick={() => setDeleting(p)}
                      className="h-11 w-11 px-0 hover:bg-danger-500/10 hover:text-danger-700"
                    >
                      <Trash size={18} aria-hidden="true" />
                    </Button>
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

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        config={importConfig}
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
    </PageContainer>
  );
}
