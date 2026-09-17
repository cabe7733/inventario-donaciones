import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ListChecks, Warning, Database, Note } from '@phosphor-icons/react';
import { fetchPublicNeeds, fetchPublicCenters } from '../../../lib/centerOps';
import { NeedItem } from './NeedItem';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { NeedItemType, NeedSource } from '../../../lib/centerOps';

const TYPE_FILTERS: { key: NeedItemType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'product', label: 'Productos' },
  { key: 'medication', label: 'Medicamentos' },
  { key: 'medical_supply', label: 'Insumos' },
];

const SOURCE_FILTERS: { key: NeedSource | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'manual', label: 'Solicitudes' },
];

export function NeedsPage() {
  const [typeFilter, setTypeFilter] = useState<NeedItemType | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<NeedSource | 'all'>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [urgentOnly, setUrgentOnly] = useState(false);

  const { data: allNeeds = [], isLoading } = useQuery({
    queryKey: ['public-needs'],
    queryFn: () => fetchPublicNeeds(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: centers = [] } = useQuery({
    queryKey: ['public-centers'],
    queryFn: fetchPublicCenters,
    staleTime: 5 * 60 * 1000,
  });

  const filteredNeeds = useMemo(() => {
    let result = allNeeds;
    if (centerFilter !== 'all') {
      result = result.filter((n) => n.center_id === centerFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((n) => n.item_type === typeFilter);
    }
    if (sourceFilter !== 'all') {
      result = result.filter((n) => n.source === sourceFilter);
    }
    if (urgentOnly) {
      result = result.filter((n) => n.priority === 'urgent' || n.priority === 'high');
    }
    return result;
  }, [allNeeds, centerFilter, typeFilter, sourceFilter, urgentOnly]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allNeeds.length };
    for (const need of allNeeds) {
      counts[need.item_type] = (counts[need.item_type] || 0) + 1;
    }
    return counts;
  }, [allNeeds]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allNeeds.length };
    for (const need of allNeeds) {
      counts[need.source] = (counts[need.source] || 0) + 1;
    }
    return counts;
  }, [allNeeds]);

  const urgentCount = useMemo(
    () => allNeeds.filter((n) => n.priority === 'urgent' || n.priority === 'high').length,
    [allNeeds],
  );

  const centersWithNeeds = useMemo(() => {
    const ids = new Set(allNeeds.map((n) => n.center_id));
    return centers.filter((c) => ids.has(c.id));
  }, [allNeeds, centers]);

  return (
    <PageContainer>
      <PageHeader
        title="¿Qué se necesita?"
        description="Lista de necesidades actuales de todos los centros de acopio. Antes de comprar algo, mira qué hace falta de verdad."
      />

      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Center filter */}
        {centersWithNeeds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface-card px-3 text-body-sm text-text-secondary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="all">Todos los centros</option>
              {centersWithNeeds.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => {
            const count = typeCounts[filter.key] || 0;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTypeFilter(filter.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  typeFilter === filter.key
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {filter.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  typeFilter === filter.key ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-800 text-text-tertiary'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Source + Urgent row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Source filters */}
          <div className="flex gap-1.5">
            {SOURCE_FILTERS.map((filter) => {
              const count = sourceCounts[filter.key] || 0;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setSourceFilter(filter.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    sourceFilter === filter.key
                      ? 'bg-accent-600 text-white'
                      : 'border border-border bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {filter.key === 'inventory' && <Database size={12} aria-hidden />}
                  {filter.key === 'manual' && <Note size={12} aria-hidden />}
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    sourceFilter === filter.key ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-800 text-text-tertiary'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Urgent toggle */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-caption font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border-default text-primary-600 focus:ring-primary-500/20"
            />
            <Warning size={12} className={urgentOnly ? 'text-danger-500' : 'text-text-tertiary'} />
            Solo urgente
            <span className="rounded-full bg-danger-100 dark:bg-danger-950/40 px-1.5 py-0.5 text-[10px] font-bold text-danger-700 dark:text-danger-300">
              {urgentCount}
            </span>
          </label>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredNeeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-surface-card py-16 text-center shadow-elev-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-400 ring-1 ring-primary-200/50 dark:ring-primary-800/40">
            <ListChecks size={28} />
          </div>
          <h3 className="mt-4 text-h2 text-text-primary">
            {urgentOnly || typeFilter !== 'all' || sourceFilter !== 'all' || centerFilter !== 'all'
              ? 'Sin resultados'
              : 'Sin necesidades registradas'}
          </h3>
          <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
            {urgentOnly || typeFilter !== 'all' || sourceFilter !== 'all' || centerFilter !== 'all'
              ? 'No hay necesidades que coincidan con los filtros seleccionados.'
              : 'Aún no hay necesidades registradas en la plataforma.'}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-body-sm text-text-secondary">
            {filteredNeeds.length} necesidade{filteredNeeds.length !== 1 ? 's' : ''} encontrada{filteredNeeds.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredNeeds.map((need) => (
              <NeedItem key={need.id} need={need} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
