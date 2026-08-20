import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HandHeart, Package, Cube } from '@phosphor-icons/react';
import { db } from '../../db';
import { formatNumber, formatDate, formatTime } from '../../lib/format';
import type { Kit } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { KitActionModal } from './KitActionModal';

export function KitDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const kit = useLiveQuery(() => (id ? db.kits.get(id) : undefined), [id]);
  const kitComps = useLiveQuery(() => (id ? db.kitComponents.where('kitId').equals(id).toArray() : []), [id]);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const units = useLiveQuery(() => db.units.toArray(), []);
  const builds = useLiveQuery(() => (id ? db.kitBuilds.where('kitId').equals(id).toArray() : []), [id]);
  const deliveries = useLiveQuery(
    () => (id ? db.kitDeliveries.where('kitId').equals(id).toArray() : []),
    [id],
  );

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const unitBy = useMemo(() => new Map((units ?? []).map((u) => [u.id, u.abbreviation])), [units]);

  const [action, setAction] = useState<{ mode: 'build' | 'deliver'; kit: Kit } | null>(null);

  const history = useMemo(() => {
    const events: Array<{
      key: string;
      kind: 'build' | 'deliver';
      qty: number;
      fecha: string;
    }> = [];
    for (const b of builds ?? []) events.push({ key: b.id, kind: 'build', qty: b.qty, fecha: b.fecha });
    for (const d of deliveries ?? []) events.push({ key: d.id, kind: 'deliver', qty: d.qty, fecha: d.fecha });
    return events.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [builds, deliveries]);

  if (!kit) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link to="/kits" className="text-caption text-muted hover:text-primary-700">
        ← {t('kits.list.title')}
      </Link>

      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{kit.name}</h1>
        <span className="text-numeric-xl text-primary-700">
          {formatNumber(kit.totalStock)}
          <span className="ml-1 text-body text-muted">{unitBy.get(kit.unitId) ?? ''}</span>
        </span>
      </header>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setAction({ mode: 'build', kit })}>
          <Package size={18} aria-hidden="true" />
          {t('kits.ensamblar')}
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => setAction({ mode: 'deliver', kit })}>
          <HandHeart size={18} aria-hidden="true" />
          {t('kits.entregar')}
        </Button>
      </div>

      <section>
        <h2 className="text-h3 mb-2">{t('kits.components')}</h2>
        <ul className="flex flex-col gap-2">
          {(kitComps ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <span className="text-body font-medium">{productMap.get(c.productId)?.name ?? '?'}</span>
              <span className="text-numeric text-muted">
                {formatNumber(c.qty)}
                <span className="ml-1 text-caption">{unitBy.get(c.unitId) ?? ''}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-h3 mb-2">{t('kits.history')}</h2>
        {history.length === 0 ? (
          <p className="text-body text-muted">{t('kits.history.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((e) => (
              <li
                key={e.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    e.kind === 'build'
                      ? 'bg-success-500/15 text-success-700'
                      : 'bg-secondary-500/15 text-secondary-700'
                  }`}
                >
                  {e.kind === 'build' ? (
                    <Cube size={16} aria-hidden="true" />
                  ) : (
                    <HandHeart size={16} aria-hidden="true" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-body-sm font-medium">
                    {e.kind === 'build' ? t('kits.builtLabel') : t('kits.deliveredLabel')}
                  </p>
                  <p className="text-caption text-muted">
                    {formatDate(e.fecha)} · {formatTime(e.fecha)}
                  </p>
                </div>
                <span
                  className={`text-numeric ${e.kind === 'build' ? 'text-success-700' : 'text-secondary-700'}`}
                >
                  {e.kind === 'build' ? '+' : '−'}
                  {formatNumber(e.qty)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <KitActionModal
        mode={action?.mode ?? 'build'}
        kit={action?.kit ?? null}
        open={action !== null}
        onClose={() => setAction(null)}
        components={action ? (kitComps ?? []).map((c) => ({ productId: c.productId, qty: c.qty })) : []}
        productMap={productMap}
      />
    </div>
  );
}