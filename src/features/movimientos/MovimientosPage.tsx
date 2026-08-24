import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react';
import { fetchMovements, fetchProducts, fetchMedications, fetchKits, fetchUnits, type Movement, type ItemType } from '../../lib/db';
import { fetchWarehouses } from '../../lib/warehouseOps';
import { formatNumber, formatTime, formatDateShort, toLocalDateKey, todayKey } from '../../lib/format';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { Segmented } from '../../components/ui/Segmented';
import { SkeletonList } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageContainer } from '../../components/layout/PageContainer';

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

  const [movements, setMovements] = useState<Movement[]>([]);
  const [maps, setMaps] = useState<{ product: Map<string, string>; medication: Map<string, string>; kit: Map<string, string> }>({ product: new Map(), medication: new Map(), kit: new Map() });
  const [unitBy, setUnitBy] = useState<Map<string, string>>(new Map());
  const [warehouseMap, setWarehouseMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    void (async () => {
      const [movs, prods, meds, kits, units, warehouses] = await Promise.all([
        fetchMovements({ limit: 200, warehouseId: warehouseId || undefined }),
        fetchProducts(),
        fetchMedications(),
        fetchKits(),
        fetchUnits(),
        fetchWarehouses(),
      ]);
      setMovements(movs);
      setMaps({
        product: new Map(prods.map((p) => [p.id, p.name])),
        medication: new Map(meds.map((m) => [m.id, m.name])),
        kit: new Map(kits.map((k) => [k.id, k.name])),
      });
      setUnitBy(new Map(units.map((u) => [u.id, u.abbreviation])));
      setWarehouseMap(new Map(warehouses.map((w) => [w.id, w.name])));
      setLoading(false);
    })();
  }, [warehouseId]);

  const scoped = useMemo(() => {
    if (scope === 'product') return movements.filter((m) => m.item_type !== 'medication');
    if (scope === 'medication') return movements.filter((m) => m.item_type === 'medication');
    return movements;
  }, [movements, scope]);

  const setScope = (v: string) => {
    if (v === 'all') setParams({}, { replace: true });
    else setParams({ scope: v }, { replace: true });
  };

  const grouped = useMemo(() => {
    const g = new Map<string, Movement[]>();
    for (const m of scoped) {
      const key = toLocalDateKey(m.fecha);
      const list = g.get(key) ?? [];
      list.push(m);
      g.set(key, list);
    }
    return [...g.entries()];
  }, [scoped]);

  function yesterdayKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d.toISOString());
  }

  return (
    <PageContainer>
      <h1 className="text-h2">{t('movimientos.historial')}</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
        <Segmented value={scope} onChange={setScope} ariaLabel={t('movimientos.scope')} options={[{ value: 'all', label: t('movimientos.scope.all') }, { value: 'product', label: t('movimientos.scope.products') }, { value: 'medication', label: t('movimientos.scope.medications') }]} />
      </div>
      {loading ? (
        <SkeletonList />
      ) : scoped.length === 0 ? (
        <EmptyState title={t('movimientos.historial.empty')} />
      ) : (
        grouped.map(([key, list]) => {
          const label = key === todayKey() ? t('movimientos.hoy') : key === yesterdayKey() ? t('movimientos.ayer') : formatDateShort(key);
          return (
            <section key={key}>
              <h2 className="text-label mb-2 text-muted">{label}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.kind === 'entrada' ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'}`}>
                      {m.kind === 'entrada' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium">{itemName(m.item_type, m.item_id, maps)}</p>
                      <p className="truncate text-caption text-muted">
                        {m.warehouse_id && warehouseMap.has(m.warehouse_id)
                          ? `${warehouseMap.get(m.warehouse_id)} · `
                          : ''}
                        {m.nota || t(ITEM_NAV_KEY[m.item_type])}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-numeric font-semibold ${m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'}`}>
                        {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}<span className="ml-1 text-caption text-muted">{unitBy.get(m.unit_id) ?? ''}</span>
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
    </PageContainer>
  );
}
