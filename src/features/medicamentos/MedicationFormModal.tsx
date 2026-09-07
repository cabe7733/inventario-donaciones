import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '../../lib/ids';
import { createMedication, updateMedication, type Medication } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  medication: Medication | null;
}

interface Errors {
  name?: string;
  activeIngredient?: string;
  pharmaceuticalForm?: string;
  content?: string;
  manufacturer?: string;
}

export function MedicationFormModal({ open, onClose, medication }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [pharmaceuticalForm, setPharmaceuticalForm] = useState('');
  const [content, setContent] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(medication?.name ?? '');
    setActiveIngredient(medication?.active_ingredient ?? '');
    setPharmaceuticalForm(medication?.pharmaceutical_form ?? medication?.presentacion ?? '');
    setContent(medication?.content ?? '');
    setManufacturer(medication?.manufacturer ?? '');
    setErrors({});
  }, [open, medication]);

  const save = async () => {
    const next: Errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!activeIngredient.trim()) next.activeIngredient = t('common.required');
    if (!pharmaceuticalForm.trim()) next.pharmaceuticalForm = t('common.required');
    if (!content.trim()) next.content = t('common.required');
    if (!manufacturer.trim()) next.manufacturer = t('common.required');
    if (Object.keys(next).length) { setErrors(next); return; }
    if (!centerId) {
      toast.push({ message: 'No hay centro activo', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        presentacion: pharmaceuticalForm.trim(),
        active_ingredient: activeIngredient.trim(),
        excipients: '',
        pharmaceutical_form: pharmaceuticalForm.trim(),
        content: content.trim(),
        manufacturer: manufacturer.trim(),
        categoria_id: null,
        unit_id: null,
      };
      if (medication) {
        await updateMedication(medication.id, { ...data });
        toast.push({ message: t('medicamentos.saved'), tone: 'success' });
      } else {
        await createMedication({ id: newId(), ...data, is_active: true, center_id: centerId });
        toast.push({ message: t('medicamentos.created'), tone: 'success' });
      }
      onClose();
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al guardar',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={medication ? t('medicamentos.form.editTitle') : t('medicamentos.form.title')}>
      <div className="flex flex-col gap-4">
        <Field id="md-name" label="Nombre del medicamento" hint="Incluye la marca comercial o principio activo, la dosis y la forma farmacéutica." required error={errors.name}>
          <input id="md-name" className={inputWithError(errors.name)} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Amoxicilina 500 mg comprimido" autoFocus />
        </Field>
        <Field id="md-active" label="Principio activo" hint="Cantidad exacta de la sustancia activa y lista de excipientes." required error={errors.activeIngredient}><textarea id="md-active" className={inputWithError(errors.activeIngredient)} value={activeIngredient} onChange={(e) => setActiveIngredient(e.target.value)} placeholder="Ej. Amoxicilina 500 mg. Excipientes: ..." /></Field>
        <Field id="md-form" label="Forma farmacéutica" hint="Comprimidos, jarabe, gotas o solución inyectable." required error={errors.pharmaceuticalForm}><input id="md-form" className={inputWithError(errors.pharmaceuticalForm)} value={pharmaceuticalForm} onChange={(e) => setPharmaceuticalForm(e.target.value)} placeholder="Ej. Comprimido" /></Field>
        <Field id="md-content" label="Contenido" hint="Cantidad de unidades o volumen total." required error={errors.content}><input id="md-content" className={inputWithError(errors.content)} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ej. 20 comprimidos o 100 ml" /></Field>
        <Field id="md-manufacturer" label="Laboratorio fabricante" required error={errors.manufacturer}><input id="md-manufacturer" className={inputWithError(errors.manufacturer)} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
