import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildKit, deliverKit, maxBuildable, maxBuildableInWarehouse } from '../../lib/kitOps';
import { warehouseStock } from '../../lib/warehouseOps';
import { StockError } from '../../lib/movements';
import { formatNumber } from '../../lib/format';
import type { Kit, Product } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { useToast } from '../../components/ui/Toast';

interface Props {
  mode: 'build' | 'deliver';
  kit: Kit | null;
  open: boolean;
  onClose: () => void;
  components: Array<{ productId: string; qty: number }>;
  productMap: Map<string, Product>;
}

export function KitActionModal({ mode, kit, open, onClose, components, productMap }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();
  const [qty, setQty] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [whStocks, setWhStocks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (open) {
      setQty('1');
      setWarehouseId('');
      setRecipientId(null);
      setWhStocks(new Map());
    }
  }, [open]);

  const isBuild = mode === 'build';
  const qtyNum = Number.parseInt(qty, 10);
  const validQty = Number.isFinite(qtyNum) && qtyNum >= 1;

  // Load warehouse stock when warehouse is selected
  useEffect(() => {
    if (!warehouseId || !isBuild || components.length === 0) { setWhStocks(new Map()); return; }
    let cancelled = false;
    (async () => {
      const entries: [string, number][] = [];
      for (const c of components) {
        const stock = await warehouseStock(warehouseId, 'product', c.productId);
        entries.push([c.productId, stock]);
      }
      if (!cancelled) setWhStocks(new Map(entries));
    })();
    return () => { cancelled = true; };
  }, [warehouseId, isBuild, components]);

  const componentSummary = useMemo(() => {
    if (!isBuild || components.length === 0) return null;
    const lines = components.map((c) => {
      const p = productMap.get(c.productId);
      const total = c.qty * (validQty ? qtyNum : 1);
      return `${p?.name ?? '?'}: ${total}`;
    });
    return lines.join(' · ');
  }, [isBuild, components, validQty, qtyNum, productMap]);

  // Max buildable from global stock (existing logic)
  const maxBuildGlobal = useMemo(() => {
    if (!isBuild) return 0;
    let max = Number.POSITIVE_INFINITY;
    for (const c of components) {
      const stock = productMap.get(c.productId)?.total_stock ?? 0;
      max = Math.min(max, maxBuildable(stock, c.qty));
    }
    return components.length === 0 ? 0 : max;
  }, [isBuild, components, productMap]);

  // Max buildable from warehouse stock
  const [maxBuildWarehouse, setMaxBuildWarehouse] = useState(0);
  useEffect(() => {
    if (!isBuild || !warehouseId || components.length === 0) { setMaxBuildWarehouse(0); return; }
    let cancelled = false;
    (async () => {
      const comps = components.map((c) => ({ product_id: c.productId, qty: c.qty }));
      const max = await maxBuildableInWarehouse(warehouseId, comps);
      if (!cancelled) setMaxBuildWarehouse(max);
    })();
    return () => { cancelled = true; };
  }, [isBuild, warehouseId, components]);

  const max = isBuild ? (warehouseId ? maxBuildWarehouse : maxBuildGlobal) : kit?.total_stock ?? 0;
  const blocked = !validQty || qtyNum > max || (isBuild && max < 1) || (!isBuild && !recipientId);

  const errorQty: string | undefined = !validQty
    ? t('movimientos.error.qty') as string | undefined
    : qtyNum > max
      ? t('kits.cantidad') as string | undefined
      : undefined;

  const run = async () => {
    if (!kit || busy || blocked) return;
    if (!centerId) { toast.push({ message: 'No hay centro activo', tone: 'error' }); return; }
    if (!warehouseId) { toast.push({ message: 'Selecciona una bodega', tone: 'error' }); return; }
    setBusy(true);
    try {
      if (isBuild) {
        await buildKit(kit.id, qtyNum, centerId, warehouseId);
        toast.push({ message: t('kits.built', { qty: String(qtyNum), name: kit.name }), tone: 'success' });
      } else {
        if (!recipientId) { toast.push({ message: t('kits.entregar.sinDestinatario'), tone: 'error' }); setBusy(false); return; }
        await deliverKit(kit.id, qtyNum, centerId, warehouseId, recipientId);
        toast.push({ message: t('kits.delivered', { qty: String(qtyNum), name: kit.name }), tone: 'neutral' });
      }
      onClose();
    } catch (e) {
      if (e instanceof StockError) toast.push({ message: e.message, tone: 'error' });
      else toast.push({ message: t('common.error'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBuild ? t('kits.ensamblar') : t('kits.entregar')}
    >
      <div className="flex flex-col gap-4">
        <p className="text-body">
          {isBuild
            ? t('kits.action.buildQuestion', { name: kit?.name })
            : t('kits.action.deliverQuestion', { name: kit?.name })}
        </p>

        <Field label={t('kits.cantidad')} error={errorQty}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            className={inputWithError(errorQty)}
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </Field>

        {!isBuild && (
          <QuickPartySelect
            kind="recipient"
            value={recipientId}
            onChange={setRecipientId}
            required
            label={t('kits.entregar.destinatario')}
          />
        )}

        <WarehouseSelect value={warehouseId} onChange={setWarehouseId} required />

        {componentSummary && (
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-caption text-primary-700">
            {t('kits.action.consumes')}: {componentSummary}
          </p>
        )}

        {isBuild && warehouseId && whStocks.size > 0 && (
          <div className="rounded-lg bg-surface p-3">
            <p className="text-label mb-1 text-fg">{t('kits.action.warehouseStock', { stock: '' }).replace(': ', '')}</p>
            <ul className="flex flex-col gap-1">
              {components.map((c) => {
                const p = productMap.get(c.productId);
                const wh = whStocks.get(c.productId) ?? 0;
                const need = c.qty * (validQty ? qtyNum : 1);
                const insufficient = wh < need;
                return (
                  <li key={c.productId} className={`flex justify-between text-body-sm ${insufficient ? 'text-danger-700 font-semibold' : 'text-primary-700'}`}>
                    <span>{p?.name ?? '?'}</span>
                    <span>{formatNumber(wh)} / {formatNumber(need)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isBuild &&
          (maxBuildGlobal < 1 ? (
            <p role="alert" className="rounded-lg bg-danger-500/10 px-3 py-2 text-caption font-semibold text-danger-700">
              {t('kits.action.noStock')}
            </p>
          ) : (
            <p role="alert" className="rounded-lg bg-warning-500/10 px-3 py-2 text-caption font-semibold text-warning-700">
              {warehouseId
                ? t('kits.action.maxBuildableWarehouse', { count: maxBuildWarehouse })
                : t('kits.action.maxBuildable', { count: maxBuildGlobal })}
            </p>
          ))}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={isBuild ? 'primary' : 'danger'} onClick={() => void run()} disabled={busy || blocked}>
            {isBuild ? t('kits.ensamblar') : t('kits.entregar')}
          </Button>
        </div>
        {!isBuild && kit && (
          <p className="text-caption text-muted">
            {t('kits.stockActual', { stock: formatNumber(kit.total_stock) })}
          </p>
        )}
      </div>
    </Modal>
  );
}
