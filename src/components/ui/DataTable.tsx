import { useState, useMemo, useEffect } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { clsx } from 'clsx';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  priorityColumns?: string[];
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

function getCellValue<T>(col: Column<T>, row: T): React.ReactNode {
  return col.render
    ? col.render(row)
    : String((row as Record<string, unknown>)[col.key] ?? '');
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  pageSize = 20,
  onRowClick,
  emptyMessage = 'Sin datos',
  loading = false,
  priorityColumns,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

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
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-body text-muted">
        {emptyMessage}
      </div>
    );
  }

  const primaryCol = columns[0];
  const prioritySet = priorityColumns ? new Set(priorityColumns) : null;
  const visibleMobileCols = prioritySet
    ? columns.filter((c) => prioritySet.has(c.key))
    : columns;

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between gap-2 px-1 py-3">
        <span className="text-caption text-muted">
          {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} de {data.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-lg px-3 py-1.5 text-caption font-medium text-muted hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-lg px-3 py-1.5 text-caption font-medium text-muted hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2">
          {paged.map((row, i) => (
            <li
              key={row.id ?? i}
              className={clsx(
                'rounded-lg border border-border bg-card p-3 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {primaryCol && (
                <p className="text-body font-semibold text-fg">{getCellValue(primaryCol, row)}</p>
              )}
              {visibleMobileCols.length > 1 && (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {visibleMobileCols.slice(1).map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-caption text-muted">{col.header}</dt>
                      <dd className="truncate text-body-sm text-fg">{getCellValue(col, row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
        {renderPagination()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-label text-muted',
                    col.sortable && 'cursor-pointer hover:text-fg select-none',
                    col.className,
                  )}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <CaretUp size={14} className="text-primary-700" />
                        ) : (
                          <CaretDown size={14} className="text-primary-700" />
                        )
                      ) : (
                        <CaretDown size={14} className="opacity-30" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={clsx(
                  'border-b border-border transition-colors last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-3 text-body', col.className)}>
                    {getCellValue(col, row)}
                  </td>
                ))}
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
