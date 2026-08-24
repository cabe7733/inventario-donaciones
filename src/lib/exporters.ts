import Papa from 'papaparse';

// Descarga un CSV UTF-8 con BOM (Excel lo abre con acentos correctos).
export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = Papa.unparse(rows, { delimiter: ';' });
  // eslint-disable-next-line no-irregular-whitespace
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
