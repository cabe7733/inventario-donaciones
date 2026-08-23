import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { importVolunteersFromRows } from '../../lib/db';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface ParsedRow {
  raw: string[];
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  skills: string | null;
  availability: string | null;
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
  if (cells.length < 2) return false;
  const first = cells[0].toLowerCase();
  if (first === 'nombre' || first === 'name' || first === 'full_name' || first === 'fullname') {
    return true;
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
    let full_name = '', phone: string | null = null, email: string | null = null, id_number: string | null = null, skills: string | null = null, availability: string | null = null;

    if (headerCols) {
      const get = (...names: string[]) => { for (const n of names) { const idx = headerCols!.indexOf(n); if (idx >= 0) return cells[idx] ?? ''; } return ''; };
      full_name = get('nombre', 'name', 'full_name', 'fullname');
      phone = get('telefono', 'teléfono', 'phone') || null;
      email = get('email', 'correo') || null;
      id_number = get('documento', 'id_number', 'cedula', 'cédula', 'dni') || null;
      skills = get('habilidades', 'skills') || null;
      availability = get('disponibilidad', 'availability') || null;
    } else {
      full_name = cells[0] ?? '';
      phone = cells[1] || null;
      email = cells[2] || null;
      id_number = cells[3] || null;
      skills = cells[4] || null;
      availability = cells[5] || null;
    }
    rows.push({ raw: cells, full_name: full_name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, id_number: id_number?.trim() || null, skills: skills?.trim() || null, availability: availability?.trim() || null, lineNo: i + 1 });
  }
  return rows;
}

export function ImportarVoluntariosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { centerId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; created: number; skipped: number } | null>(null);

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
      if (!r.full_name) return { ...r, status: 'error', reason: 'Falta nombre del voluntario' };
      return { ...r, status: 'ok' };
    });
    setRows(preview);
  };

  const reset = () => { setRows([]); setFileName(''); setResult(null); if (fileRef.current) fileRef.current.value = ''; };

  const downloadTemplate = () => {
    const sample = 'nombre;telefono;email;documento;habilidades;disponibilidad\nJuan Pérez;555-1234;juan@email.com;12345678;cocina,logística;tiempo completo\nMaría García;555-5678;maria@email.com;87654321;medicina;fines de semana\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-voluntarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const okRows = rows.filter((r) => r.status === 'ok');
    if (okRows.length === 0 || !centerId) return;
    setImporting(true);
    try {
      const stats = await importVolunteersFromRows(okRows.map((r) => ({
        full_name: r.full_name,
        phone: r.phone ?? undefined,
        email: r.email ?? undefined,
        id_number: r.id_number ?? undefined,
        skills: r.skills ?? undefined,
        availability: r.availability ?? undefined,
      })), centerId);
      setResult(stats);
      toast.push({ message: t('import.done', { count: stats.ok }), tone: 'success' });
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
        <h1 className="text-h2">Importar Voluntarios</h1>
        <p className="text-body-sm text-muted">Carga un archivo CSV con los datos de tus voluntarios.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <p className="text-body-sm text-muted">El archivo debe contener: nombre, teléfono, email, documento, habilidades, disponibilidad.</p>
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
            <Button size="sm" onClick={() => void doImport()} disabled={importing || summary.ok === 0 || !centerId}>{t('import.importBtn', { count: summary.ok })}</Button>
          </div>
          <ul className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li key={`${r.lineNo}-${i}`} className={`flex items-start gap-2 rounded-lg border p-2 text-body-sm ${r.status === 'ok' ? 'border-border bg-card' : 'border-danger-500/40 bg-danger-500/5'}`}>
                <span className="shrink-0 pt-0.5">
                  {r.status === 'ok' ? <CheckCircle size={16} className="text-success-700" aria-hidden="true" /> : <WarningCircle size={16} className="text-danger-700" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.full_name || '(sin nombre)'}{r.email && <span className="text-muted"> — {r.email}</span>}</p>
                  <p className="text-caption text-muted">{r.phone && `${r.phone}`}{r.id_number && ` · Doc: ${r.id_number}`}{r.availability && ` · ${r.availability}`}</p>
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
          Importación completada: {result.ok} voluntarios procesados, {result.created} creados, {result.skipped} omitidos.
        </p>
      )}
    </div>
  );
}
