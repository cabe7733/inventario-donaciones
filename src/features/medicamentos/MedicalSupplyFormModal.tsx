import { useEffect, useState } from 'react';
import { createMedicalSupply, updateMedicalSupply, type MedicalSupply } from '../../lib/medicalSupplyOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import type { Unit } from '../../lib/db';

export function MedicalSupplyFormModal({ open, supply, units, onClose }: { open: boolean; supply: MedicalSupply | null; units: Unit[]; onClose: () => void }) {
  const { centerId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitId, setUnitId] = useState('');
  const [minStock, setMinStock] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(supply?.name ?? ''); setCategory(supply?.category ?? ''); setUnitId(supply?.unit_id ?? ''); setMinStock(supply?.min_stock == null ? '' : String(supply.min_stock));
  }, [open, supply]);

  const save = async () => {
    if (!name.trim() || !centerId) { toast.push({ message: !centerId ? 'No hay centro activo' : 'El nombre es obligatorio', tone: 'error' }); return; }
    setSaving(true);
    try {
      const input = { name: name.trim(), category: category.trim(), unit_id: unitId || null, min_stock: minStock ? Number(minStock) : null };
      if (supply) await updateMedicalSupply(supply.id, input);
      else await createMedicalSupply({ ...input, center_id: centerId });
      toast.push({ message: supply ? 'Insumo actualizado' : 'Insumo creado', tone: 'success' }); onClose();
    } catch (e) { toast.push({ message: e instanceof Error ? e.message : 'Error al guardar', tone: 'error' }); } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title={supply ? 'Editar insumo médico' : 'Nuevo insumo médico'}><div className="flex flex-col gap-4"><Field id="supply-name" label="Nombre del insumo" required><input id="supply-name" className={inputWithError(undefined)} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alcohol, gasa, algodón..." autoFocus /></Field><Field id="supply-category" label="Categoría"><input id="supply-category" className={inputWithError(undefined)} value={category} onChange={(e) => setCategory(e.target.value)} /></Field><Field id="supply-unit" label="Unidad"><select id="supply-unit" className={inputWithError(undefined)} value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">Seleccionar...</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></Field><Field id="supply-min" label="Stock mínimo"><input id="supply-min" type="number" min="0" className={inputWithError(undefined)} value={minStock} onChange={(e) => setMinStock(e.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button></div></div></Modal>;
}
