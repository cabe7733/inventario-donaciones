import { useEffect, useState } from 'react';
import { registerMedicalSupplyEntry, type MedicalSupply } from '../../lib/medicalSupplyOps';
import { todayKey } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { useToast } from '../../components/ui/Toast';

export function MedicalSupplyEntryModal({ supply, open, onClose }: { supply: MedicalSupply | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [lote, setLote] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('');
  const [fecha, setFecha] = useState(todayKey());
  const [warehouseId, setWarehouseId] = useState('');
  const [donorId, setDonorId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setLote(''); setExpiry(''); setQty(''); setFecha(todayKey()); setWarehouseId(''); setDonorId(null); setDonorName(null); } }, [open, supply]);

  const save = async () => {
    const quantity = Number(qty);
    if (!supply || !warehouseId || !Number.isFinite(quantity) || quantity <= 0) { toast.push({ message: 'Completa bodega y cantidad válida', tone: 'error' }); return; }
    setSaving(true);
    try { await registerMedicalSupplyEntry({ supplyId: supply.id, lote, expiry: expiry || null, qty: quantity, warehouseId, fecha: `${fecha}T12:00:00`, nota: donorName ? `Donante: ${donorName}` : '' }); toast.push({ message: `Entrada registrada: ${supply.name}`, tone: 'success' }); onClose(); } catch (e) { toast.push({ message: e instanceof Error ? e.message : 'Error al registrar entrada', tone: 'error' }); } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title={`Entrada de ${supply?.name ?? 'insumo'}`}><div className="flex flex-col gap-4"><QuickPartySelect kind="donor" value={donorId} onChange={(id) => { setDonorId(id); if (id) void import('../../lib/donorOps').then(({ fetchParties }) => fetchParties('donor').then((parties) => setDonorName(parties.find((party) => party.id === id)?.full_name ?? null))); else setDonorName(null); }} /><Field id="supply-lot" label="Lote o código de fabricación"><input id="supply-lot" className={inputClass} value={lote} onChange={(e) => setLote(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field id="supply-expiry" label="Vencimiento"><input id="supply-expiry" type="date" className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field><Field id="supply-qty" label="Cantidad" required><input id="supply-qty" type="number" min="0.01" step="any" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} /></Field></div><Field id="supply-date" label="Fecha de entrada"><input id="supply-date" type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field><WarehouseSelect value={warehouseId} onChange={setWarehouseId} required /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : 'Registrar entrada'}</Button></div></div></Modal>;
}
