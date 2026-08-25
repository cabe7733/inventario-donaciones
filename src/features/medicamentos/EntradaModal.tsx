import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerMedicationEntrada, lotsFor } from '../../lib/medicationOps';
import { StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import type { Medication } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { useToast } from '../../components/ui/Toast';

interface Props {
  medication: Medication | null;
  open: boolean;
  onClose: () => void;
}

export function EntradaModal({ medication, open, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const [lots, setLots] = useState<Awaited<ReturnType<typeof lotsFor>>>([]);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [error, setError] = useState<string>();
  const [qtyError, setQtyError] = useState<string>();
  const [fecha, setFecha] = useState(todayKey());
  const [warehouseId, setWarehouseId] = useState('');
  const [donorId, setDonorId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && medication) {
      setLoteId(null);
      setQty('');
      setError(undefined);
      setQtyError(undefined);
      setFecha(todayKey());
      setWarehouseId('');
      setDonorId(null);
      setDonorName(null);
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
    if (!centerId) { toast.push({ message: 'No hay centro activo', tone: 'error' }); return; }
    if (!warehouseId) { toast.push({ message: 'Selecciona una bodega', tone: 'error' }); return; }
    const qtyNum = Number.parseInt(qty, 10);
    if (!(qtyNum >= 1)) { setQtyError(t('movimientos.error.qty')); return; }
    setSaving(true);
    try {
      await registerMedicationEntrada({
        medicationId: medication.id,
        loteId,
        qty: qtyNum,
        fecha: `${fecha}T12:00:00`,
        centerId,
        warehouseId,
        donorId,
        donorName,
      });
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
        <QuickPartySelect kind="donor" value={donorId} onChange={(id) => {
          setDonorId(id);
          // Resolve name from parties list
          if (id) {
            import('../../lib/donorOps').then(({ fetchParties }) =>
              fetchParties('donor').then((ps) => {
                const p = ps.find((x) => x.id === id);
                setDonorName(p?.full_name ?? null);
              })
            );
          } else {
            setDonorName(null);
          }
        }} />
        <AutocompleteOrCreate id="en-lote" label={t('medicamentos.lote.select')} required value={loteId} onChange={setLoteId} items={lotItems} error={error} hint={lotItems.length === 0 ? t('medicamentos.entrada.noLotes') : undefined} />
        <Field id="en-qty" label={t('medicamentos.cantidad')} error={qtyError}>
          <input id="en-qty" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" className={inputClass} placeholder="Cantidad" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => { if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} />
        </Field>
        <Field id="en-fecha" label={t('movimientos.fecha')}>
          <input id="en-fecha" type="date" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <WarehouseSelect value={warehouseId} onChange={setWarehouseId} required />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving}>{t('medicamentos.entrada.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
