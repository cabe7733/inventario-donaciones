import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CaretLeft, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { fetchCategories, fetchProducts, fetchMedications, createCategory, updateCategory, deleteCategory, type Category, type Scope } from '../../lib/db';
import { categoriasFor } from '../../lib/catalog';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

const COLOR_OPTIONS = [
  { value: 'primary-600', cls: 'bg-primary-600' },
  { value: 'secondary-600', cls: 'bg-secondary-600' },
  { value: 'success-700', cls: 'bg-success-700' },
  { value: 'warning-700', cls: 'bg-warning-700' },
  { value: 'danger-700', cls: 'bg-danger-700' },
  { value: 'info-700', cls: 'bg-info-700' },
  { value: 'neutral-500', cls: 'bg-neutral-500' },
] as const;

export function CategoriasPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();

  const [scope, setScope] = useState<Scope>('product');
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const load = async () => {
    const cats = await fetchCategories();
    setCategories(cats);
    const [ps, ms] = await Promise.all([fetchProducts(), fetchMedications()]);
    const m = new Map<string, number>();
    for (const p of ps) {
      if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    }
    for (const med of ms) {
      if (med.categoria_id) m.set(med.categoria_id, (m.get(med.categoria_id) ?? 0) + 1);
    }
    setCounts(m);
  };

  useEffect(() => { load(); }, []);

  const visible = categoriasFor(categories, scope);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLOR_OPTIONS[0].value);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const colorClass = (c: string) => COLOR_OPTIONS.find((o) => o.value === c)?.cls ?? 'bg-primary-600';

  const openNew = () => {
    setEditing(null);
    setName('');
    setColor(COLOR_OPTIONS[0].value);
    setError(undefined);
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setColor(c.color);
    setError(undefined);
    setFormOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('common.required'));
      return;
    }
    if (!centerId) {
      setError('No hay centro activo');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: trimmed,
          color,
        });
        toast.push({ message: t('categorias.saved'), tone: 'success' });
      } else {
        await createCategory(trimmed, scope, scope === 'medication' ? 'pills' : 'box', visible.length, color, centerId);
        toast.push({ message: t('categorias.created'), tone: 'success' });
      }
      setFormOpen(false);
      load();
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al guardar',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await deleteCategory(deleting.id);
    toast.push({ message: t('categorias.deleted'), tone: 'success' });
    setDeleting(null);
    load();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link to="/config" className="inline-flex items-center gap-1 text-caption text-muted hover:text-primary-700">
        <CaretLeft size={14} aria-hidden="true" /> Volver a Configuración
      </Link>

      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('categorias.title')}</h1>
        <Button onClick={openNew}>
          <Plus size={18} aria-hidden="true" />
          {t('categorias.new')}
        </Button>
      </header>

      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        ariaLabel={t('categorias.scope')}
        options={[
          { value: 'product', label: t('categorias.scope.products') },
          { value: 'medication', label: t('categorias.scope.medications') },
        ]}
      />

      <ul className="flex flex-col gap-2">
        {visible.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${colorClass(c.color)}`}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-body font-medium">{c.name}</span>
            <span className="text-caption text-muted">{counts.get(c.id) ?? 0}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t('common.edit')} ${c.name}`}
              onClick={() => openEdit(c)}
              className="h-11 w-11 px-0"
            >
              <PencilSimple size={18} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t('common.delete')} ${c.name}`}
              onClick={() => setDeleting(c)}
              className="h-11 w-11 px-0 hover:bg-danger-500/10 hover:text-danger-700"
            >
              <Trash size={18} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('categorias.form.title')}>
        <div className="flex flex-col gap-4">
          <Field id="c-name" label={t('categorias.form.name')} required error={error}>
            <input
              id="c-name"
              className={inputWithError(error)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-label text-fg">{t('categorias.form.color')}</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-label={o.value}
                  aria-pressed={color === o.value}
                  onClick={() => setColor(o.value)}
                  className={`h-8 w-8 rounded-full transition-transform ${o.cls} ${
                    color === o.value ? 'ring-2 ring-offset-2 ring-primary-600 scale-110 dark:ring-offset-card' : ''
                  }`}
                />
              ))}
            </div>
          </div>

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

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('categorias.delete.title')}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('categorias.delete.body', { name: deleting?.name })}</p>
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
