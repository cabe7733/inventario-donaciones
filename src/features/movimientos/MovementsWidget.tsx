import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, Package, Pill, Cube } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { fetchMovements, fetchProducts, fetchMedications, fetchKits, type Movement, type ItemType } from '../../lib/db';
import { formatNumber, formatTime } from '../../lib/format';
import { SkeletonCard } from '../../components/ui/Skeleton';

const ICON: Record<ItemType, typeof Package> = {
  product: Package,
  medication: Pill,
  kit: Cube,
};

export function MovementsWidget() {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<Movement[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [movs, prods, meds, kits] = await Promise.all([fetchMovements({ limit: 5 }), fetchProducts(), fetchMedications(), fetchKits()]);
      setRecent(movs);
      const m = new Map<string, string>();
      for (const p of prods) m.set(p.id, p.name);
      for (const x of meds) m.set(x.id, x.name);
      for (const x of kits) m.set(x.id, x.name);
      setNames(m);
      setLoading(false);
    })();
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-h3">{t('dashboard.recent')}</h2>
        <Link to="/mas/movimientos" className="text-caption font-semibold text-primary-700">{t('dashboard.verTodo')}</Link>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-body text-muted">{t('dashboard.recent.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((m) => {
            const Icon = ICON[m.item_type];
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.kind === 'entrada' ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'}`}>
                  {m.kind === 'entrada' ? <ArrowDownRight size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
                </span>
                <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{names.get(m.item_id) ?? '?'}</span>
                <span className={`text-numeric ${m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'}`}>
                  {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}
                </span>
                <span className="text-caption text-muted">{formatTime(m.fecha)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
