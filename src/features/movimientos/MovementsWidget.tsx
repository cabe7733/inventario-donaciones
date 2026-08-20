import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, Package, Pill, Cube } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { formatNumber, formatTime } from '../../lib/format';
import type { ItemType, Movement } from '../../db/types';

const ICON: Record<ItemType, typeof Package> = {
  product: Package,
  medication: Pill,
  kit: Cube,
};

export function MovementsWidget() {
  const { t } = useTranslation();
  const recent = useLiveQuery(() => db.movements.orderBy('fecha').reverse().limit(5).toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const medications = useLiveQuery(() => db.medications.toArray(), []);
  const kits = useLiveQuery(() => db.kits.toArray(), []);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products ?? []) m.set(p.id, p.name);
    for (const x of medications ?? []) m.set(x.id, x.name);
    for (const x of kits ?? []) m.set(x.id, x.name);
    return m;
  }, [products, medications, kits]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-h3">{t('dashboard.recent')}</h2>
        <Link to="/mas/movimientos" className="text-caption font-semibold text-primary-700">
          {t('dashboard.verTodo')}
        </Link>
      </div>
      {!recent || recent.length === 0 ? (
        <p className="text-body text-muted">{t('dashboard.recent.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((m: Movement) => {
            const Icon = ICON[m.itemType];
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    m.kind === 'entrada'
                      ? 'bg-success-500/15 text-success-700'
                      : 'bg-secondary-500/15 text-secondary-700'
                  }`}
                >
                  {m.kind === 'entrada' ? (
                    <ArrowDownRight size={18} aria-hidden="true" />
                  ) : (
                    <ArrowUpRight size={18} aria-hidden="true" />
                  )}
                </span>
                <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium">
                  {names.get(m.itemId) ?? '?'}
                </span>
                <span
                  className={`text-numeric ${m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'}`}
                >
                  {m.kind === 'entrada' ? '+' : '−'}
                  {formatNumber(m.qty)}
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