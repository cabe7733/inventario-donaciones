import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { db } from '../../db';
import { deviceId, newId, nowISO } from '../../lib/ids';
import { addCategory, addUnit } from '../../lib/catalog';
import type { Product } from '../../db/types';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface ParsedRow {
  raw: string[];
  product: string;
  category: string;
  qty: number;
  unit: string | null;
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
        if (line[i + 1] === quote) {
          cur += ch;
          i++;
        } else {
          quote = null;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ';' || ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
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
  if (first === 'producto' || first === 'product' || first === 'nombre' || first === 'name') {
    return cells.some((c) => c.toLowerCase().includes('cant'));
  }
  return false;
}

function parseFile(text: string): ParsedRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  const sep = detectSeparator(lines);
  const split = (l: string) => (sep === '\t' ? l.split('\t') : splitCsvLine(l));

  let headerCols: string[] | null = null;
  let headerIdx = 0;
  const firstCells = split(lines[0]);
  if (isHeaderRow(firstCells)) {
    headerCols = firstCells.map((c) => c.toLowerCase());
    headerIdx = 1;
  }

  const rows: ParsedRow[] = [];
  for (let i = headerIdx; i < lines.length; i++) {
    const cells = split(lines[i]);
    let product = '';
    let category = '';
    let qtyStr = '';
    let unit: string | null = null;

    if (headerCols) {
      const get = (...names: string[]) => {
        for (const n of names) {
          const idx = headerCols!.indexOf(n);
          if (idx >= 0) return cells[idx] ?? '';
        }
        return '';
      };
      product = get('producto', 'product', 'nombre', 'name');
      category = get('categoria', 'categoría', 'category');
      qtyStr = get('cantidad', 'qty', 'stock', 'cantidad en stock');
      unit = get('unidad', 'unit') || null;
    } else {
      product = cells[0] ?? '';
      category = cells[1] ?? '';
      qtyStr = cells[2] ?? '';
      unit = cells[3] || null;
    }

    const qty = Number.parseInt(qtyStr, 10);
    rows.push({
      raw: cells,
      product: product.trim(),
      category: category.trim(),
      qty: Number.isFinite(qty) ? qty : NaN,
      unit: unit ? unit.trim() : null,
      lineNo: i + 1,
    });
  }
  return rows;
}

