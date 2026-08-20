import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerMedicationEntrada, lotsFor } from '../../lib/medicationOps';
import { StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import type { Medication } from '../../db/types';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Stepper } from '../../components/ui/Stepper';
import { useToast } from '../../components/ui/Toast';

interface Props {
  medication: Medication | null;
  open: boolean;
  onClose: () => void;
}

export function EntradaModal({ medication, open, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const lots = useLiveQuery(() => (medication ? lotsFor(medication.id) : []), [medication]);

  const [loteId, setLoteId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string>();
  const [fecha, setFecha] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoteId(null);
      setQty(1);
      setError(undefined);
      setFecha(todayKey());
    }
  }, [open]);

  const lotItems = useMemo<AocItem[]>(
    () =>
      (lots ?? [])
        .filter((l) => l._deleted === 0)
        .map((l) => ({
          id: l.id,
          label: l.lote,
          sublabel: l.fechaVencimiento ? t('medicamentos.vto', { fecha: l.fechaVencimiento }) : undefined,
        })),
    [lots, t],
  );

  const save = async () => {
    if (!medication) return;
    if (!loteId) {
      setError(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      await registerMedicationEntrada({
        medicationId: medication.id,
        loteId,
        qty,
        fecha: `${fecha}T12:00:00`,
      });
      toast.push({
        message: t('medicamentos.entradaOk', { qty: String(qty), name: medication.name }),
        tone: 'success',
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
    <Modal open={open} onClose={onClose} title={t('medicamentos.entrada')}>
      <div className="flex flex-col gap-4">
        <AutocompleteOrCreate
          id="en-lote"
          label={t('medicamentos.lote.select')}
          required
          value={loteId}
          onChange={setLoteId}
          items={lotItems}
          error={error}
          hint={
            lotItems.length === 0
              ? t('medicamentos.entrada.noLotes')
              : undefined
          }
        />
        <Field id="en-qty" label={t('medicamentos.cantidad')}>
          <Stepper value={qty} onChange={setQty} />
        </Field>
        <Field id="en-fecha" label={t('movimientos.fecha')}>
          <input
            id="en-fecha"
            type="date"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {t('medicamentos.entrada.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}