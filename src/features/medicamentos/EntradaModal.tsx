import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerMedicationEntrada, lotsFor } from '../../lib/medicationOps';
import { StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import type { Medication } from '../../lib/db';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface Props {
  medication: Medication | null;
  open: boolean;
  onClose: () => void;
}

export function EntradaModal({ medication, open, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [lots, setLots] = useState<Awaited<ReturnType<typeof lotsFor>>>([]);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string>();
  const [qtyError, setQtyError] = useState<string>();
  const [fecha, setFecha] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && medication) {
      setLoteId(null);
      setQty('1');
      setError(undefined);
      setQtyError(undefined);
      setFecha(todayKey());
      void lotsFor(medication.id).then(setLots);
    }
  }, [open, medication]);

  const lotItems = useMemo<AocItem[]>(
    () => lots.map((l) => ({
      id: l.id,
      label: l.lote,
      sublabel: l.fecha_vencimiento ? t('medicamentos.vto', { fecha: l.fecha_vencimiento }) : undefined,
    })),
    [lots, t],
  );

  const save = async () => {
    if (!medication) return;
    setError(undefined);
    setQtyError(undefined);
    if (!loteId) { setError(t('common.required')); return; }
    const qtyNum = Number.parseInt(qty, 10);
    if (!(qtyNum >= 1)) { setQtyError(t('movimientos.error.qty')); return; }
    setSaving(true);
    try {
      await registerMedicationEntrada({ medicationId: medication.id, loteId, qty: qtyNum, fecha: `${fecha}T12:00:00` });
      toast.push({ message: t('medicamentos.entradaOk', { qty: String(qtyNum), name: medication.name }), tone: 'success' });
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
        <AutocompleteOrCreate id="en-lote" label={t('medicamentos.lote.select')} required value={loteId} onChange={setLoteId} items={lotItems} error={error} hint={lotItems.length === 0 ? t('medicamentos.entrada.noLotes') : undefined} />
        <Field id="en-qty" label={t('medicamentos.cantidad')} error={qtyError}>
          <input id="en-qty" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => { if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} />
        </Field>
        <Field id="en-fecha" label={t('movimientos.fecha')}>
          <input id="en-fecha" type="date" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving}>{t('medicamentos.entrada.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
