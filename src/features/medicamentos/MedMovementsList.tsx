import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, Funnel, X } from '@phosphor-icons/react';
import { fetchMovements, fetchMedications, fetchUnits, type Movement, type Medication, type Unit } from '../../lib/db';
import { formatNumber, formatTime, formatDateShort, toLocalDateKey, todayKey } from '../../lib/format';
import { SkeletonList } from '../../components/ui/Skeleton';
import { SearchInput } from '../../components/ui/SearchInput';
import { Button } from '../../components/ui/Button';
import { MovementDetailModal } from './MovementDetailModal';
import { MovementEditModal } from './MovementEditModal';

interface MedMovementsListProps {
  kind?: 'entrada' | 'salida';
  onReloadInventory?: () => void;
}

export function MedMovementsList({ kind, onReloadInventory }: MedMovementsListProps) {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Modales
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);

  const medById = useMemo(() => new Map(medications.map((m) => [m.id, m])), [medications]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [movs, meds, uList] = await Promise.all([
      fetchMovements({ itemType: 'medication', limit: 300 }),
      fetchMedications(),
      fetchUnits(),
    ]);
    setMovements(movs);
    setMedications(meds);
    setUnits(uList);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleReload = () => {
    void loadData();
    if (onReloadInventory) onReloadInventory();
  };

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      // Filtro por tipo (entrada/salida)
      if (kind && m.kind !== kind) return false;

      // Filtro por fecha desde
      if (startDate && new Date(m.fecha) < new Date(`${startDate}T00:00:00`)) return false;

      // Filtro por fecha hasta
      if (endDate && new Date(m.fecha) > new Date(`${endDate}T23:59:59`)) return false;

      // Filtro por búsqueda de texto
      if (query.trim()) {
        const q = query.toLowerCase();
        const med = medById.get(m.item_id);
        const nameMatch = med?.name.toLowerCase().includes(q) ?? false;
        const ingMatch = med?.active_ingredient?.toLowerCase().includes(q) ?? false;
        const noteMatch = m.nota?.toLowerCase().includes(q) ?? false;
        if (!nameMatch && !ingMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [movements, kind, startDate, endDate, query, medById]);

  const grouped = useMemo(() => {
    const g = new Map<string, Movement[]>();
    for (const m of filtered) {
      const key = toLocalDateKey(m.fecha);
      const list = g.get(key) ?? [];
      list.push(m);
      g.set(key, list);
    }
    return [...g.entries()];
  }, [filtered]);

  function yesterdayKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d.toISOString());
  }

  const clearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
  };

  const activeFiltersCount = (startDate ? 1 : 0) + (endDate ? 1 : 0);

  if (loading) return <SkeletonList />;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por medicamento, principio activo u observación"
            aria-label="Buscar movimientos de medicamentos"
          />
        </div>
        <Button
          variant={showFilters || activeFiltersCount > 0 ? 'secondary' : 'ghost'}
          onClick={() => setShowFilters(!showFilters)}
          className="shrink-0"
        >
          <Funnel size={18} />
          Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Button>
      </div>

      {/* Panel de Filtros Expandible */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-label font-semibold text-fg">Filtros avanzados</h3>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-caption text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <X size={14} /> Limpiar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-start" className="mb-1 block text-caption text-muted font-medium">
                Fecha Desde
              </label>
              <input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface p-2 text-caption text-fg focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="filter-end" className="mb-1 block text-caption text-muted font-medium">
                Fecha Hasta
              </label>
              <input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface p-2 text-caption text-fg focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Lista de Movimientos */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-body text-muted">{t('medicamentos.mov.empty')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([key, list]) => {
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
                  {list.map((m) => {
                    const med = medById.get(m.item_id);
                    const unit = m.unit_id ? unitById.get(m.unit_id) : null;
                    return (
                      <li
                        key={m.id}
                        onClick={() => setSelectedMovement(m)}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary-500/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            m.kind === 'entrada'
                              ? 'bg-success-500/15 text-success-700'
                              : 'bg-secondary-500/15 text-secondary-700'
                          }`}
                        >
                          {m.kind === 'entrada' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-fg">{med?.name ?? '?'}</p>
                          {m.nota && <p className="truncate text-caption text-muted">{m.nota}</p>}
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-numeric font-semibold ${
                              m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'
                            }`}
                          >
                            {m.kind === 'entrada' ? '+' : '−'}
                            {formatNumber(m.qty)}
                            <span className="ml-1 text-caption text-muted">{unit?.abbreviation ?? ''}</span>
                          </p>
                          <p className="text-caption text-muted">{formatTime(m.fecha)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <MovementDetailModal
        movement={selectedMovement}
        medication={selectedMovement ? medById.get(selectedMovement.item_id) ?? null : null}
        unit={selectedMovement && selectedMovement.unit_id ? unitById.get(selectedMovement.unit_id) ?? null : null}
        open={selectedMovement !== null}
        onClose={() => setSelectedMovement(null)}
        onEdit={(m) => setEditingMovement(m)}
        onReload={handleReload}
      />

      <MovementEditModal
        movement={editingMovement}
        open={editingMovement !== null}
        onClose={() => setEditingMovement(null)}
        onSuccess={handleReload}
      />
    </div>
  );
}
