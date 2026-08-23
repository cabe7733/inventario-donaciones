import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Stack, Triangle, Warning, Pill } from '@phosphor-icons/react';
import { fetchProducts, fetchMedications, fetchMovements, fetchLots, type Product, type Movement, type Medication } from '../../lib/db';
import { formatNumber, formatTime, startOfTodayISO } from '../../lib/format';
import { lotExpired } from '../../lib/medicationOps';
import { MovementsWidget } from '../movimientos/MovementsWidget';
import { Skeleton } from '../../components/ui/Skeleton';

export function DashboardPage() {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [todayMovements, setTodayMovements] = useState<Movement[]>([]);
  const [medMovements, setMedMovements] = useState<Movement[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [expiredLots, setExpiredLots] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [prods, meds, movs, medMovs] = await Promise.all([
        fetchProducts(),
        fetchMedications(),
        fetchMovements({ since: startOfTodayISO() }),
        fetchMovements({ itemType: 'medication', limit: 5 }),
      ]);
      setProducts(prods);
      setMeds(meds);
      setTodayMovements(movs);
      setMedMovements(medMovs);

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
  const medNameBy = new Map(meds.map((m) => [m.id, m.name]));
  const medEntradaHoy = todayMovements.filter((m) => m.item_type === 'medication' && m.kind === 'entrada').reduce((acc, m) => acc + m.qty, 0);
  const medSalidaHoy = todayMovements.filter((m) => m.item_type === 'medication' && m.kind === 'salida').reduce((acc, m) => acc + m.qty, 0);

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

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3">{t('dashboard.medMov')}</h2>
          <Link to="/medicamentos?vista=movimientos" className="text-caption font-semibold text-primary-700">
            {t('dashboard.verTodo')}
          </Link>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
            <span className="flex items-center gap-1.5 text-caption text-muted">
              <ArrowDownRight size={14} aria-hidden="true" /> {t('dashboard.medMov.entradasHoy')}
            </span>
            <p className="text-numeric-lg text-success-700">{formatNumber(medEntradaHoy)}</p>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
            <span className="flex items-center gap-1.5 text-caption text-muted">
              <ArrowUpRight size={14} aria-hidden="true" /> {t('dashboard.medMov.salidasHoy')}
            </span>
            <p className="text-numeric-lg text-secondary-700">{formatNumber(medSalidaHoy)}</p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="min-h-[60px] rounded-lg" />
        ) : medMovements.length === 0 ? (
          <p className="text-body text-muted">{t('dashboard.medMov.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {medMovements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.kind === 'entrada' ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'}`}>
                  {m.kind === 'entrada' ? <ArrowDownRight size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
                </span>
                <Pill size={16} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{medNameBy.get(m.item_id) ?? '?'}</span>
                <span className={`text-numeric ${m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'}`}>
                  {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}
                </span>
                <span className="text-caption text-muted">{formatTime(m.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
