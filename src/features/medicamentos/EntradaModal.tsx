import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerMedicationEntrada, addLot, lotsFor } from '../../lib/medicationOps';
import { StockError } from '../../lib/movements';
import { todayKey } from '../../lib/format';
import { fetchParties } from '../../lib/donorOps';
import type { Medication } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { useToast } from '../../components/ui/Toast';

export function EntradaModal({ medication, open, onClose }: { medication: Medication | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();
  const [lote, setLote] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('');
  const [fecha, setFecha] = useState(todayKey());
  const [donorId, setDonorId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setLote(''); setExpiry(''); setQty(''); setFecha(todayKey()); setDonorId(null); setDonorName(null); } }, [open, medication]);

  const save = async () => {
    if (!medication || !centerId) { toast.push({ message: 'No hay centro activo', tone: 'error' }); return; }
    const quantity = Number(qty);
    if (!lote.trim() || !expiry || !Number.isFinite(quantity) || quantity <= 0) { toast.push({ message: 'Completa lote, vencimiento y cantidad', tone: 'error' }); return; }
    setSaving(true);
    try {
      const existing = (await lotsFor(medication.id)).find((lot) => lot.lote.toLowerCase() === lote.trim().toLowerCase());
      if (existing) {
        await registerMedicationEntrada({ medicationId: medication.id, loteId: existing.id, qty: quantity, fecha: `${fecha}T12:00:00`, centerId, donorId, donorName });
      } else {
        await addLot({ medicationId: medication.id, lote: lote.trim(), fechaVencimiento: expiry, stockIn: quantity, fecha: `${fecha}T12:00:00`, centerId, nota: donorName ? `Donante: ${donorName}` : undefined });
      }
      toast.push({ message: `Entrada registrada: ${medication.name}`, tone: 'success' }); onClose();
    } catch (e) { if (e instanceof StockError) toast.push({ message: e.message, tone: 'error' }); else toast.push({ message: e instanceof Error ? e.message : t('common.error'), tone: 'error' }); } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title={`Registrar entrada: ${medication?.name ?? 'medicamento'}`}><div className="flex flex-col gap-4"><QuickPartySelect kind="donor" value={donorId} onChange={(id) => { setDonorId(id); if (id) void fetchParties('donor').then((parties) => setDonorName(parties.find((party) => party.id === id)?.full_name ?? null)); else setDonorName(null); }} /><Field id="med-lot" label="Código de fabricación / lote" required><input id="med-lot" className={inputClass} value={lote} onChange={(e) => setLote(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field id="med-expiry" label="Fecha de vencimiento" required><input id="med-expiry" type="date" min={todayKey()} className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field><Field id="med-qty" label="Cantidad" required><input id="med-qty" type="number" min="1" step="any" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} /></Field></div><Field id="med-date" label="Fecha de entrada"><input id="med-date" type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field><p className="text-caption text-muted">Los medicamentos tienen stock global y no se asocian a una bodega.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : 'Registrar entrada'}</Button></div></div></Modal>;
}
