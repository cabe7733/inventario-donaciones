import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CaretRight, Cube, PencilSimple, Plus, Package, HandHeart } from '@phosphor-icons/react';
import { db } from '../../db';
import { formatNumber } from '../../lib/format';
import type { Kit } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { KitFormModal } from './KitFormModal';
import { KitActionModal } from './KitActionModal';

export function KitsListPage() {
  const { t } = useTranslation();

  const kits = useLiveQuery(() => db.kits.where('_deleted').equals(0).toArray(), []);
  const categories = useLiveQuery(() => db.categories.where('_deleted').equals(0).toArray(), []);
  const units = useLiveQuery(() => db.units.where('_deleted').equals(0).toArray(), []);
  const products = useLiveQuery(() => db.products.where('_deleted').equals(0).toArray(), []);
  const kitComps = useLiveQuery(() => db.kitComponents.toArray(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Kit | null>(null);
  const [action, setAction] = useState<{ mode: 'build' | 'deliver'; kit: Kit } | null>(null);

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p.name])), [products]);
  const compsByKit = useMemo(() => {
    const m = new Map<string, Array<{ productId: string; qty: number; productName: string }>>();
    for (const c of kitComps ?? []) {
      const list = m.get(c.kitId) ?? [];
      list.push({ productId: c.productId, qty: c.qty, productName: productMap.get(c.productId) ?? '?' });
      m.set(c.kitId, list);
    }
    return m;
  }, [kitComps, productMap]);

  const catBy = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);
  const unitBy = useMemo(() => new Map((units ?? []).map((u) => [u.id, u.abbreviation])), [units]);
  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('kits.list.title')}</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          {t('kits.new')}
        </Button>
      </header>

      {!kits || kits.length === 0 ? (
        <EmptyState
          icon={Cube}
          title={t('kits.list.empty')}
          description={t('kits.list.emptyHint')}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} aria-hidden="true" />
              {t('kits.new')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...kits]
            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
            .map((k) => {
              const comps = compsByKit.get(k.id) ?? [];
              return (
                <li key={k.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/kits/${k.id}`} className="flex items-center gap-1 truncate">
                        <span className="truncate text-body font-semibold hover:text-primary-700">
                          {k.name}
                        </span>
                        <CaretRight size={14} className="shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {k.categoryId && catBy.get(k.categoryId) && (
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-700">
                            {catBy.get(k.categoryId!)}
                          </span>
                        )}
                        <span className="text-caption text-muted">
                          {t('kits.nComps', { count: comps.length })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-numeric-lg text-primary-700">
                        {formatNumber(k.totalStock)}
                        <span className="ml-1 text-caption text-muted">{unitBy.get(k.unitId) ?? ''}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`${t('common.edit')} ${k.name}`}
                        onClick={() => {
                          setEditing(k);
                          setFormOpen(true);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
                      >
                        <PencilSimple size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setAction({ mode: 'build', kit: k })}>
                      <Package size={16} aria-hidden="true" />
                      {t('kits.ensamblar')}
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => setAction({ mode: 'deliver', kit: k })}>
                      <HandHeart size={16} aria-hidden="true" />
                      {t('kits.entregar')}
                    </Button>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <KitFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        kit={editing}
        categories={categories ?? []}
        units={units ?? []}
        products={products ?? []}
        comps={editing ? compsByKit.get(editing.id) ?? [] : []}
      />

      <KitActionModal
        mode={action?.mode ?? 'build'}
        kit={action?.kit ?? null}
        open={action !== null}
        onClose={() => setAction(null)}
        components={action ? compsByKit.get(action.kit.id) ?? [] : []}
        productMap={productById}
      />
    </div>
  );
}