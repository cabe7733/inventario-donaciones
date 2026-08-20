import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Stack, Triangle, Package, Warning } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { formatNumber, startOfTodayISO } from '../../lib/format';
import { MovementsWidget } from '../movimientos/MovementsWidget';

const TONES = ['bg-primary-600', 'bg-secondary-600', 'bg-warning-700', 'bg-info-700'];

export function DashboardPage() {
  const { t } = useTranslation();

  const products = useLiveQuery(() => db.products.where('_deleted').equals(0).toArray(), []);
  const todayMovements = useLiveQuery(
    () => db.movements.where('fecha').aboveOrEqual(startOfTodayISO()).toArray(),
    [],
  );

  const entradaHoy = todayMovements
    ?.filter((m) => m.kind === 'entrada')
    .reduce((acc, m) => acc + m.qty, 0);
  const salidaHoy = todayMovements
    ?.filter((m) => m.kind === 'salida')
    .reduce((acc, m) => acc + m.qty, 0);
  const lowStock = (products ?? []).filter(
    (p) => p.isActive === 1 && p.minStock != null && p.totalStock <= p.minStock,
  );

  const kpis = [
    { label: t('dashboard.kpis.entradasHoy'), value: entradaHoy, icon: ArrowDownRight },
    { label: t('dashboard.kpis.salidasHoy'), value: salidaHoy, icon: ArrowUpRight },
    { label: t('dashboard.kpis.alertas'), value: lowStock.length, icon: Warning },
    { label: t('dashboard.kpis.productos'), value: products?.length, icon: Stack },
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
              <p className="text-numeric-lg">{value == null ? '…' : formatNumber(value)}</p>
              <p className="text-caption text-muted">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[
          { to: '/movimiento?tipo=entrada', icon: ArrowDownRight, key: 'dashboard.quick.entrada', tone: TONES[0] },
          { to: '/movimiento?tipo=salida', icon: ArrowUpRight, key: 'dashboard.quick.salida', tone: TONES[1] },
        ].map(({ to, icon: Icon, key, tone }) => (
          <Link
            key={key}
            to={to}
            className={`${tone} flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg p-4 text-inverse shadow-elev-2 transition-transform active:scale-95`}
          >
            <Icon size={28} aria-hidden="true" />
            <span className="text-caption font-semibold">{t(key)}</span>
          </Link>
        ))}
      </section>

      <MovementsWidget />

      <section>
        <h2 className="text-h3 mb-3">{t('dashboard.alerts')}</h2>
        {lowStock.length === 0 ? (
          <p className="text-body text-muted">{t('dashboard.alerts.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lowStock.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 p-3"
              >
                <Triangle size={16} className="text-warning-700" aria-hidden="true" />
                <span className="flex-1 text-body-sm font-medium">{p.name}</span>
                <span className="text-numeric text-warning-700">{formatNumber(p.totalStock)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <span className="text-caption text-muted flex items-center gap-1">
        <Package size={16} aria-hidden="true" /> Donario — offline-first
      </span>
    </div>
  );
}