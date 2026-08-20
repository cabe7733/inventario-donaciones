import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildKit, deliverKit } from '../../lib/kitOps';
import { StockError } from '../../lib/movements';
import { formatNumber } from '../../lib/format';
import type { Kit, Product } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Stepper } from '../../components/ui/Stepper';
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
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setQty(1);
  }, [open]);

  const isBuild = mode === 'build';

  const componentSummary = useMemo(() => {
    if (!isBuild || components.length === 0) return null;
    const lines = components.map((c) => {
      const p = productMap.get(c.productId);
      const total = c.qty * qty;
      return `${p?.name ?? '?'}: ${total}`;
    });
    return lines.join(' · ');
  }, [isBuild, components, qty, productMap]);

  const max = isBuild ? undefined : kit?.totalStock ?? 0;

  const run = async () => {
    if (!kit || busy) return;
    setBusy(true);
    try {
      if (isBuild) {
        await buildKit(kit.id, qty);
        toast.push({ message: t('kits.built', { qty: String(qty), name: kit.name }), tone: 'success' });
      } else {
        await deliverKit(kit.id, qty);
        toast.push({ message: t('kits.delivered', { qty: String(qty), name: kit.name }), tone: 'neutral' });
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

        <Field label={t('kits.cantidad')}>
          <Stepper value={qty} onChange={setQty} max={max} />
        </Field>

        {componentSummary && (
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-caption text-primary-700">
            {t('kits.action.consumes')}: {componentSummary}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={isBuild ? 'primary' : 'danger'} onClick={() => void run()} disabled={busy}>
            {isBuild ? t('kits.ensamblar') : t('kits.entregar')}
          </Button>
        </div>
        {!isBuild && kit && (
          <p className="text-caption text-muted">
            {t('kits.stockActual', { stock: formatNumber(kit.totalStock) })}
          </p>
        )}
      </div>
    </Modal>
  );
}