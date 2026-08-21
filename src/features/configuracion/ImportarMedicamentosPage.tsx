import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { importMedicationsFromRows } from '../../lib/db';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface ParsedRow {
  raw: string[];
  medication: string;
  category: string;
  qty: number;
  unit: string | null;
  presentation: string | null;
  lot: string | null;
  expiry: string | null;
  lineNo: number;
}

type RowStatus = 'ok' | 'error' | 'skipped';

interface PreviewRow extends ParsedRow {
  status: RowStatus;
  reason?: string;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        if (line[i + 1] === quote) { cur += ch; i++; } else { quote = null; }
      } else { cur += ch; }
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ';' || ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectSeparator(sample: string[]): string {
  for (const line of sample) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    if (s.includes(';')) return ';';
    if (s.includes('\t')) return '\t';
    if (s.includes(',')) return ',';
  }
  return ',';
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 3) return false;
  const first = cells[0].toLowerCase();
  if (first === 'medicamento' || first === 'medication' || first === 'nombre' || first === 'name') {
    return cells.some((c) => c.toLowerCase().includes('cant'));
  }
  return false;
}

function parseFile(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const sep = detectSeparator(lines);
  const split = (l: string) => (sep === '\t' ? l.split('\t') : splitCsvLine(l));

  let headerCols: string[] | null = null;
  let headerIdx = 0;
  const firstCells = split(lines[0]);
  if (isHeaderRow(firstCells)) { headerCols = firstCells.map((c) => c.toLowerCase()); headerIdx = 1; }

  const rows: ParsedRow[] = [];
  for (let i = headerIdx; i < lines.length; i++) {
    const cells = split(lines[i]);
    let medication = '', category = '', qtyStr = '', unit: string | null = null, presentation: string | null = null, lot: string | null = null, expiry: string | null = null;

    if (headerCols) {
      const get = (...names: string[]) => { for (const n of names) { const idx = headerCols!.indexOf(n); if (idx >= 0) return cells[idx] ?? ''; } return ''; };
      medication = get('medicamento', 'medication', 'nombre', 'name');
      category = get('categoria', 'categoría', 'category');
      qtyStr = get('cantidad', 'qty', 'stock');
      unit = get('unidad', 'unit') || null;
      presentation = get('presentacion', 'presentación', 'presentation') || null;
      lot = get('lote', 'lot') || null;
      expiry = get('vencimiento', 'expiry', 'expiracion', 'expiración') || null;
    } else {
      medication = cells[0] ?? '';
      category = cells[1] ?? '';
      qtyStr = cells[2] ?? '';
      unit = cells[3] || null;
      presentation = cells[4] || null;
      lot = cells[5] || null;
      expiry = cells[6] || null;
    }
    const qty = Number.parseInt(qtyStr, 10);
    rows.push({ raw: cells, medication: medication.trim(), category: category.trim(), qty: Number.isFinite(qty) ? qty : NaN, unit: unit?.trim() || null, presentation: presentation?.trim() || null, lot: lot?.trim() || null, expiry: expiry?.trim() || null, lineNo: i + 1 });
  }
  return rows;
}

export function ImportarMedicamentosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; createdCats: number; medsCreated: number; medsUpdated: number; lotsCreated: number } | null>(null);

  const summary = useMemo(() => {
    const ok = rows.filter((r) => r.status === 'ok').length;
    const skipped = rows.filter((r) => r.status !== 'ok').length;
    return { ok, skipped };
  }, [rows]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const parsed = parseFile(text);
    const preview: PreviewRow[] = parsed.map((r) => {
      if (!r.medication) return { ...r, status: 'error', reason: 'Falta nombre del medicamento' };
      if (!r.category) return { ...r, status: 'error', reason: 'Falta categoría' };
      if (!Number.isFinite(r.qty) || r.qty < 0) return { ...r, status: 'error', reason: 'Cantidad inválida' };
      return { ...r, status: 'ok' };
    });
    setRows(preview);
  };

  const reset = () => { setRows([]); setFileName(''); setResult(null); if (fileRef.current) fileRef.current.value = ''; };

  const downloadTemplate = () => {
    const sample = 'medicamento;categoria;cantidad;unidad;presentacion;lote;vencimiento\nAmoxicilina 500mg;Antibióticos;100;caja;20 comprimidos;L2408A;2025-12-31\nIbuprofeno 400mg;Antiinflamatorios;50;blister;10 comprimidos;I2409B;\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-medicamentos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const okRows = rows.filter((r) => r.status === 'ok');
    if (okRows.length === 0) return;
    setImporting(true);
    try {
      const stats = await importMedicationsFromRows(okRows.map((r) => ({
        medication: r.medication,
        category: r.category,
        qty: r.qty,
        unit: r.unit ?? undefined,
        presentation: r.presentation ?? undefined,
        lot: r.lot ?? undefined,
        expiry: r.expiry ?? undefined,
      })));
      setResult(stats);
      toast.push({ message: `Importación completada: ${stats.ok} medicamentos`, tone: 'success' });
    } catch (e) {
      toast.push({ message: e instanceof Error ? e.message : t('common.error'), tone: 'error' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <Link to="/mas" className="text-caption text-muted hover:text-primary-700">← {t('nav.mas')}</Link>
        <h1 className="text-h2">{t('importMed.title')}</h1>
        <p className="text-body-sm text-muted">{t('importMed.subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <p className="text-body-sm text-muted">{t('importMed.help')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>{t('import.template')}</Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-body-sm font-semibold text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => void onPick(e)} />
            {t('import.pick')}
          </label>
          {fileName && (
            <button type="button" onClick={reset} className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-body-sm text-muted hover:text-danger-700">
              <XCircle size={16} aria-hidden="true" /> {fileName}
            </button>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-muted">{t('import.preview', { ok: String(summary.ok), skipped: String(summary.skipped) })}</p>
            <Button size="sm" onClick={() => void doImport()} disabled={importing || summary.ok === 0}>{t('import.importBtn', { count: summary.ok })}</Button>
          </div>
          <ul className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li key={`${r.lineNo}-${i}`} className={`flex items-start gap-2 rounded-lg border p-2 text-body-sm ${r.status === 'ok' ? 'border-border bg-card' : 'border-danger-500/40 bg-danger-500/5'}`}>
                <span className="shrink-0 pt-0.5">
                  {r.status === 'ok' ? <CheckCircle size={16} className="text-success-700" aria-hidden="true" /> : <WarningCircle size={16} className="text-danger-700" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.medication || '(sin nombre)'} <span className="text-muted">— {r.category}</span></p>
                  <p className="text-caption text-muted">{t('import.rowQty', { qty: String(r.qty) })}{r.unit && ` · ${r.unit}`}{r.lot && ` · Lote: ${r.lot}`}</p>
                  {r.reason && <p className="text-caption text-danger-700">{r.reason}</p>}
                </div>
                <span className="shrink-0 text-caption text-muted">L{r.lineNo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <p className="text-body-sm text-success-700">
          Listo. {result.ok} filas importadas, {result.createdCats} categorías creadas, {result.medsCreated} medicamentos nuevos, {result.medsUpdated} actualizados, {result.lotsCreated} lotes creados.
        </p>
      )}
    </div>
  );
}