export function ImportarProductosPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    created: number;
    productsCreated: number;
    productsUpdated: number;
  } | null>(null);

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
      if (!r.product) return { ...r, status: 'error', reason: t('import.error.producto') };
      if (!r.category) return { ...r, status: 'error', reason: t('import.error.categoria') };
      if (!Number.isFinite(r.qty) || r.qty < 0)
        return { ...r, status: 'error', reason: t('import.error.cantidad') };
      return { ...r, status: 'ok' };
    });
    setRows(preview);
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const sample = 'producto;categoria;cantidad en stock;unidad\nArroz 1 kg;Alimentos;25;bolsa\nLeche entera;Lácteos;40;caja\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const okRows = rows.filter((r) => r.status === 'ok');
    if (okRows.length === 0) return;
    const notaInicial = t('import.movementNote');
    setImporting(true);
    try {
      const stats = await db.transaction(
        'rw',
        db.products,
        db.categories,
        db.units,
        db.movements,
        async () => {
          const catByName = new Map<string, string>();
          const unitByName = new Map<string, string>();
          const productByName = new Map<string, string>();

          const existingCats = await db.categories.where('_deleted').equals(0).toArray();
          for (const c of existingCats) {
            if (c.scope === 'product') catByName.set(c.name.toLowerCase(), c.id);
          }
          const existingUnits = await db.units.where('_deleted').equals(0).toArray();
          for (const u of existingUnits) {
            if (u.scope === 'product') unitByName.set(u.name.toLowerCase(), u.id);
          }
          const existingProducts = await db.products.where('_deleted').equals(0).toArray();
          for (const p of existingProducts) {
            productByName.set(p.name.toLowerCase(), p.id);
          }

          let nextCatOrder = existingCats.filter((c) => c.scope === 'product').length;
          let createdCats = 0;
          let productsCreated = 0;
          let productsUpdated = 0;
          const now = nowISO();
          const did = deviceId();

          for (const r of okRows) {
            const catKey = r.category.toLowerCase();
            let catId = catByName.get(catKey);
            if (!catId) {
              catId = await addCategory(r.category, 'product', 'box', nextCatOrder++);
              catByName.set(catKey, catId);
              createdCats++;
            }

            let unitId: string;
            const unitName = r.unit ?? 'Unidad';
            const unitKey = unitName.toLowerCase();
            const cachedUnit = unitByName.get(unitKey);
            if (cachedUnit) {
              unitId = cachedUnit;
            } else {
              unitId = await addUnit(unitName, 'product');
              unitByName.set(unitKey, unitId);
            }

            const productKey = r.product.toLowerCase();
            const existingProductId = productByName.get(productKey);
            let productId: string;

            if (existingProductId) {
              // El producto ya existe: no se duplica, se actualiza su categoría/unidad
              // y se suma la cantidad importada al stock actual mediante un movimiento.
              productId = existingProductId;
              const existing = await db.products.get(existingProductId);
              if (existing) {
                await db.products.update(existingProductId, {
                  categoryId: catId,
                  unitId,
                  totalStock: existing.totalStock + r.qty,
                  updatedAt: now,
                  _version: existing._version + 1,
                  _syncedAt: null,
                });
              }
              productsUpdated++;
            } else {
              productId = newId();
              const row: Product = {
                id: productId,
                name: r.product,
                aliases: [],
                categoryId: catId,
                unitId,
                minStock: null,
                totalStock: r.qty,
                isActive: 1,
                createdAt: now,
                updatedAt: now,
                _version: 1,
                _deleted: 0,
                _syncedAt: null,
                _deviceId: did,
                _clientUuid: newId(),
              };
              await db.products.add(row);
              productByName.set(productKey, productId);
              productsCreated++;
            }

            if (r.qty > 0) {
              await db.movements.add({
                id: newId(),
                kind: 'entrada',
                itemType: 'product',
                itemId: productId,
                qty: r.qty,
                unitId,
                loteId: null,
                fecha: now,
                operadorId: null,
                nota: notaInicial,
                createdAt: now,
                _version: 1,
                _deleted: 0,
                _syncedAt: null,
                _deviceId: did,
                _clientUuid: newId(),
              });
            }
          }
          return {
            ok: okRows.length,
            created: createdCats,
            productsCreated,
            productsUpdated,
          };
        },
      );

      setResult(stats);
      toast.push({ message: t('import.done', { count: stats.ok }), tone: 'success' });
    } catch (e) {
      toast.push({
        message: e instanceof Error ? e.message : t('common.error'),
        tone: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <Link to="/mas" className="text-caption text-muted hover:text-primary-700">
          ← {t('nav.mas')}
        </Link>
        <h1 className="text-h2">{t('import.title')}</h1>
        <p className="text-body-sm text-muted">{t('import.subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <p className="text-body-sm text-muted">{t('import.help')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            {t('import.template')}
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-body-sm font-semibold text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => void onPick(e)}
            />
            {t('import.pick')}
          </label>
          {fileName && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-body-sm text-muted hover:text-danger-700"
            >
              <XCircle size={16} aria-hidden="true" /> {fileName}
            </button>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-muted">
              {t('import.preview', { ok: String(summary.ok), skipped: String(summary.skipped) })}
            </p>
            <Button
              size="sm"
              onClick={() => void doImport()}
              disabled={importing || summary.ok === 0}
            >
              {t('import.importBtn', { count: summary.ok })}
            </Button>
          </div>

          <ul className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li
                key={`${r.lineNo}-${i}`}
                className={`flex items-start gap-2 rounded-lg border p-2 text-body-sm ${
                  r.status === 'ok'
                    ? 'border-border bg-card'
                    : 'border-danger-500/40 bg-danger-500/5'
                }`}
              >
                <span className="shrink-0 pt-0.5">
                  {r.status === 'ok' ? (
                    <CheckCircle size={16} className="text-success-700" aria-hidden="true" />
                  ) : (
                    <WarningCircle size={16} className="text-danger-700" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.product || '(sin nombre)'} <span className="text-muted">— {r.category}</span>
                  </p>
                  <p className="text-caption text-muted">
                    {t('import.rowQty', { qty: String(r.qty) })}
                    {r.unit && ` · ${r.unit}`}
                  </p>
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
          {t('import.summary', {
            ok: String(result.ok),
            cats: String(result.created),
            newProducts: String(result.productsCreated),
            updatedProducts: String(result.productsUpdated),
          })}
        </p>
      )}
    </div>
  );
}