import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, DotsThree, FileArrowDown, PencilSimple, Pill, Plus, Trash, UploadSimple, WarningCircle, Clock } from '@phosphor-icons/react';
import { fetchMedications, fetchCategories, fetchUnits, fetchLots, deleteMedication, importMedicationsFromRows, type Medication, type Category, type Unit } from '../../lib/db';
import { stockFor, lotExpired, lotExpiresSoon } from '../../lib/medicationOps';
import { formatNumber } from '../../lib/format';
import { categoriasFor, unitsFor } from '../../lib/catalog';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImportDialog, type ImportDialogConfig, type ParsedImportRow } from '../../components/ui/ImportDialog';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Segmented } from '../../components/ui/Segmented';
import { PageContainer } from '../../components/layout/PageContainer';
import { MedicationFormModal } from './MedicationFormModal';
import { LotesModal } from './LotesModal';
import { EntradaModal } from './EntradaModal';
import { SalidaModal } from './SalidaModal';
import { MedMovementsList } from './MedMovementsList';

const MEDS_TEMPLATE = 'medicamento;categoria;cantidad;unidad;presentacion;lote;vencimiento\nAmoxicilina 500mg;Antibióticos;100;caja;20 comprimidos;L2408A;2025-12-31\nIbuprofeno 400mg;Antiinflamatorios;50;blister;10 comprimidos;I2409B;\n';

interface MedImportRow {
  raw: string[];
  lineNo: number;
  medication?: string;
  category?: string;
  qty?: number;
  unit?: string | null;
  presentation?: string | null;
  lot?: string | null;
  expiry?: string | null;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) { if (line[i + 1] === quote) { cur += ch; i++; } else { quote = null; } } else { cur += ch; }
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ';' || ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseMedFile(text: string): MedImportRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  let headerCols: string[] | null = null;
  let headerIdx = 0;
  const first = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  if (first[0] === 'medicamento' || first[0] === 'medication' || first[0] === 'nombre' || first[0] === 'name') {
    headerCols = first;
    headerIdx = 1;
  }
  const rows: MedImportRow[] = [];
  for (let i = headerIdx; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (...names: string[]) => {
      if (!headerCols) return '';
      for (const n of names) {
        const idx = headerCols!.indexOf(n);
        if (idx >= 0) return cells[idx] ?? '';
      }
      return '';
    };
    const med = headerCols
      ? get('medicamento', 'medication', 'nombre', 'name')
      : (cells[0] ?? '');
    const cat = headerCols ? get('categoria', 'categoría', 'category') : (cells[1] ?? '');
    const qty = headerCols ? get('cantidad', 'qty', 'stock') : (cells[2] ?? '');
    rows.push({
      raw: cells,
      lineNo: i + 1,
      medication: med,
      category: cat,
      qty: Number.parseInt(qty, 10),
      unit: headerCols ? (get('unidad', 'unit') || null) : (cells[3] || null),
      presentation: headerCols ? (get('presentacion', 'presentación', 'presentation') || null) : (cells[4] || null),
      lot: headerCols ? (get('lote', 'lot') || null) : (cells[5] || null),
      expiry: headerCols ? (get('vencimiento', 'expiry', 'expiracion', 'expiración') || null) : (cells[6] || null),
    });
  }
  return rows;
}

export function MedicamentosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, centerId } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') ?? 'inventario';
  const setVista = (v: string) =>
    v === 'inventario' ? setParams({}, { replace: true }) : setParams({ vista: v }, { replace: true });

  const [medications, setMedications] = useState<Medication[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lotsByMed, setLotsByMed] = useState<Map<string, { stock: number; expired: boolean; soon: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

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
    await deleteMedication(deleting.id);
    toast.push({ message: t('medicamentos.deleted'), tone: 'success' });
    setDeleting(null);
    void reload();
  };

  const downloadMedsTemplate = () => {
    const blob = new Blob([MEDS_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-medicamentos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig: ImportDialogConfig = {
    scope: 'medications',
    onImport: async (rows) => {
      const data = rows.map((r) => {
        const med = r as unknown as MedImportRow;
        return {
          medication: med.medication ?? '',
          category: med.category ?? '',
          qty: Number(med.qty ?? 0),
          unit: med.unit ?? undefined,
          presentation: med.presentation ?? undefined,
          lot: med.lot ?? undefined,
          expiry: med.expiry ?? undefined,
        };
      });
      const stats = await importMedicationsFromRows(data, user?.id, centerId ?? undefined);
      toast.push({ message: `Importación completada: ${stats.ok} medicamentos`, tone: 'success' });
      void reload();
      return stats as { ok: number; [k: string]: unknown };
    },
    templateFilename: 'plantilla-medicamentos.csv',
    templateContent: MEDS_TEMPLATE,
    parseFile: (text) => parseMedFile(text) as unknown as ParsedImportRow[],
    validateRow: (r) => {
      const med = r as unknown as MedImportRow;
      if (!med.medication) return { ok: false, reason: 'Falta nombre del medicamento' };
      if (!med.category) return { ok: false, reason: 'Falta categoría' };
      if (typeof med.qty !== 'number' || !Number.isFinite(med.qty) || med.qty < 0) {
        return { ok: false, reason: 'Cantidad inválida' };
      }
      return { ok: true };
    },
  };

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('medicamentos.list.title')}</h1>
        {vista === 'inventario' && (
        <div className="flex items-center gap-2">
          <Dropdown
            ariaLabel="Más acciones"
            align="right"
            trigger={
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
                <DotsThree size={20} weight="bold" aria-hidden="true" />
              </span>
            }
            items={[
              {
                key: 'import',
                label: 'Importar archivo',
                icon: <UploadSimple size={16} aria-hidden="true" />,
                onClick: () => setImportOpen(true),
              },
              {
                key: 'template',
                label: 'Descargar plantilla',
                icon: <FileArrowDown size={16} aria-hidden="true" />,
                onClick: () => downloadMedsTemplate(),
              },
            ]}
          />
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={18} aria-hidden="true" />
            {t('medicamentos.new')}
          </Button>
        </div>
        )}
      </header>

      <Segmented
        value={vista}
        onChange={setVista}
        ariaLabel={t('medicamentos.tabs.aria')}
        options={[
          { value: 'inventario', label: t('medicamentos.tabs.inventario') },
          { value: 'entradas', label: t('medicamentos.tabs.entradas') },
          { value: 'salidas', label: t('medicamentos.tabs.salidas') },
          { value: 'movimientos', label: t('medicamentos.tabs.movimientos') },
        ]}
      />

      {vista !== 'inventario' ? (
        <MedMovementsList kind={vista === 'entradas' ? 'entrada' : vista === 'salidas' ? 'salida' : undefined} />
      ) : loading ? (
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
        <ul className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('common.edit')} ${m.name}`}
                      onClick={() => { setEditing(m); setFormOpen(true); }}
                      className="h-11 w-11 px-0"
                    >
                      <PencilSimple size={18} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('common.delete')} ${m.name}`}
                      onClick={() => setDeleting(m)}
                      className="h-11 w-11 px-0 hover:bg-danger-500/10 hover:text-danger-700"
                    >
                      <Trash size={18} aria-hidden="true" />
                    </Button>
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
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} config={importConfig} />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('medicamentos.delete.title')}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t('medicamentos.delete.body', { name: deleting?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void remove()}>{t('common.delete')}</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
