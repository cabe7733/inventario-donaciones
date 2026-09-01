import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Package, Pill, Cube, Plus } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { fetchMovements, fetchProducts, fetchMedications, fetchKits, type Movement, type ItemType } from '../../lib/db';
import { formatNumber, formatTime } from '../../lib/format';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { clsx } from 'clsx';

const ICON: Record<ItemType, typeof Package> = {
  product: Package,
  medication: Pill,
  kit: Cube,
};

const kindStyles = {
  entrada: {
    bg: 'bg-success-100',
    text: 'text-success-600',
    iconBg: 'bg-success-500',
  },
  salida: {
    bg: 'bg-warning-100',
    text: 'text-warning-600',
    iconBg: 'bg-warning-500',
  },
};

export function MovementsWidget() {
  const [recent, setRecent] = useState<Movement[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [movs, prods, meds, kits] = await Promise.all([
        fetchMovements({ limit: 8 }),
        fetchProducts(),
        fetchMedications(),
        fetchKits(),
      ]);
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
    <section className="rounded-xl border border-border bg-surface-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h2">Movimientos recientes</h2>
        <Link
          to="/mas/movimientos"
          className="text-caption font-semibold text-accent-600 hover:text-accent-700"
        >
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
            <Plus size={24} className="text-text-tertiary" />
          </div>
          <p className="text-body text-text-secondary">No hay movimientos registrados</p>
          <p className="mt-1 text-caption text-text-tertiary">
            Los movimientos aparecerán aquí cuando se registren entradas o salidas
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recent.map((m, index) => {
            const Icon = ICON[m.item_type];
            const style = kindStyles[m.kind];

            return (
              <li
                key={m.id}
                className={clsx(
                  'flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-neutral-50',
                  'animate-fade-in-up',
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', style.bg)}>
                  <span className={clsx('flex h-5 w-5 items-center justify-center rounded-md', style.iconBg)}>
                    {m.kind === 'entrada' ? (
                      <ArrowDownRight size={14} className="text-white" weight="bold" />
                    ) : (
                      <ArrowUpRight size={14} className="text-white" weight="bold" />
                    )}
                  </span>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                  <Icon size={16} className="text-text-secondary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-fg">
                    {names.get(m.item_id) ?? '—'}
                  </p>
                  <p className="text-caption text-text-tertiary">
                    {m.item_type === 'product' ? 'Producto' : m.item_type === 'medication' ? 'Medicamento' : 'Kit'}
                  </p>
                </div>

                <div className="text-right">
                  <p className={clsx('text-numeric font-semibold', style.text)}>
                    {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}
                  </p>
                  <p className="text-caption text-text-tertiary">{formatTime(m.fecha)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
