import { useEffect, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageContainer } from '../../components/layout/PageContainer';
import { fetchCenterMembers, fetchInventoryAuthorizers, fetchMedicationAuthorizers, saveInventoryAuthorizer, saveMedicationAuthorizer, deactivateInventoryAuthorizer, deactivateMedicationAuthorizer, type ExitAuthorizer, type MedicationExitAuthorizer } from '../../lib/medicalPrescriptionOps';

export function AutorizadoresPage() {
  const toast = useToast();
  const [inventory, setInventory] = useState<ExitAuthorizer[]>([]);
  const [medication, setMedication] = useState<MedicationExitAuthorizer[]>([]);
  const [members, setMembers] = useState<Array<{ user_id: string; full_name: string; email: string | null }>>([]);
  const [open, setOpen] = useState<'inventory' | 'medication' | null>(null);
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');

  const reload = async () => {
    const [i, m, people] = await Promise.all([fetchInventoryAuthorizers(), fetchMedicationAuthorizers(), fetchCenterMembers()]);
    setInventory(i); setMedication(m); setMembers(people);
    setMedication(m.map((a) => ({ ...a, profile: people.find((p) => p.user_id === a.user_id) ? { full_name: people.find((p) => p.user_id === a.user_id)!.full_name, email: people.find((p) => p.user_id === a.user_id)!.email } : null })));
  };
  useEffect(() => { void reload(); }, []);

  const save = async () => {
    try {
      if (open === 'inventory') {
        if (!name.trim()) throw new Error('El nombre es obligatorio');
        await saveInventoryAuthorizer({ name: name.trim(), document_number: documentNumber.trim() || null, role: role.trim() });
      } else if (open === 'medication') {
        if (!userId) throw new Error('Selecciona un usuario');
        await saveMedicationAuthorizer(userId);
      }
      setOpen(null); setName(''); setDocumentNumber(''); setRole(''); setUserId(''); await reload();
      toast.push({ message: 'Autorizador guardado', tone: 'success' });
    } catch (e) { toast.push({ message: e instanceof Error ? e.message : 'No se pudo guardar', tone: 'error' }); }
  };

  return <PageContainer className="flex flex-col gap-6">
    <header><h1 className="text-h2">Autorizadores de salida</h1><p className="text-body-sm text-muted">Administra por separado las autorizaciones de inventario y medicamentos.</p></header>
    <section className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-h3">Salidas de inventario</h2><p className="text-caption text-muted">No requieren cuenta de usuario. Máximo 3 activos.</p></div><Button size="sm" onClick={() => setOpen('inventory')} disabled={inventory.length >= 3}><Plus size={16} /> Nuevo</Button></div><ul className="flex flex-col gap-2">{inventory.map((a) => <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="flex-1"><b>{a.name}</b><span className="ml-2 text-caption text-muted">{a.role || a.document_number || ''}</span></span><Button size="sm" variant="ghost" aria-label={`Desactivar ${a.name}`} onClick={() => void deactivateInventoryAuthorizer(a.id).then(reload)}><Trash size={16} /></Button></li>)}</ul></section>
    <section className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-h3">Salidas de medicamentos</h2><p className="text-caption text-muted">Requieren una cuenta autenticada del centro. Máximo 3 activos.</p></div><Button size="sm" onClick={() => setOpen('medication')} disabled={medication.length >= 3}><Plus size={16} /> Asignar</Button></div><ul className="flex flex-col gap-2">{medication.map((a) => <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="flex-1"><b>{a.profile?.full_name || a.user_id}</b><span className="ml-2 text-caption text-muted">{a.profile?.email || ''}</span></span><Button size="sm" variant="ghost" aria-label="Desactivar autorizador" onClick={() => void deactivateMedicationAuthorizer(a.id).then(reload)}><Trash size={16} /></Button></li>)}</ul></section>
    <Modal open={open !== null} onClose={() => setOpen(null)} title={open === 'inventory' ? 'Nuevo autorizador de inventario' : 'Asignar autorizador de medicamentos'}>
      <div className="flex flex-col gap-4">{open === 'inventory' ? <><Field id="auth-name" label="Nombre" required><input id="auth-name" className={inputWithError(undefined)} value={name} onChange={(e) => setName(e.target.value)} /></Field><Field id="auth-doc" label="Documento"><input id="auth-doc" className={inputWithError(undefined)} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} /></Field><Field id="auth-role" label="Cargo"><input id="auth-role" className={inputWithError(undefined)} value={role} onChange={(e) => setRole(e.target.value)} /></Field></> : <Field id="auth-user" label="Usuario autenticado" required><select id="auth-user" className={inputWithError(undefined)} value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Seleccionar...</option>{members.filter((m) => !medication.some((a) => a.user_id === m.user_id)).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}</select></Field>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(null)}>Cancelar</Button><Button onClick={() => void save()}>Guardar</Button></div></div>
    </Modal>
  </PageContainer>;
}
