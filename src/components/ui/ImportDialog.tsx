import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileArrowDown, UploadSimple, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ImportDialogConfig {
  scope: 'products' | 'medications' | 'volunteers';
  onImport: (rows: ParsedImportRow[]) => Promise<{ ok: number; [k: string]: unknown }>;
  templateFilename: string;
  templateContent: string;
  parseFile: (text: string) => ParsedImportRow[];
  validateRow: (row: ParsedImportRow) => { ok: boolean; reason?: string };
}

export interface ParsedImportRow {
  raw: string[];
  lineNo: number;
  [k: string]: unknown;
}

type RowStatus = 'ok' | 'error' | 'skipped';

interface PreviewRow {
  raw: string[];
  lineNo: number;
  status: RowStatus;
  reason?: string;
  [k: string]: unknown;
}

const SCOPE_LABELS: Record<ImportDialogConfig['scope'], { title: string; item: string }> = {
  products: { title: 'productos', item: 'producto' },
  medications: { title: 'medicamentos', item: 'medicamento' },
  volunteers: { title: 'voluntarios', item: 'voluntario' },
};

export function ImportDialog({
  open,
  onClose,
  config,
}: {
  open: boolean;
  onClose: () => void;
  config: ImportDialogConfig;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const labels = SCOPE_LABELS[config.scope];

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const parsed = config.parseFile(text);
    const preview: PreviewRow[] = parsed.map((r) => {
      const v = config.validateRow(r);
      return { ...r, status: v.ok ? 'ok' : 'error', reason: v.reason };
    });
    setRows(preview);
  };

  const downloadTemplate = () => {
    const blob = new Blob([config.templateContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const okRows = rows.filter((r) => r.status === 'ok');
    if (okRows.length === 0) return;
    setImporting(true);
    try {
      const stats = await config.onImport(okRows);
      setResult(stats);
    } finally {
      setImporting(false);
    }
  };

  const okCount = rows.filter((r) => r.status === 'ok').length;
  const errorCount = rows.filter((r) => r.status !== 'ok').length;

  if (!open) return null;

  return (
    <Modal open onClose={close} title={`Importar ${labels.title}`}>
      <div className="flex flex-col gap-4">
        {result ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="rounded-lg bg-success-500/15 p-3 text-caption text-success-700">
              Importación completada.
            </div>
            <pre className="w-full rounded-lg border border-border bg-surface p-3 text-left text-caption text-fg">
              {JSON.stringify(result, null, 2)}
            </pre>
            <Button onClick={close}>Listo</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
              <p className="text-body-sm text-muted">
                Carga masiva desde un archivo CSV o TXT. Si la primera fila tiene encabezados, se ignoran.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                  <FileArrowDown size={16} aria-hidden="true" />
                  Descargar plantilla
                </Button>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-body-sm font-semibold text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    className="hidden"
                    aria-label="Seleccionar archivo para importar"
                    onChange={(e) => void onPick(e)}
                  />
                  <UploadSimple size={16} aria-hidden="true" />
                  Elegir archivo
                </label>
                {fileName && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-body-sm text-muted hover:text-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                  >
                    <X size={16} aria-hidden="true" /> {fileName}
                  </button>
                )}
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm text-muted">
                    {okCount} {okCount === 1 ? 'lista' : 'listas'} para importar, {errorCount} con error
                  </p>
                </div>
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {rows.map((r, i) => (
                    <li
                      key={`${r.lineNo}-${i}`}
                      className={`flex items-start gap-2 rounded-lg border p-2 text-body-sm ${
                        r.status === 'ok' ? 'border-border bg-card' : 'border-danger-500/40 bg-danger-500/5'
                      }`}
                    >
                      <span className="shrink-0 pt-0.5">
                        {r.status === 'ok' ? (
                          <span className="text-success-700">✓</span>
                        ) : (
                          <WarningCircle size={16} className="text-danger-700" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {String(r.product ?? r.medication ?? r.full_name ?? '(sin nombre)')}
                        </p>
                        {r.reason && <p className="text-caption text-danger-700">{r.reason}</p>}
                      </div>
                      <span className="shrink-0 text-caption text-muted">L{r.lineNo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-3 text-caption text-muted">
                Selecciona un archivo CSV o TXT para previsualizar las filas antes de importar.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void doImport()} loading={importing} disabled={okCount === 0}>
                {importing ? 'Importando…' : `Importar ${okCount}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
