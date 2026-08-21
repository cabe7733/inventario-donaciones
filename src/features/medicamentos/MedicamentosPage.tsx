import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, PencilSimple, Pill, Plus, Trash, WarningCircle, Clock } from '@phosphor-icons/react';
import { fetchMedications, fetchCategories, fetchUnits, fetchLots, deleteMedication, type Medication, type Category, type Unit } from '../../lib/db';
import { stockFor, lotExpired, lotExpiresSoon } from '../../lib/medicationOps';
import { formatNumber } from '../../lib/format';
import { categoriasFor, unitsFor } from '../../lib/catalog';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { SkeletonList } from '../../components/ui/Skeleton';
import { MedicationFormModal } from './MedicationFormModal';
import { LotesModal } from './LotesModal';
import { EntradaModal } from './EntradaModal';
import { SalidaModal } from './SalidaModal';

export function MedicamentosPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lotsByMed, setLotsByMed] = useState<Map<string, { stock: number; expired: boolean; soon: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [meds, cats, unis] = await Promise.all([fetchMedications(), fetchCategories(), fetchUnits()]);
    setMedications(meds);
    setCategories(cats);
    setUnits(unis);

    const lotsMap = new Map<string, { stock: number; expired: boolean; soon: boolean }>();
    const lotsResults = await Promise.all(meds.map((m) => fetchLots(m.id)));
    meds.forEach((med, i) => {
      const active = lotsResults[i];
      lotsMap.set(med.id, {
        stock: stockFor(active),
        expired: active.some(lotExpired),
        soon: active.some(lotExpiresSoon),
      });
    });
    setLotsByMed(lotsMap);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const cats = useMemo(() => categoriasFor(categories, 'medication'), [categories]);
  const unis = useMemo(() => unitsFor(units, 'medication'), [units]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [lotModal, setLotModal] = useState<Medication | null>(null);
  const [entradaMed, setEntradaMed] = useState<Medication | null>(null);
  const [salidaMed, setSalidaMed] = useState<Medication | null>(null);
  const [deleting, setDeleting] = useState<Medication | null>(null);

  const catBy = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const unitBy = useMemo(() => new Map(unis.map((u) => [u.id, u.abbreviation])), [unis]);

  const remove = async () => {
    if (!deleting) return;
    await deleteMedication(deleting.id, deleting.version);
    toast.push({ message: t('medicamentos.deleted'), tone: 'success' });
    setDeleting(null);
    void reload();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('medicamentos.list.title')}</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={18} aria-hidden="true" />
          {t('medicamentos.new')}
        </Button>
      </header>

      {loading ? (
        <SkeletonList />
      ) : medications.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t('medicamentos.list.empty')}
          description={t('medicamentos.list.emptyHint')}
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={18} aria-hidden="true" />
              {t('medicamentos.new')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...medications]
            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
            .map((m) => {
              const st = lotsByMed.get(m.id) ?? { stock: 0, expired: false, soon: false };
              return (
                <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold">{m.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {m.categoria_id && catBy.get(m.categoria_id) && (
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-700">
                            {catBy.get(m.categoria_id)}
                          </span>
                        )}
                        {st.soon && (
                          <span className="flex items-center gap-1 rounded-full bg-warning-500/15 px-2 py-0.5 text-caption font-semibold text-warning-700">
                            <Clock size={12} aria-hidden="true" /> {t('medicamentos.vto.soon')}
                          </span>
                        )}
                        {st.expired && (
                          <span className="flex items-center gap-1 rounded-full bg-danger-500/15 px-2 py-0.5 text-caption font-semibold text-danger-700">
                            <WarningCircle size={12} aria-hidden="true" /> {t('medicamentos.vto.expired')}
                          </span>
                        )}
                      </div>
                      {m.presentacion && (
                        <p className="truncate text-caption text-muted">{m.presentacion}</p>
                      )}
                    </div>
                    <span className="text-numeric-lg text-primary-700">
                      {formatNumber(st.stock)}
                      <span className="ml-1 text-caption text-muted">{unitBy.get(m.unit_id) ?? ''}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEntradaMed(m)}>
                      <ArrowDown size={16} aria-hidden="true" />
                      {t('medicamentos.entradaBtn')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setSalidaMed(m)}>
                      <ArrowUp size={16} aria-hidden="true" />
                      {t('medicamentos.salidaBtn')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLotModal(m)}>
                      {t('medicamentos.lotesBtn')}
                    </Button>
                    <span className="flex-1" />
                    <button
                      type="button"
                      aria-label={`${t('common.edit')} ${m.name}`}
                      onClick={() => { setEditing(m); setFormOpen(true); }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-neutral-100 dark:hover:bg-neutral-100"
                    >
                      <PencilSimple size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('common.delete')} ${m.name}`}
                      onClick={() => setDeleting(m)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
                    >
                      <Trash size={18} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <MedicationFormModal open={formOpen} onClose={() => { setFormOpen(false); void reload(); }} medication={editing} categories={cats} units={unis} />
      <LotesModal medication={lotModal} open={lotModal !== null} onClose={() => { setLotModal(null); void reload(); }} />
      <EntradaModal medication={entradaMed} open={entradaMed !== null} onClose={() => { setEntradaMed(null); void reload(); }} />
      <SalidaModal medication={salidaMed} open={salidaMed !== null} onClose={() => { setSalidaMed(null); void reload(); }} />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('medicamentos.delete.title')}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('medicamentos.delete.body', { name: deleting?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void remove()}>{t('common.delete')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
