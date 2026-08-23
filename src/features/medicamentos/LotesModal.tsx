import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Package, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { fetchLots, deleteLot, type Medication, type MedicationLot } from '../../lib/db';
import { addLot, lotExpired, lotExpiresSoon } from '../../lib/medicationOps';
import { todayKey } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Stepper } from '../../components/ui/Stepper';
import { useToast } from '../../components/ui/Toast';

interface Props {
  medication: Medication | null;
  open: boolean;
  onClose: () => void;
}

export function LotesModal({ medication, open, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [lots, setLots] = useState<MedicationLot[]>([]);
  const [lote, setLote] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [stockIn, setStockIn] = useState(1);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (!medication) return;
    setLots(await fetchLots(medication.id));
  };

  useEffect(() => {
    if (open) {
      setLote('');
      setVencimiento('');
      setStockIn(1);
      setError(undefined);
      void reload();
    }
  }, [open, medication]);

  const saveLot = async () => {
    if (!medication) return;
    if (!lote.trim()) { setError(t('common.required')); return; }
    setSaving(true);
    try {
      await addLot({ medicationId: medication.id, lote: lote.trim(), fechaVencimiento: vencimiento || null, stockIn, fecha: new Date().toISOString() });
      toast.push({ message: t('medicamentos.lote.created'), tone: 'success' });
      setLote('');
      setVencimiento('');
      setStockIn(1);
      setError(undefined);
      void reload();
    } catch {
      toast.push({ message: t('common.error'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeLot = async (lot: MedicationLot) => {
    await deleteLot(lot.id);
    void reload();
  };

  const today = todayKey();

  return (
    <Modal open={open} onClose={onClose} title={t('medicamentos.lote.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3">
          <h3 className="text-label text-fg">{t('medicamentos.lote.add')}</h3>
          <Field id="lt-lote" label={t('medicamentos.lote.code')} required error={error}>
            <input id="lt-lote" className={inputWithError(error)} value={lote} onChange={(e) => setLote(e.target.value)} placeholder={t('medicamentos.lote.code.placeholder')} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field id="lt-vto" label={t('medicamentos.lote.vto')}>
              <input id="lt-vto" type="date" min={today} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </Field>
            <Field id="lt-stock" label={t('medicamentos.lote.stockInitial')}>
              <Stepper value={stockIn} onChange={setStockIn} min={0} />
            </Field>
          </div>
          <Button onClick={() => void saveLot()} disabled={saving} size="sm">
            <Plus size={16} aria-hidden="true" />
            {t('medicamentos.lote.save')}
          </Button>
        </div>

        <ul className="flex flex-col gap-2">
          {lots.map((l) => {
            const expired = lotExpired(l);
            const soon = lotExpiresSoon(l);
            return (
              <li key={l.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium">{l.lote}</span>
                  <span className="text-caption text-muted">
                    {l.fecha_vencimiento ? t('medicamentos.vto', { fecha: l.fecha_vencimiento }) : t('medicamentos.sinVto')}
                  </span>
                </span>
                {(expired || soon) && (
                  <span className="text-caption font-semibold">
                    {expired ? (
                      <span className="flex items-center gap-1 text-danger-700">
                        <WarningCircle size={14} aria-hidden="true" /> {t('medicamentos.vto.expired')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-warning-700">
                        <Clock size={14} aria-hidden="true" /> {t('medicamentos.vto.soon')}
                      </span>
                    )}
                  </span>
                )}
                <span className="text-numeric">{l.stock}</span>
                <button
                  type="button"
                  aria-label={`${t('common.delete')} ${l.lote}`}
                  onClick={() => void removeLot(l)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
                >
                  <Trash size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {lots.length === 0 && (
            <li className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-caption text-muted">
              <Package size={16} aria-hidden="true" />
              {t('medicamentos.lote.empty')}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
