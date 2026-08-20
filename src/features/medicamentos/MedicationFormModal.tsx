import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db';
import { deviceId, newId, nowISO } from '../../lib/ids';
import { addCategory, addUnit } from '../../lib/catalog';
import type { Category, Medication, Unit } from '../../db/types';
import { AutocompleteOrCreate, type AocItem } from '../../components/ui/AutocompleteOrCreate';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  medication: Medication | null;
  categories: Category[];
  units: Unit[];
}

interface Errors {
  name?: string;
  unit?: string;
}

export function MedicationFormModal({ open, onClose, medication, categories, units }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [name, setName] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(medication?.name ?? '');
    setPresentacion(medication?.presentacion ?? '');
    setCategoriaId(medication?.categoriaId ?? null);
    setUnitId(medication?.unitId ?? null);
    setErrors({});
  }, [open, medication]);

  const categoryItems = useMemo<AocItem[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories],
  );
  const unitItems = useMemo<AocItem[]>(
    () => units.map((u) => ({ id: u.id, label: u.name, sublabel: u.abbreviation })),
    [units],
  );

  const createCategory = (label: string) => addCategory(label, 'medication', 'pills', categories.length);

  const createUnit = (label: string) => addUnit(label, 'medication');

  const save = async () => {
    const next: Errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!unitId) next.unit = t('common.required');
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), presentacion: presentacion.trim(), categoriaId, unitId: unitId! };
      if (medication) {
        await db.medications.update(medication.id, {
          ...data,
          _version: medication._version + 1,
          _syncedAt: null,
        });
        toast.push({ message: t('medicamentos.saved'), tone: 'success' });
      } else {
        await db.medications.add({
          id: newId(),
          ...data,
          isActive: 1,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          _version: 1,
          _deleted: 0,
          _syncedAt: null,
          _deviceId: deviceId(),
          _clientUuid: newId(),
        });
        toast.push({ message: t('medicamentos.created'), tone: 'success' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={medication ? t('medicamentos.form.editTitle') : t('medicamentos.form.title')}
    >
      <div className="flex flex-col gap-4">
        <Field id="md-name" label={t('medicamentos.form.name')} required error={errors.name}>
          <input
            id="md-name"
            className={inputWithError(errors.name)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('medicamentos.form.name.placeholder')}
            autoFocus
          />
        </Field>

        <Field id="md-pres" label={t('medicamentos.form.presentacion')} hint={t('medicamentos.form.presentacion.hint')}>
          <input
            id="md-pres"
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-body text-fg placeholder:text-muted"
            value={presentacion}
            onChange={(e) => setPresentacion(e.target.value)}
            placeholder={t('medicamentos.form.presentacion.placeholder')}
          />
        </Field>

        <AutocompleteOrCreate
          id="md-cat"
          label={t('medicamentos.form.categoria')}
          value={categoriaId}
          onChange={setCategoriaId}
          items={categoryItems}
          onCreate={createCategory}
        />

        <AutocompleteOrCreate
          id="md-unit"
          label={t('medicamentos.form.unit')}
          required
          value={unitId}
          onChange={setUnitId}
          items={unitItems}
          onCreate={createUnit}
          error={errors.unit}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}