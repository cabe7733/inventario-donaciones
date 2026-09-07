import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { fetchUnits, type Unit } from '../../lib/db';
import { fetchMedicalSupplies, fetchMedicalSupplyLots, medicalSupplyStock, deleteMedicalSupply, type MedicalSupply } from '../../lib/medicalSupplyOps';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { MedicalSupplyFormModal } from './MedicalSupplyFormModal';
import { MedicalSupplyEntryModal } from './MedicalSupplyEntryModal';
import { MedicalSupplyExitModal } from './MedicalSupplyExitModal';

export function MedicalSuppliesInventory() {
  const toast = useToast();
  const [supplies, setSupplies] = useState<MedicalSupply[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stocks, setStocks] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [formSupply, setFormSupply] = useState<MedicalSupply | null>(null);
  const [entrySupply, setEntrySupply] = useState<MedicalSupply | null>(null);
  const [exitSupply, setExitSupply] = useState<MedicalSupply | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = async () => {
    const [nextSupplies, nextUnits] = await Promise.all([fetchMedicalSupplies(), fetchUnits()]);
    const lots = await Promise.all(nextSupplies.map((supply) => fetchMedicalSupplyLots(supply.id)));
    setSupplies(nextSupplies); setUnits(nextUnits); setStocks(new Map(nextSupplies.map((supply, index) => [supply.id, medicalSupplyStock(lots[index])] ))); setLoading(false);
  };
  useEffect(() => { void reload().catch((e) => toast.push({ message: e instanceof Error ? e.message : 'Error al cargar insumos', tone: 'error' })); }, []);

  const visible = useMemo(() => supplies.filter((supply) => `${supply.name} ${supply.category}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [supplies, query]);
  const remove = async (supply: MedicalSupply) => { if (!window.confirm(`¿Eliminar ${supply.name}?`)) return; try { await deleteMedicalSupply(supply.id); await reload(); toast.push({ message: 'Insumo eliminado', tone: 'success' }); } catch (e) { toast.push({ message: e instanceof Error ? e.message : 'No se pudo eliminar', tone: 'error' }); } };

  return <PageContainer className="flex flex-col gap-5"><header className="flex items-center justify-between gap-3"><div><h1 className="text-h2">Insumos médicos</h1><p className="text-body-sm text-muted">Administra alcohol, gasas, algodón y otros insumos sin mezclarlos con productos generales.</p></div><Button onClick={() => { setFormSupply(null); setFormOpen(true); }}><Plus size={18} /> Nuevo insumo</Button></header><SearchInput value={query} onChange={setQuery} placeholder="Buscar insumo" aria-label="Buscar insumo" />{loading ? <p className="text-body-sm text-muted">Cargando...</p> : visible.length === 0 ? <EmptyState title="No hay insumos médicos" description="Crea el primer insumo médico del centro." action={<Button onClick={() => { setFormSupply(null); setFormOpen(true); }}><Plus size={18} /> Nuevo insumo</Button>} /> : <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{visible.map((supply) => { const stock = stocks.get(supply.id) ?? 0; const low = supply.min_stock != null && stock <= supply.min_stock; return <li key={supply.id} className="rounded-lg border border-border bg-card p-3"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-body font-semibold">{supply.name}</p><p className="text-caption text-muted">{supply.category || 'Sin categoría'}</p>{low && <p className="text-caption font-semibold text-warning-700">Stock bajo</p>}</div><span className="text-numeric-lg text-primary-700">{stock}<span className="ml-1 text-caption text-muted">{units.find((unit) => unit.id === supply.unit_id)?.abbreviation ?? ''}</span></span></div><div className="mt-3 flex items-center gap-2"><Button size="sm" variant="secondary" onClick={() => setEntrySupply(supply)}><ArrowDown size={16} /> Entrada</Button><Button size="sm" variant="secondary" onClick={() => setExitSupply(supply)}><ArrowDown size={16} /> Salida</Button><span className="flex-1" /><Button size="sm" variant="ghost" aria-label={`Editar ${supply.name}`} onClick={() => { setFormSupply(supply); setFormOpen(true); }}><PencilSimple size={17} /></Button><Button size="sm" variant="ghost" aria-label={`Eliminar ${supply.name}`} onClick={() => void remove(supply)}><Trash size={17} /></Button></div></li>; })}</ul>}<MedicalSupplyFormModal open={formOpen} onClose={() => { setFormOpen(false); void reload(); }} supply={formSupply} units={units} /><MedicalSupplyEntryModal supply={entrySupply} open={entrySupply !== null} onClose={() => { setEntrySupply(null); void reload(); }} /><MedicalSupplyExitModal supply={exitSupply} open={exitSupply !== null} onClose={() => { setExitSupply(null); void reload(); }} /></PageContainer>;
}
