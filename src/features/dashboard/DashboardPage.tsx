import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Stack, Warning, Package, Pill, TrendUp, TrendDown, Eye } from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { fetchProducts, fetchMedications, fetchMovements, fetchLots, type Product, type Movement } from '../../lib/db';
import { formatNumber, startOfTodayISO } from '../../lib/format';
import { lotExpired } from '../../lib/medicationOps';
import { MovementsWidget } from '../movimientos/MovementsWidget';
import { Skeleton } from '../../components/ui/Skeleton';

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<IconProps>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function KpiCard({ label, value, icon: Icon, trend, trendValue, variant = 'default' }: KpiCardProps) {
  const variantStyles = {
    default: 'bg-surface-card border-border',
    success: 'bg-success-50 border-success-200',
    warning: 'bg-warning-50 border-warning-200',
    danger: 'bg-danger-50 border-danger-200',
  };

  const iconStyles = {
    default: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
  };

  const valueStyles: Record<string, string> = {
    default: 'text-fg',
    success: 'text-success-700',
    warning: 'text-warning-700',
    danger: 'text-danger-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconStyles[variant]}`}>
          <Icon size={20} weight="fill" />
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-caption font-medium ${
            trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-danger-600' : 'text-text-secondary'
          }`}>
            {trend === 'up' ? <TrendUp size={14} /> : trend === 'down' ? <TrendDown size={14} /> : null}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className={`text-numeric-xl font-bold ${valueStyles[variant]}`}>{formatNumber(value)}</p>
        <p className="mt-1 text-body-sm text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [todayMovements, setTodayMovements] = useState<Movement[]>([]);
  const [medMovements, setMedMovements] = useState<Movement[]>([]);
  const [expiredLots, setExpiredLots] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [prods, medsData, movs, medMovs] = await Promise.all([
        fetchProducts(),
        fetchMedications(),
        fetchMovements({ since: startOfTodayISO() }),
        fetchMovements({ itemType: 'medication', limit: 5 }),
      ]);
      setProducts(prods);
      setTodayMovements(movs);
      setMedMovements(medMovs);

      let expired = 0;
      const lotsResults = await Promise.all(medsData.map((m) => fetchLots(m.id)));
      for (const lots of lotsResults) {
        if (lots.some(lotExpired)) expired++;
      }
      setExpiredLots(expired);
      setLoading(false);
    })();
  }, []);

  const entradaHoy = todayMovements.filter((m) => m.kind === 'entrada').reduce((acc, m) => acc + m.qty, 0);
  const salidaHoy = todayMovements.filter((m) => m.kind === 'salida').reduce((acc, m) => acc + m.qty, 0);
  const lowStock = products.filter((p) => p.is_active && p.min_stock != null && p.total_stock <= p.min_stock);
  const outOfStock = products.filter((p) => p.is_active && p.total_stock === 0);

  const alertsCount = lowStock.length + expiredLots;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-display-md mb-1">{t('dashboard.title')}</h1>
        <p className="text-body text-text-secondary">
          Resumen del inventario y actividad reciente
        </p>
      </header>

      {/* Quick Actions */}
      <section className="mb-6">
        <h2 className="sr-only">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </>
          ) : (
            <>
              <Link
                to="/entradas/nueva?tipo=entrada"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 text-body font-semibold transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 active:scale-[0.98]"
              >
                <ArrowDownRight size={20} className="text-success-600" />
                <span>Nueva entrada</span>
              </Link>
              <Link
                to="/salidas/nueva?tipo=salida"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 text-body font-semibold transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 active:scale-[0.98]"
              >
                <ArrowUpRight size={20} className="text-warning-600" />
                <span>Nueva salida</span>
              </Link>
              <Link
                to="/productos"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 text-body font-semibold transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 active:scale-[0.98]"
              >
                <Package size={20} className="text-primary-600" />
                <span>Productos</span>
              </Link>
              <Link
                to="/informes"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 text-body font-semibold transition-all hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 active:scale-[0.98]"
              >
                <Eye size={20} className="text-info-600" />
                <span>Ver reportes</span>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-6">
        <h2 className="sr-only">Indicadores principales</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="animate-fade-in-up stagger-1">
              <KpiCard
                label="Entradas hoy"
                value={entradaHoy}
                icon={ArrowDownRight}
                variant="success"
              />
            </div>
            <div className="animate-fade-in-up stagger-2">
              <KpiCard
                label="Salidas hoy"
                value={salidaHoy}
                icon={ArrowUpRight}
                variant="warning"
              />
            </div>
            <div className="animate-fade-in-up stagger-3">
              <KpiCard
                label="Total productos"
                value={products.length}
                icon={Stack}
                variant="default"
              />
            </div>
            <div className="animate-fade-in-up stagger-4">
              <KpiCard
                label="Alertas"
                value={alertsCount}
                icon={Warning}
                variant={alertsCount > 0 ? 'danger' : 'default'}
              />
            </div>
          </div>
        )}
      </section>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Movements Widget - spans 2 columns */}
        <div className="lg:col-span-2">
          <MovementsWidget />
        </div>

        {/* Alerts sidebar */}
        <div className="space-y-4">
          {/* Low Stock */}
          {lowStock.length > 0 && (
            <section className="rounded-xl border border-warning-200 bg-warning-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-100">
                  <Warning size={18} className="text-warning-600" weight="fill" />
                </div>
                <h3 className="text-h3 text-warning-700">Stock bajo</h3>
              </div>
              <ul className="space-y-2">
                {lowStock.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-body-sm">
                    <span className="truncate text-fg">{p.name}</span>
                    <span className="ml-2 shrink-0 font-semibold text-warning-700">
                      {formatNumber(p.total_stock)}
                    </span>
                  </li>
                ))}
                {lowStock.length > 5 && (
                  <li className="text-caption text-warning-600">
                    +{lowStock.length - 5} más
                  </li>
                )}
              </ul>
              <Link
                to="/productos?filter=low-stock"
                className="mt-3 block text-center text-caption font-semibold text-warning-700 hover:underline"
              >
                Ver todos los productos con stock bajo
              </Link>
            </section>
          )}

          {/* Out of Stock */}
          {outOfStock.length > 0 && (
            <section className="rounded-xl border border-danger-200 bg-danger-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-100">
                  <Package size={18} className="text-danger-600" weight="fill" />
                </div>
                <h3 className="text-h3 text-danger-700">Agotados</h3>
              </div>
              <ul className="space-y-2">
                {outOfStock.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-body-sm">
                    <span className="truncate text-fg">{p.name}</span>
                    <span className="ml-2 shrink-0 font-semibold text-danger-700">0</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Expired Medications */}
          {expiredLots > 0 && (
            <section className="rounded-xl border border-danger-200 bg-danger-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-100">
                  <Pill size={18} className="text-danger-600" weight="fill" />
                </div>
                <h3 className="text-h3 text-danger-700">Vencidos</h3>
              </div>
              <p className="text-body-sm text-fg">
                {expiredLots === 1
                  ? '1 medicamento tiene lotes vencidos'
                  : `${expiredLots} medicamentos tienen lotes vencidos`}
              </p>
              <Link
                to="/medicamentos?filter=expired"
                className="mt-3 block text-center text-caption font-semibold text-danger-700 hover:underline"
              >
                Ver medicamentos vencidos
              </Link>
            </section>
          )}

          {/* Recent Medications Activity */}
          <section className="rounded-xl border border-border bg-surface-card p-4">
            <h3 className="text-h3 mb-3">Medicamentos</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : medMovements.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                No hay movimientos de medicamentos hoy
              </p>
            ) : (
              <ul className="space-y-2">
                {medMovements.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-body-sm">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      m.kind === 'entrada' ? 'bg-success-100 text-success-600' : 'bg-warning-100 text-warning-600'
                    }`}>
                      {m.kind === 'entrada' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg">{m.item_id}</span>
                    <span className={`font-semibold ${
                      m.kind === 'entrada' ? 'text-success-700' : 'text-warning-700'
                    }`}>
                      {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
