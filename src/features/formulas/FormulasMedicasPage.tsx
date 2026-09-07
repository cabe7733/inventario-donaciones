import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Plus, Trash } from '@phosphor-icons/react';
import { fetchMedications, fetchLots, type Medication } from '../../lib/db';
import { stockFor } from '../../lib/medicationOps';
import {
  createPrescription,
  dispatchPrescription,
  fetchMedicationAuthorizers,
  fetchPrescriptions,
  type MedicalPrescription,
  type PrescriptionItemInput,
} from '../../lib/medicalPrescriptionOps';
import { formatNumber } from '../../lib/format';
import { useAuth } from '../../components/auth/AuthProvider';
import { PageContainer } from '../../components/layout/PageContainer';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

type DraftItem = PrescriptionItemInput & { key: string };

const emptyItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  item_type: 'medication',
  item_id: '',
  qty: 1,
  instructions: '',
  notes: '',
});

export function FormulasMedicasPage() {
  const { role, user } = useAuth();
  const toast = useToast();
  const [prescriptions, setPrescriptions] = useState<MedicalPrescription[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationStock, setMedicationStock] = useState<Map<string, number>>(new Map());
  const [authorizedUsers, setAuthorizedUsers] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientType, setPatientType] = useState<'person' | 'health_center'>('person');
  const [patient, setPatient] = useState({ firstName: '', lastName: '', document: '', birthDate: '', sex: '', phone: '' });
  const [healthCenter, setHealthCenter] = useState({ name: '', document: '', contact: '', phone: '', address: '' });
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  const reload = async () => {
    const [nextPrescriptions, nextMeds, authorizers] = await Promise.all([
      fetchPrescriptions(),
      fetchMedications(),
      fetchMedicationAuthorizers(),
    ]);
    const lots = await Promise.all(nextMeds.map((med) => fetchLots(med.id)));
    setPrescriptions(nextPrescriptions);
    setMedications(nextMeds);
    setMedicationStock(new Map(nextMeds.map((med, index) => [
      med.id,
      stockFor(lots[index].filter((lot) => !lot.fecha_vencimiento || new Date(`${lot.fecha_vencimiento}T23:59:59`) >= new Date())),
    ])));
    setAuthorizedUsers(authorizers.map((authorizer) => authorizer.user_id));
  };

  useEffect(() => {
    void reload().catch((e) => toast.push({ message: e instanceof Error ? e.message : 'Error al cargar fórmulas', tone: 'error' }));
  }, []);

  const medicationMap = useMemo(() => new Map(medications.map((med) => [med.id, med])), [medications]);
  const medicationOptions = useMemo<AocItem[]>(
    () => medications.filter((med) => med.is_active).map((med) => ({
      id: med.id,
      label: med.name,
      sublabel: `${med.presentacion || med.pharmaceutical_form || 'Sin presentación'} · Stock: ${formatNumber(medicationStock.get(med.id) ?? 0)}`,
    })),
    [medications, medicationStock],
  );
  const canEdit = role === 'admin' || role === 'super_admin';
  const canDispatch = canEdit && !!user?.id && authorizedUsers.includes(user.id);

  const reset = () => {
    setPatientType('person');
    setPatient({ firstName: '', lastName: '', document: '', birthDate: '', sex: '', phone: '' });
    setHealthCenter({ name: '', document: '', contact: '', phone: '', address: '' });
    setItems([emptyItem()]);
  };

  const save = async () => {
    if (!canDispatch || items.some((item) => !item.item_id || !(item.qty > 0))) {
      toast.push({ message: 'Solo un autorizador activo de medicamentos puede registrar la fórmula y debe completar ítems válidos', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await createPrescription({
        warehouse_id: null,
        patient_type: patientType,
        doctor_user_id: null,
        patient_first_name: patientType === 'person' ? patient.firstName : null,
        patient_last_name: patientType === 'person' ? patient.lastName : null,
        patient_document_number: patientType === 'person' ? patient.document : null,
        patient_birth_date: patientType === 'person' ? patient.birthDate || null : null,
        patient_sex: patientType === 'person' ? patient.sex || null : null,
        patient_phone: patientType === 'person' ? patient.phone : null,
        health_center_name: patientType === 'health_center' ? healthCenter.name : null,
        health_center_document: patientType === 'health_center' ? healthCenter.document : null,
        health_center_contact: patientType === 'health_center' ? healthCenter.contact : null,
        health_center_phone: patientType === 'health_center' ? healthCenter.phone : null,
        health_center_address: patientType === 'health_center' ? healthCenter.address : null,
      }, items.map(({ key: _key, ...item }) => item));
      toast.push({ message: 'Fórmula registrada como borrador para revisión', tone: 'success' });
      setOpen(false);
      reset();
      await reload();
    } catch (e) {
      toast.push({ message: e instanceof Error ? e.message : 'No se pudo registrar la fórmula', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  if (!canEdit) return <PageContainer><p className="text-body text-muted">Solo los administradores pueden registrar fórmulas médicas.</p></PageContainer>;

  return <PageContainer className="flex flex-col gap-5">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-h2">Fórmulas médicas</h1><p className="text-body-sm text-muted">Registra y despacha medicamentos desde el inventario global.</p></div><Button onClick={() => { reset(); setOpen(true); }} disabled={!canDispatch}><Plus size={18} /> Nueva fórmula</Button></header>
    {!canDispatch && <p className="rounded-lg bg-warning-50 p-3 text-caption text-warning-700">Tu usuario no está autorizado para dar salida de medicamentos.</p>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-left text-body-sm"><thead><tr className="border-b border-border text-muted"><th className="p-3">Fecha</th><th className="p-3">Destinatario</th><th className="p-3">Estado</th><th className="p-3">Ítems</th><th className="p-3" /></tr></thead><tbody>{prescriptions.map((prescription) => <tr key={prescription.id} className="border-b border-border last:border-0"><td className="p-3">{new Date(prescription.created_at).toLocaleDateString('es-CO')}</td><td className="p-3">{prescription.patient_type === 'person' ? `${prescription.patient_first_name ?? ''} ${prescription.patient_last_name ?? ''}` : prescription.health_center_name}</td><td className="p-3">{prescription.status === 'dispensed' ? <span className="inline-flex items-center gap-1 text-success-700"><CheckCircle size={16} /> Despachada</span> : prescription.status}</td><td className="p-3">{prescription.medical_prescription_items?.length ?? 0}</td><td className="p-3">{prescription.status === 'draft' && <Button size="sm" onClick={() => void dispatchPrescription(prescription.id).then(() => reload()).then(() => toast.push({ message: 'Fórmula despachada', tone: 'success' })).catch((e) => toast.push({ message: e instanceof Error ? e.message : 'No se pudo despachar', tone: 'error' }))} disabled={!canDispatch}>Despachar</Button>}</td></tr>)}</tbody></table></div>
    <Modal open={open} onClose={() => setOpen(false)} title="Registrar fórmula médica" size="xl">
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <Field id="pres-type" label="Destinatario"><select id="pres-type" value={patientType} onChange={(e) => setPatientType(e.target.value as typeof patientType)} className={inputWithError(undefined)}><option value="person">Paciente</option><option value="health_center">Centro de salud</option></select></Field>
        {patientType === 'person' ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field id="pres-first" label="Nombres" required><input id="pres-first" className={inputWithError(undefined)} value={patient.firstName} onChange={(e) => setPatient({ ...patient, firstName: e.target.value })} /></Field><Field id="pres-last" label="Apellidos"><input id="pres-last" className={inputWithError(undefined)} value={patient.lastName} onChange={(e) => setPatient({ ...patient, lastName: e.target.value })} /></Field><Field id="pres-doc" label="Número de documento"><input id="pres-doc" className={inputWithError(undefined)} value={patient.document} onChange={(e) => setPatient({ ...patient, document: e.target.value })} /></Field><Field id="pres-birth" label="Fecha de nacimiento"><input id="pres-birth" type="date" className={inputWithError(undefined)} value={patient.birthDate} onChange={(e) => setPatient({ ...patient, birthDate: e.target.value })} /></Field><Field id="pres-sex" label="Sexo"><select id="pres-sex" className={inputWithError(undefined)} value={patient.sex} onChange={(e) => setPatient({ ...patient, sex: e.target.value })}><option value="">Seleccionar...</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option></select></Field><Field id="pres-phone" label="Teléfono"><input id="pres-phone" className={inputWithError(undefined)} value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} /></Field></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field id="pres-center" label="Centro de salud" required><input id="pres-center" className={inputWithError(undefined)} value={healthCenter.name} onChange={(e) => setHealthCenter({ ...healthCenter, name: e.target.value })} /></Field><Field id="pres-center-doc" label="NIT o identificación"><input id="pres-center-doc" className={inputWithError(undefined)} value={healthCenter.document} onChange={(e) => setHealthCenter({ ...healthCenter, document: e.target.value })} /></Field><Field id="pres-center-contact" label="Contacto"><input id="pres-center-contact" className={inputWithError(undefined)} value={healthCenter.contact} onChange={(e) => setHealthCenter({ ...healthCenter, contact: e.target.value })} /></Field><Field id="pres-center-phone" label="Teléfono"><input id="pres-center-phone" className={inputWithError(undefined)} value={healthCenter.phone} onChange={(e) => setHealthCenter({ ...healthCenter, phone: e.target.value })} /></Field><Field id="pres-center-address" label="Dirección"><input id="pres-center-address" className={inputWithError(undefined)} value={healthCenter.address} onChange={(e) => setHealthCenter({ ...healthCenter, address: e.target.value })} /></Field></div>}
        <section className="flex flex-col gap-3 rounded-lg border border-border p-3"><div className="flex items-center justify-between"><h2 className="text-label">Medicamentos</h2><Button size="sm" variant="secondary" onClick={() => setItems([...items, emptyItem()])}><Plus size={16} /> Agregar</Button></div>{items.map((item, index) => <div key={item.key} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px_40px]"><AutocompleteOrCreate id={`pres-med-${index}`} label="Medicamento" value={item.item_id || null} onChange={(id) => updateItem(index, { item_id: id ?? '', unit_id: id ? medicationMap.get(id)?.unit_id : null })} items={medicationOptions} placeholder="Buscar medicamento..." /><Field id={`pres-qty-${index}`} label="Cantidad" required><input id={`pres-qty-${index}`} aria-label={`Cantidad de ${medicationMap.get(item.item_id)?.name ?? 'medicamento'}`} type="number" min="1" value={item.qty} onChange={(e) => updateItem(index, { qty: Number(e.target.value) })} className={inputWithError(undefined)} /></Field><Button size="sm" variant="ghost" aria-label="Eliminar medicamento" onClick={() => setItems(items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index))}><Trash size={18} /></Button></div>)}</section>
        <p className="rounded-lg bg-primary-50 p-3 text-caption text-primary-700">La salida de medicamentos no se asocia a una bodega. La autorización se valida con el usuario autenticado.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void save()} disabled={busy || !canDispatch}>{busy ? 'Guardando...' : 'Guardar fórmula'}</Button></div>
      </div>
    </Modal>
  </PageContainer>;
}
