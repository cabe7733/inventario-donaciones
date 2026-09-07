import { useEffect, useState } from 'react';
import { registerMedicalSupplyExit, type MedicalSupply } from '../../lib/medicalSupplyOps';
import { warehouseStock } from '../../lib/warehouseOps';
import { formatNumber, todayKey } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { QuickPartySelect } from '../../components/ui/QuickPartySelect';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { useToast } from '../../components/ui/Toast';

export function MedicalSupplyExitModal({ supply, open, onClose }: { supply: MedicalSupply | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [fecha, setFecha] = useState(todayKey());
  const [stock, setStock] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(''); setRecipientId(null); setQty(''); setFecha(todayKey()); setStock(0);
  }, [open, supply]);

  useEffect(() => {
    if (!warehouseId || !supply) { setStock(0); return; }
    let cancelled = false;
    void warehouseStock(warehouseId, 'medical_supply', supply.id).then((value) => { if (!cancelled) setStock(value); }).catch(() => { if (!cancelled) setStock(0); });
    return () => { cancelled = true; };
  }, [warehouseId, supply]);

  const save = async () => {
    const quantity = Number(qty);
    if (!supply || !warehouseId || !recipientId || !Number.isFinite(quantity) || quantity <= 0 || quantity > stock) {
      toast.push({ message: `Completa bodega, beneficiario y cantidad válida (stock: ${formatNumber(stock)})`, tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await registerMedicalSupplyExit({ supplyId: supply.id, qty: quantity, warehouseId, recipientId, fecha: `${fecha}T12:00:00` });
      toast.push({ message: `Salida registrada: ${supply.name}`, tone: 'success' });
      onClose();
    } catch (e) {
      toast.push({ message: e instanceof Error ? e.message : 'Error al registrar salida', tone: 'error' });
    } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title={`Salida de ${supply?.name ?? 'insumo'}`}>
    <div className="flex flex-col gap-4">
      <WarehouseSelect value={warehouseId} onChange={setWarehouseId} required />
      <p className="text-caption text-muted">Stock disponible en la bodega: <strong>{formatNumber(stock)}</strong></p>
      <QuickPartySelect kind="recipient" value={recipientId} onChange={setRecipientId} required label="Beneficiario" />
      <div className="grid grid-cols-2 gap-3"><Field id="supply-exit-qty" label="Cantidad" required><input id="supply-exit-qty" type="number" min="0.01" step="any" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} /></Field><Field id="supply-exit-date" label="Fecha"><input id="supply-exit-date" type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field></div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : 'Registrar salida'}</Button></div>
    </div>
  </Modal>;
}
