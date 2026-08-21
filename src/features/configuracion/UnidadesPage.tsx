import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { fetchUnits, fetchProducts, fetchMedications, createUnit, updateUnit, deleteUnit, type Scope, type Unit } from '../../lib/db';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

export function UnidadesPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [scope, setScope] = useState<Scope>('product');
  const [units, setUnits] = useState<Unit[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());

  const load = async () => {
    const u = await fetchUnits();
    setUnits(u);
    const rows = scope === 'medication' ? await fetchMedications() : await fetchProducts();
    const m = new Map<string, number>();
    for (const row of rows) {
      const uid = 'unit_id' in row ? row.unit_id : undefined;
      if (uid) m.set(uid, (m.get(uid) ?? 0) + 1);
    }
    setUsage(m);
  };

  useEffect(() => { load(); }, [scope]);

  const visible = units.filter((u) => u.scope === scope && u.is_active);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [errors, setErrors] = useState<{ name?: string; abbreviation?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Unit | null>(null);

  const openNew = () => {
    setEditing(null);
    setName('');
    setAbbreviation('');
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (u: Unit) => {
    setEditing(u);
    setName(u.name);
    setAbbreviation(u.abbreviation);
    setErrors({});
    setFormOpen(true);
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!abbreviation.trim()) next.abbreviation = t('common.required');
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateUnit(editing.id, {
          name: name.trim(),
          abbreviation: abbreviation.trim(),
          version: editing.version + 1,
        });
        toast.push({ message: t('unidades.saved'), tone: 'success' });
      } else {
        await createUnit(name.trim(), scope, abbreviation.trim());
        toast.push({ message: t('unidades.created'), tone: 'success' });
      }
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const count = usage.get(deleting.id) ?? 0;
    if (count > 0) {
      toast.push({ message: t('unidades.delete.inUse', { count }), tone: 'error' });
      setDeleting(null);
      return;
    }
    await deleteUnit(deleting.id, deleting.version);
    toast.push({ message: t('unidades.deleted'), tone: 'success' });
    setDeleting(null);
    load();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link to="/mas" className="text-caption text-muted hover:text-primary-700">
            ← {t('nav.mas')}
          </Link>
          <h1 className="text-h2">{t('unidades.title')}</h1>
        </div>
        <Button onClick={openNew}>
          <Plus size={18} aria-hidden="true" />
          {t('unidades.new')}
        </Button>
      </header>

      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        ariaLabel={t('unidades.scope')}
        options={[
          { value: 'product', label: t('unidades.scope.products') },
          { value: 'medication', label: t('unidades.scope.medications') },
        ]}
      />

      <ul className="flex flex-col gap-2">
        {visible.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span className="flex-1 truncate text-body font-medium">{u.name}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-muted dark:bg-neutral-100">
              {u.abbreviation}
            </span>
            <span className="text-caption text-muted">{usage.get(u.id) ?? 0}</span>
            <button
              type="button"
              aria-label={`${t('common.edit')} ${u.name}`}
              onClick={() => openEdit(u)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
            >
              <PencilSimple size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`${t('common.delete')} ${u.name}`}
              onClick={() => setDeleting(u)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
            >
              <Trash size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('unidades.form.title')}>
        <div className="flex flex-col gap-4">
          <Field id="u-name" label={t('unidades.form.name')} required error={errors.name}>
            <input
              id="u-name"
              className={inputWithError(errors.name)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field id="u-abbr" label={t('unidades.form.abbreviation')} required error={errors.abbreviation}>
            <input
              id="u-abbr"
              className={inputWithError(errors.abbreviation)}
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="kg, L, un…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('unidades.delete.title')}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('unidades.delete.body', { name: deleting?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
