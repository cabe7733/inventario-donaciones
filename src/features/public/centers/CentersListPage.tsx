import { useQuery } from '@tanstack/react-query';
import { Buildings, MagnifyingGlass } from '@phosphor-icons/react';
import { useState, useMemo } from 'react';
import { fetchPublicCenters } from '../../../lib/centerOps';
import { CenterCard } from './CenterCard';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { SkeletonCard } from '../../../components/ui/Skeleton';

export function CentersListPage() {
  const [search, setSearch] = useState('');
  const [donationsOnly, setDonationsOnly] = useState(false);

  const { data: centers = [], isLoading } = useQuery({
    queryKey: ['public-centers'],
    queryFn: fetchPublicCenters,
    staleTime: 5 * 60 * 1000,
  });

  const filteredCenters = useMemo(() => {
    let result = centers;
    if (donationsOnly) {
      result = result.filter((c) => c.accepts_donations);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.state?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [centers, search, donationsOnly]);

  return (
    <PageContainer>
      <PageHeader
        title="Centros de acopio"
        description="Encuentra centros de acopio activos y descubre qué necesitan."
      />

      {/* Search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar centro, ciudad o dirección..."
            className="h-10 w-full rounded-xl border border-border-default bg-surface-card pl-10 pr-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-body-sm text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <input
            type="checkbox"
            checked={donationsOnly}
            onChange={(e) => setDonationsOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border-default text-primary-600 focus:ring-primary-500/20"
          />
          Acepta donaciones
        </label>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredCenters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-surface-card py-16 text-center shadow-elev-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-400 ring-1 ring-primary-200/50 dark:ring-primary-800/40">
            <Buildings size={28} />
          </div>
          <h3 className="mt-4 text-h2 text-text-primary">
            {search ? 'Sin resultados' : 'Sin centros registrados'}
          </h3>
          <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
            {search
              ? `No se encontraron centros que coincidan con "${search}".`
              : 'Aún no hay centros de acopio registrados en la plataforma.'}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-body-sm text-text-secondary">
            {filteredCenters.length} centro{filteredCenters.length !== 1 ? 's' : ''} encontrado{filteredCenters.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCenters.map((center) => (
              <CenterCard key={center.id} center={center} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
