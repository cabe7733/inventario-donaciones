import { isValidElement, useState, useMemo, useEffect, type ReactNode } from 'react';
import { CaretLeft, CaretRight, CaretUp, CaretDown, DotsThree, MagnifyingGlass, X } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { normalize } from '../../lib/search';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  filterable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  priorityColumns?: string[];
  actions?: Array<{
    label: string;
    onClick: (row: T) => void;
    icon?: React.ReactNode;
    danger?: boolean;
  }>;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

function getCellValue<T>(col: Column<T>, row: T): ReactNode {
  return col.render
    ? col.render(row)
    : String((row as Record<string, unknown>)[col.key] ?? '');
}

function getCellText(value: ReactNode): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(getCellText).join(' ');
  if (isValidElement(value)) return getCellText(value.props.children);
  return '';
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  pageSize = 20,
  onRowClick,
  emptyMessage = 'Sin datos',
  loading = false,
  priorityColumns,
  actions,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | number | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const filtered = useMemo(() => {
    const normalizedSearch = normalize(search);
    return data.filter((row) => {
      const matchesSearch = !normalizedSearch || columns.some((col) =>
        normalize(getCellText(getCellValue(col, row))).includes(normalizedSearch),
      );
      const matchesColumns = columns.every((col) => {
        const value = normalize(columnFilters[col.key] ?? '');
        return !value || normalize(getCellText(getCellValue(col, row))).includes(value);
      });
      return matchesSearch && matchesColumns;
    });
  }, [columnFilters, columns, data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(sorted.length / rowsPerPage);

  useEffect(() => {
    if (page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando datos">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse-soft rounded-xl border border-border bg-surface-card" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-card p-8 text-center">
        <p className="text-body text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  const hasFilters = Boolean(search || Object.values(columnFilters).some(Boolean));
  const clearFilters = () => {
    setSearch('');
    setColumnFilters({});
    setPage(0);
  };

  const renderControls = () => (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar en la tabla</span>
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar en todos los campos..."
          className="h-10 w-full rounded-lg border border-border bg-surface px-9 text-body-sm text-fg placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200"
        />
        {search && <button type="button" onClick={() => { setSearch(''); setPage(0); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:bg-neutral-100" aria-label="Limpiar búsqueda"><X size={16} /></button>}
      </label>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-caption text-text-secondary">
          <span>Registros:</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} className="h-9 rounded-lg border border-border bg-surface px-2 text-body-sm text-fg focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200" aria-label="Registros por página">
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        {hasFilters && <button type="button" onClick={clearFilters} className="text-caption font-medium text-accent-700 hover:underline">Limpiar filtros</button>}
      </div>
    </div>
  );

  const primaryCol = columns[0];
  const prioritySet = priorityColumns ? new Set(priorityColumns) : null;
  const visibleMobileCols = prioritySet
    ? columns.filter((c) => prioritySet.has(c.key))
    : columns;

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between gap-4 px-1 py-3">
        <span className="text-caption text-text-secondary">
          {sorted.length ? `${page * rowsPerPage + 1}–${Math.min((page + 1) * rowsPerPage, sorted.length)} de ${sorted.length}` : '0 registros'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            aria-label="Página anterior"
            className="gap-1"
          >
            <CaretLeft size={14} />
            Anterior
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            aria-label="Página siguiente"
            className="gap-1"
          >
            Siguiente
            <CaretRight size={14} />
          </Button>
        </div>
      </div>
    );
  };

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-3">
        {renderControls()}
        {sorted.length === 0 ? <div className="rounded-xl border border-border bg-surface-card p-8 text-center"><p className="text-body text-text-secondary">No hay registros que coincidan con los filtros.</p></div> : null}
        <ul className="flex flex-col gap-2">
          {paged.map((row, i) => (
            <li
              key={row.id ?? i}
              className={clsx(
                'rounded-xl border border-border bg-surface-card p-4 transition-colors',
                onRowClick && 'cursor-pointer hover:border-primary-300',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {primaryCol && (
                    <p className="text-body font-semibold text-fg">{getCellValue(primaryCol, row)}</p>
                  )}
                  {visibleMobileCols.length > 1 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      {visibleMobileCols.slice(1).map((col) => (
                        <div key={col.key} className="min-w-0">
                          <dt className="text-caption text-text-tertiary">{col.header}</dt>
                          <dd className="truncate text-body-sm text-fg">{getCellValue(col, row)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                {actions && actions.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMobileMenuOpen(mobileMenuOpen === row.id ? null : row.id!);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100"
                      aria-label="Acciones"
                      aria-expanded={mobileMenuOpen === row.id}
                      aria-haspopup="menu"
                    >
                      <DotsThree size={20} weight="bold" />
                    </button>
                    {mobileMenuOpen === row.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface-card py-1 shadow-elev-4" role="menu" aria-label="Acciones de fila">
                        {actions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMobileMenuOpen(null);
                              action.onClick(row);
                            }}
                            className={clsx(
                              'flex w-full items-center gap-2 px-4 py-2.5 text-left text-body-sm transition-colors',
                              action.danger
                                ? 'text-danger-600 hover:bg-danger-50'
                                : 'text-fg hover:bg-neutral-50',
                            )}
                          >
                            {action.icon}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {renderPagination()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
        {renderControls()}
        {sorted.length === 0 ? <div className="rounded-xl border border-border bg-surface-card p-8 text-center"><p className="text-body text-text-secondary">No hay registros que coincidan con los filtros.</p></div> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-neutral-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined}
                  className={clsx(
                    'px-4 py-3 text-caption font-semibold uppercase tracking-wider text-text-secondary',
                    col.sortable && 'cursor-pointer hover:text-fg select-none',
                    alignClass(col.align),
                    col.className,
                  )}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <CaretUp size={12} className="text-accent-600" />
                          ) : (
                            <CaretDown size={12} className="text-accent-600" />
                          )
                        ) : (
                          <>
                            <CaretUp size={10} className="text-border-strong -mb-1" />
                            <CaretDown size={10} className="text-border-strong" />
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th scope="col" className="px-4 py-3 text-caption font-semibold uppercase tracking-wider text-text-secondary w-20">
                  Acciones
                </th>
              )}
            </tr>
            <tr className="border-b border-border bg-surface-card">
              {columns.map((col) => (
                <th key={col.key} className={clsx('px-3 py-2', col.className)}>
                  {col.filterable !== false && <input value={columnFilters[col.key] ?? ''} onChange={(e) => { setColumnFilters((current) => ({ ...current, [col.key]: e.target.value })); setPage(0); }} placeholder={`Filtrar ${col.header}`} aria-label={`Filtrar por ${col.header}`} className="h-8 w-full min-w-24 rounded-md border border-border bg-surface px-2 text-caption font-normal normal-case tracking-normal text-fg placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200" />}
                </th>
              ))}
              {actions && actions.length > 0 && <th />}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={clsx(
                  'border-b border-border transition-colors last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-neutral-50',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-4 py-3 text-body',
                      alignClass(col.align),
                      col.className,
                    )}
                  >
                    {getCellValue(col, row)}
                  </td>
                ))}
                {actions && actions.length > 0 && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                            action.danger
                              ? 'text-text-secondary hover:bg-danger-50 hover:text-danger-600'
                              : 'text-text-secondary hover:bg-neutral-100 hover:text-fg',
                          )}
                          aria-label={action.label}
                        >
                          {action.icon}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );
}

export type { Column, DataTableProps };
