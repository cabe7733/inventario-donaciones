import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, DotsThree, FileArrowDown, PencilSimple, Pill, Plus, Trash, UploadSimple, WarningCircle, Clock } from '@phosphor-icons/react';
import { fetchMedications, fetchLotsBulk, deleteMedication, importMedicationsFromRows, type Medication } from '../../lib/db';
import { stockFor, lotExpired, lotExpiresSoon } from '../../lib/medicationOps';
import { formatNumber } from '../../lib/format';
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
import { SearchInput } from '../../components/ui/SearchInput';
import { MedicationFormModal } from './MedicationFormModal';
import { EntradaModal } from './EntradaModal';
import { MedMovementsList } from './MedMovementsList';
import { MedicalSuppliesInventory } from './MedicalSuppliesInventory';

const MEDS_TEMPLATE = 'nombre_medicamento;principio_activo;forma_farmaceutica;contenido;laboratorio_fabricante\nAmoxicilina 500 mg comprimido;Amoxicilina 500 mg. Excipientes: ...;Comprimido;20 comprimidos;Laboratorio ejemplo\n';

interface MedImportRow {
  raw: string[];
  lineNo: number;
  medication?: string;
  qty?: number;
  presentation?: string | null;
  lot?: string | null;
  expiry?: string | null;
  commercialName?: string | null;
  activeIngredient?: string | null;
  dosage?: string | null;
  excipients?: string | null;
  pharmaceuticalForm?: string | null;
  content?: string | null;
  manufacturer?: string | null;
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
    const qty = headerCols ? get('cantidad', 'qty', 'stock') : (cells[2] ?? '');
    rows.push({
      raw: cells,
      lineNo: i + 1,
      medication: med,
      qty: qty ? Number.parseInt(qty, 10) : 0,
      presentation: headerCols ? (get('presentacion', 'presentación', 'presentation') || null) : (cells[4] || null),
      lot: headerCols ? (get('lote', 'lot') || null) : (cells[5] || null),
      expiry: headerCols ? (get('vencimiento', 'expiry', 'expiracion', 'expiración') || null) : (cells[6] || null),
      commercialName: null,
      activeIngredient: headerCols ? (get('principio_activo', 'active_ingredient') || null) : null,
      dosage: null,
      excipients: null,
      pharmaceuticalForm: headerCols ? (get('forma_farmaceutica', 'forma', 'pharmaceutical_form') || null) : null,
      content: headerCols ? (get('contenido', 'content') || null) : null,
      manufacturer: headerCols ? (get('laboratorio_fabricante', 'laboratorio', 'manufacturer') || null) : null,
    });
  }
  return rows;
}

