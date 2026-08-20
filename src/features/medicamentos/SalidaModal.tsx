import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fefoPlan, salidaFefo } from '../../lib/medicationOps';
import { StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import type { Medication } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Stepper } from '../../components/ui/Stepper';
import { useToast } from '../../components/ui/Toast';

interface FeFoSeg {
  lote: string;
  vencimiento: string | null;
  qty: number;
}

interface Props {
  medication: Medication | null;
  open: boolean;
  onClose: () => void;
}

export function SalidaModal({ medication, open, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [qty, setQty] = useState(1);
  const [fecha, setFecha] = useState(todayKey());
  const [plan, setPlan] = useState<FeFoSeg[]>([]);
  const [insufficient, setInsufficient] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !medication) return;
    setQty(1);
    setFecha(todayKey());
    void updatePlan(1);
  }, [open, medication]);

  const updatePlan = async (q: number) => {
    if (!medication) return;
    const segments = await fefoPlan(medication.id, q);
    let total = 0;
    for (const s of segments) total += s.qty;
    setPlan(segments.map((s) => ({ lote: s.lote, vencimiento: s.vencimiento, qty: s.qty })));
    setInsufficient(Math.round(total) < Math.round(q));
  };

  const changeQty = (q: number) => {
    setQty(q);
    void updatePlan(q);
  };

  const save = async () => {
    if (!medication || insufficient) return;
    setSaving(true);
    try {
      const consumed = await salidaFefo({
        medicationId: medication.id,
        qty,
        fecha: `${fecha}T12:00:00`,
      });
      const names = consumed.map((c) => `${c.lote} (${c.qty})`).join(', ');
      toast.push({
        message: t('medicamentos.salidaOk', { qty: String(qty), name: medication.name, lotes: names }),
        tone: 'neutral',
      });
      onClose();
    } catch (e) {
      if (e instanceof StockError) toast.push({ message: e.message, tone: 'error' });
      else toast.push({ message: t('common.error'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('medicamentos.salida')}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted">{t('medicamentos.salida.hint')}</p>

        <Field id="sa-qty" label={t('medicamentos.cantidad')}>
          <Stepper value={qty} onChange={changeQty} />
        </Field>
        <Field id="sa-fecha" label={t('movimientos.fecha')}>
          <input
            id="sa-fecha"
            type="date"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>

        {plan.length > 0 && (
          <div className="rounded-lg bg-primary-50 p-3">
            <p className="text-label mb-1 text-primary-700">{t('medicamentos.fefo.plan')}</p>
            <ul className="flex flex-col gap-1">
              {plan.map((s, i) => (
                <li key={i} className="flex justify-between text-body-sm text-primary-700">
                  <span>
                    {s.lote}
                    {s.vencimiento && ` — ${t('medicamentos.vtoShort', { fecha: s.vencimiento })}`}
                  </span>
                  <span className="font-semibold">−{s.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {insufficient && (
          <p className="text-caption text-danger-700" role="alert">
            {t('medicamentos.fefo.insufficient')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => void save()} disabled={saving || insufficient}>
            {t('medicamentos.salida.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}