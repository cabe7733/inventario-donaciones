import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { db } from '../../db';
import { categoriasFor, addCategory } from '../../lib/catalog';
import type { Category, Scope } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

const COLOR_OPTIONS = [
  'primary-600',
  'secondary-600',
  'success-700',
  'warning-700',
  'danger-700',
  'info-700',
  'neutral-500',
];

export function CategoriasPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [scope, setScope] = useState<Scope>('product');

  const categories = useLiveQuery(() => db.categories.where('_deleted').equals(0).toArray(), []);
  const counts = useLiveQuery(
    () =>
      Promise.all([
        db.products
          .where('_deleted')
          .equals(0)
          .toArray()
          .then((ps) => {
            const m = new Map<string, number>();
            for (const p of ps) {
              if (p.categoryId) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
            }
            return m;
          }),
        db.medications
          .where('_deleted')
          .equals(0)
          .toArray()
          .then((ms) => {
            const m = new Map<string, number>();
            for (const med of ms) {
              if (med.categoriaId) m.set(med.categoriaId, (m.get(med.categoriaId) ?? 0) + 1);
            }
            return m;
          }),
      ]).then(([prod, med]) => {
        const merged = new Map(prod);
        for (const [k, v] of med) merged.set(k, (merged.get(k) ?? 0) + v);
        return merged;
      }),
    [],
  );

  const visible = categoriasFor(categories ?? [], scope);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const openNew = () => {
    setEditing(null);
    setName('');
    setColor(COLOR_OPTIONS[0]);
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
    setSaving(true);
    try {
      if (editing) {
        await db.categories.update(editing.id, {
          name: trimmed,
          color,
          _version: editing._version + 1,
          _syncedAt: null,
        });
        toast.push({ message: t('categorias.saved'), tone: 'success' });
      } else {
        await addCategory(trimmed, scope, scope === 'medication' ? 'pills' : 'box', visible.length, color);
        toast.push({ message: t('categorias.created'), tone: 'success' });
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await db.categories.update(deleting.id, {
      _deleted: 1,
      _version: deleting._version + 1,
      _syncedAt: null,
    });
    toast.push({ message: t('categorias.deleted'), tone: 'success' });
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link to="/mas" className="text-caption text-muted hover:text-primary-700">
            ← {t('nav.mas')}
          </Link>
          <h1 className="text-h2">{t('categorias.title')}</h1>
        </div>
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
              className={`h-3 w-3 shrink-0 rounded-full bg-${c.color}`}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-body font-medium">{c.name}</span>
            <span className="text-caption text-muted">{counts?.get(c.id) ?? 0}</span>
            <button
              type="button"
              aria-label={`${t('common.edit')} ${c.name}`}
              onClick={() => openEdit(c)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
            >
              <PencilSimple size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`${t('common.delete')} ${c.name}`}
              onClick={() => setDeleting(c)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
            >
              <Trash size={18} aria-hidden="true" />
            </button>
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
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full bg-${c} ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary-600 dark:ring-offset-card' : ''
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