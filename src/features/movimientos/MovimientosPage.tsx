import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react';
import { db } from '../../db';
import { formatNumber, formatTime, formatDateShort, toLocalDateKey, todayKey } from '../../lib/format';
import type { ItemType, Movement } from '../../db/types';
import { Segmented } from '../../components/ui/Segmented';

const ITEM_NAV_KEY: Record<ItemType, string> = {
  product: 'nav.productos',
  medication: 'nav.medicamentos',
  kit: 'nav.kits',
};

function itemName(kind: ItemType, id: string, maps: { [k in ItemType]: Map<string, string> }): string {
  return maps[kind].get(id) ?? '?';
}

export function MovimientosPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const scope = params.get('scope') ?? 'all';

  const movements = useLiveQuery(
    () => db.movements.orderBy('fecha').reverse().limit(200).toArray(),
    [],
  );

  const products = useLiveQuery(
    () => db.products.where('_deleted').equals(0).toArray(),
    [],
  );
  const medications = useLiveQuery(
    () => db.medications.where('_deleted').equals(0).toArray(),
    [],
  );
  const kits = useLiveQuery(() => db.kits.where('_deleted').equals(0).toArray(), []);
  const units = useLiveQuery(() => db.units.toArray(), []);

  const maps = useMemo(
    () => ({
      product: new Map((products ?? []).map((p) => [p.id, p.name])),
      medication: new Map((medications ?? []).map((m) => [m.id, m.name])),
      kit: new Map((kits ?? []).map((k) => [k.id, k.name])),
    }),
    [products, medications, kits],
  );
  const unitBy = useMemo(() => new Map((units ?? []).map((u) => [u.id, u.abbreviation])), [units]);

  const scoped = useMemo(() => {
    if (!movements) return undefined;
    if (scope === 'product') return movements.filter((m) => m.itemType !== 'medication');
    if (scope === 'medication') return movements.filter((m) => m.itemType === 'medication');
    return movements;
  }, [movements, scope]);

  const setScope = (v: string) => {
    if (v === 'all') setParams({}, { replace: true });
    else setParams({ scope: v }, { replace: true });
  };

  const grouped = useMemo(() => {
    const g = new Map<string, Movement[]>();
    for (const m of scoped ?? []) {
      const key = toLocalDateKey(m.fecha);
      const list = g.get(key) ?? [];
      list.push(m);
      g.set(key, list);
    }
    return [...g.entries()];
  }, [scoped]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-h2">{t('movimientos.historial')}</h1>

      <Segmented
        value={scope}
        onChange={setScope}
        ariaLabel={t('movimientos.scope')}
        options={[
          { value: 'all', label: t('movimientos.scope.all') },
          { value: 'product', label: t('movimientos.scope.products') },
          { value: 'medication', label: t('movimientos.scope.medications') },
        ]}
      />

      {!scoped || scoped.length === 0 ? (
        <p className="text-body text-muted">{t('movimientos.historial.empty')}</p>
      ) : (
        grouped.map(([key, list]) => {
          const label =
            key === todayKey()
              ? t('movimientos.hoy')
              : key === yesterdayKey()
                ? t('movimientos.ayer')
                : formatDateShort(key);
          return (
            <section key={key}>
              <h2 className="text-label mb-2 text-muted">{label}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        m.kind === 'entrada'
                          ? 'bg-success-500/15 text-success-700'
                          : 'bg-secondary-500/15 text-secondary-700'
                      }`}
                    >
                      {m.kind === 'entrada' ? (
                        <ArrowDownRight size={20} />
                      ) : (
                        <ArrowUpRight size={20} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium">
                        {itemName(m.itemType, m.itemId, maps)}
                      </p>
                      <p className="truncate text-caption text-muted">
                        {m.nota || t(ITEM_NAV_KEY[m.itemType])}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-numeric font-semibold ${
                          m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'
                        }`}
                      >
                        {m.kind === 'entrada' ? '+' : '−'}
                        {formatNumber(m.qty)}
                        <span className="ml-1 text-caption text-muted">
                          {unitBy.get(m.unitId) ?? ''}
                        </span>
                      </p>
                      <p className="text-caption text-muted">{formatTime(m.fecha)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateKey(d.toISOString());
}