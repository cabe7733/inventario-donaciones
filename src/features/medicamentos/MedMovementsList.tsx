import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react';
import { fetchMovements, fetchMedications, fetchUnits, type Movement } from '../../lib/db';
import { formatNumber, formatTime, formatDateShort, toLocalDateKey, todayKey } from '../../lib/format';
import { SkeletonList } from '../../components/ui/Skeleton';

// Lista de movimientos de inventario solo de medicamentos.
// kind: filtra por entrada/salida; undefined muestra todos.
export function MedMovementsList({ kind }: { kind?: 'entrada' | 'salida' }) {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [nameBy, setNameBy] = useState<Map<string, string>>(new Map());
  const [unitBy, setUnitBy] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [movs, meds, units] = await Promise.all([
        fetchMovements({ itemType: 'medication', limit: 200 }),
        fetchMedications(),
        fetchUnits(),
      ]);
      setMovements(movs);
      setNameBy(new Map(meds.map((m) => [m.id, m.name])));
      setUnitBy(new Map(units.map((u) => [u.id, u.abbreviation])));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (kind ? movements.filter((m) => m.kind === kind) : movements),
    [movements, kind],
  );

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

  if (loading) return <SkeletonList />;
  if (filtered.length === 0) {
    return <p className="text-body text-muted">{t('medicamentos.mov.empty')}</p>;
  }

  return (
    <>
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
              {list.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.kind === 'entrada' ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'}`}
                  >
                    {m.kind === 'entrada' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium">{nameBy.get(m.item_id) ?? '?'}</p>
                    {m.nota && <p className="truncate text-caption text-muted">{m.nota}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-numeric font-semibold ${m.kind === 'entrada' ? 'text-success-700' : 'text-secondary-700'}`}>
                      {m.kind === 'entrada' ? '+' : '−'}{formatNumber(m.qty)}
                      <span className="ml-1 text-caption text-muted">{unitBy.get(m.unit_id) ?? ''}</span>
                    </p>
                    <p className="text-caption text-muted">{formatTime(m.fecha)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