export function MedicamentosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, centerId } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') ?? 'inventario';
  const inventarioTipo = params.get('tipo') ?? 'medicamentos';
  const setVista = (v: string) =>
    v === 'inventario' ? setParams({}, { replace: true }) : setParams({ vista: v }, { replace: true });
  const setInventarioTipo = (tipo: string) => setParams(tipo === 'medicamentos' ? {} : { tipo }, { replace: true });

  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: medications = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medications'],
    queryFn: fetchMedications,
  });

  const { data: lotsByMed = new Map(), isLoading: loadingLots } = useQuery({
    queryKey: ['medications', 'lots'],
    queryFn: async () => {
      const lotsMap = await fetchLotsBulk(medications.map((m) => m.id));
      const result = new Map<string, { stock: number; expired: boolean; soon: boolean }>();
      for (const med of medications) {
        const active = lotsMap.get(med.id) ?? [];
        result.set(med.id, {
          stock: stockFor(active),
          expired: active.some(lotExpired),
          soon: active.some(lotExpiresSoon),
        });
      }
      return result;
    },
    enabled: medications.length > 0,
  });

  const loading = loadingMeds || loadingLots;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [entradaMed, setEntradaMed] = useState<Medication | null>(null);
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const visibleMedications = useMemo(() => medications.filter((medication) => `${medication.name} ${medication.commercial_name} ${medication.active_ingredient} ${medication.manufacturer}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [medications, query]);

  const remove = async () => {
    if (!deleting) return;
    await deleteMedication(deleting.id);
    toast.push({ message: t('medicamentos.deleted'), tone: 'success' });
    setDeleting(null);
    queryClient.invalidateQueries({ queryKey: ['medications'] });
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
          qty: Number(med.qty ?? 0),
          unit: undefined,
          presentation: med.presentation ?? undefined,
          lot: med.lot ?? undefined,
          expiry: med.expiry ?? undefined,
          commercial_name: med.commercialName ?? undefined,
          active_ingredient: med.activeIngredient ?? undefined,
          dosage: med.dosage ?? undefined,
          excipients: med.excipients ?? undefined,
          pharmaceutical_form: med.pharmaceuticalForm ?? undefined,
          content: med.content ?? undefined,
          manufacturer: med.manufacturer ?? undefined,
        };
      });
      const stats = await importMedicationsFromRows(data, user?.id, centerId ?? undefined);
      toast.push({ message: `Importación completada: ${stats.ok} medicamentos`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      return stats as { ok: number; [k: string]: unknown };
    },
    templateFilename: 'plantilla-medicamentos.csv',
    templateContent: MEDS_TEMPLATE,
    parseFile: (text) => parseMedFile(text) as unknown as ParsedImportRow[],
    validateRow: (r) => {
      const med = r as unknown as MedImportRow;
      if (!med.medication) return { ok: false, reason: 'Falta nombre del medicamento' };
      if (typeof med.qty !== 'number' || !Number.isFinite(med.qty) || med.qty < 0) {
        return { ok: false, reason: 'Cantidad inválida' };
      }
      return { ok: true };
    },
  };

  return (
    <PageContainer className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
         <h1 className="text-h2">{inventarioTipo === 'insumos' && vista === 'inventario' ? 'Insumos médicos' : t('medicamentos.list.title')}</h1>
        {vista === 'inventario' && inventarioTipo === 'medicamentos' && (
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

      {vista === 'inventario' && (
        <Segmented
          value={inventarioTipo}
          onChange={setInventarioTipo}
          ariaLabel="Tipo de inventario médico"
          options={[{ value: 'medicamentos', label: 'Medicamentos' }, { value: 'insumos', label: 'Insumos médicos' }]}
        />
      )}

      {vista === 'inventario' && inventarioTipo === 'medicamentos' && (
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar medicamento por nombre, principio activo o laboratorio" aria-label="Buscar medicamento" />
      )}

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

      {vista === 'inventario' && inventarioTipo === 'insumos' ? (
        <MedicalSuppliesInventory />
      ) : vista !== 'inventario' ? (
        <MedMovementsList kind={vista === 'entradas' ? 'entrada' : vista === 'salidas' ? 'salida' : undefined} />
      ) : loading ? (
        <SkeletonList />
      ) : visibleMedications.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t('medicamentos.list.empty')}
          description={t('medicamentos.list.emptyHint')}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus size={18} aria-hidden="true" />
                {t('medicamentos.new')}
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
          {[...visibleMedications]
            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
            .map((m) => {
              const st = lotsByMed.get(m.id) ?? { stock: 0, expired: false, soon: false };
              return (
                <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold">{m.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
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
                      {(m.active_ingredient || m.pharmaceutical_form || m.content || m.manufacturer) && (
                        <p className="truncate text-caption text-muted">
                          {[m.active_ingredient, m.pharmaceutical_form, m.content, m.manufacturer].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-numeric-lg text-primary-700">
                      {formatNumber(st.stock)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEntradaMed(m)}>
                      <ArrowDown size={16} aria-hidden="true" />
                      {t('medicamentos.entradaBtn')}
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

      <MedicationFormModal open={formOpen} onClose={() => { setFormOpen(false); queryClient.invalidateQueries({ queryKey: ['medications'] }); }} medication={editing} />
      <EntradaModal medication={entradaMed} open={entradaMed !== null} onClose={() => { setEntradaMed(null); queryClient.invalidateQueries({ queryKey: ['medications'] }); }} />
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
