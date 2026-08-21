import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Stack, Triangle, Package, Warning, Pill } from '@phosphor-icons/react';
import { fetchProducts, fetchMedications, fetchMovements, fetchLots, type Product, type Movement } from '../../lib/db';
import { formatNumber, startOfTodayISO } from '../../lib/format';
import { lotExpired } from '../../lib/medicationOps';
import { MovementsWidget } from '../movimientos/MovementsWidget';

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
    <div className="flex flex-col gap-6 p-4">
      <header>
        <p className="text-body-sm text-muted">Donario</p>
        <h1 className="text-h2">{t('dashboard.title')}</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 rounded-lg bg-card p-4 shadow-elev-1">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-numeric-lg">{loading ? '…' : formatNumber(value)}</p>
              <p className="text-caption text-muted">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link to="/movimiento?tipo=entrada" className="bg-primary-600 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg p-4 text-inverse shadow-elev-2 transition-transform active:scale-95">
          <ArrowDownRight size={28} aria-hidden="true" />
          <span className="text-caption font-semibold">{t('dashboard.quick.entrada')}</span>
        </Link>
        <Link to="/movimiento?tipo=salida" className="bg-secondary-600 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg p-4 text-inverse shadow-elev-2 transition-transform active:scale-95">
          <ArrowUpRight size={28} aria-hidden="true" />
          <span className="text-caption font-semibold">{t('dashboard.quick.salida')}</span>
        </Link>
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
            <span className="flex-1 text-body-sm font-medium">{expiredLots} medicamento(s) con lotes vencidos</span>
          </div>
        </section>
      )}

      <span className="text-caption text-muted flex items-center gap-1">
        <Package size={16} aria-hidden="true" /> Donario
      </span>
    </div>
  );
}
