import { useState, useMemo } from 'react';
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
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  pageSize = 20,
  onRowClick,
  emptyMessage = 'Sin datos',
  loading = false,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
                  {col.sortable && (
                    sortKey === col.key
                      ? (sortDir === 'asc' ? <CaretUp size={14} className="text-primary-700" /> : <CaretDown size={14} className="text-primary-700" />)
                      : <CaretDown size={14} className="opacity-30" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paged.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={clsx(
                  'border-b border-border transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-3 text-body', col.className)}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
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
      )}
    </div>
  );
}

export type { Column, DataTableProps };
