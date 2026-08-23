import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Stack, Triangle, Warning, Pill } from '@phosphor-icons/react';
import { fetchProducts, fetchMedications, fetchMovements, fetchLots, type Product, type Movement } from '../../lib/db';
import { formatNumber, startOfTodayISO } from '../../lib/format';
import { lotExpired } from '../../lib/medicationOps';
import { MovementsWidget } from '../movimientos/MovementsWidget';
import { Skeleton } from '../../components/ui/Skeleton';

export function DashboardPage() {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [todayMovements, setTodayMovements] = useState<Movement[]>([]);
  const [expiredLots, setExpiredLots] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [prods, meds, movs] = await Promise.all([fetchProducts(), fetchMedications(), fetchMovements({ since: startOfTodayISO() })]);
      setProducts(prods);
      setTodayMovements(movs);

      let expired = 0;
      const lotsResults = await Promise.all(meds.map((m) => fetchLots(m.id)));
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

  const kpis = [
    { label: t('dashboard.kpis.entradasHoy'), value: entradaHoy, icon: ArrowDownRight },
    { label: t('dashboard.kpis.salidasHoy'), value: salidaHoy, icon: ArrowUpRight },
    { label: t('dashboard.kpis.alertas'), value: lowStock.length + expiredLots, icon: Warning },
    { label: t('dashboard.kpis.productos'), value: products.length, icon: Stack },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header>
        <h1 className="text-h2">{t('dashboard.title')}</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-14" />
              </div>
            ))
          : kpis.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <span className="flex items-center gap-1.5 text-caption text-muted">
                  <Icon size={14} aria-hidden="true" /> {label}
                </span>
                <p className="text-numeric-lg text-fg">{formatNumber(value)}</p>
              </div>
            ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {loading ? (
          <>
            <Skeleton className="min-h-[88px] rounded-lg" />
            <Skeleton className="min-h-[88px] rounded-lg" />
          </>
        ) : (
          <>
            <Link to="/entradas/nueva?tipo=entrada" className="bg-primary-600 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg p-4 text-inverse shadow-elev-2 transition-transform active:scale-95">
              <ArrowDownRight size={28} aria-hidden="true" />
              <span className="text-caption font-semibold">{t('dashboard.quick.entrada')}</span>
            </Link>
            <Link to="/salidas/nueva?tipo=salida" className="bg-secondary-600 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg p-4 text-inverse shadow-elev-2 transition-transform active:scale-95">
              <ArrowUpRight size={28} aria-hidden="true" />
              <span className="text-caption font-semibold">{t('dashboard.quick.salida')}</span>
            </Link>
          </>
        )}
      </section>

      <MovementsWidget />

      {lowStock.length > 0 && (
        <section>
          <h2 className="text-h3 mb-3">{t('dashboard.alerts')}</h2>
          <ul className="flex flex-col gap-2">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 p-3">
                <Triangle size={16} className="text-warning-700" aria-hidden="true" />
                <span className="flex-1 text-body-sm font-medium">{p.name}</span>
                <span className="text-numeric text-warning-700">{formatNumber(p.total_stock)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {expiredLots > 0 && (
        <section>
          <h2 className="text-h3 mb-3">{t('medicamentos.vto.expired')}</h2>
          <div className="flex items-center gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 p-3">
            <Pill size={16} className="text-danger-700" aria-hidden="true" />
            <span className="flex-1 text-body-sm font-medium">
              {expiredLots === 1
                ? '1 medicamento con lotes vencidos'
                : `${expiredLots} medicamentos con lotes vencidos`}
            </span>
            <Link to="/medicamentos" className="text-caption font-semibold text-danger-700 hover:underline">
              Ver
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
