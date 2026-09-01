import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X } from '@phosphor-icons/react';
import Papa from 'papaparse';
import { clsx } from 'clsx';
import { Button } from './Button';

interface FileUploaderProps {
  expectedColumns: string[];
  onImport: (rows: Record<string, unknown>[]) => Promise<void>;
}

interface ParsedRow {
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

export function FileUploader({ expectedColumns, onImport }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows: ParsedRow[] = (results.data as Record<string, string>[]).map((row) => {
            const errors: string[] = [];
            expectedColumns.forEach((col) => {
              if (!row[col] && row[col] !== '0') {
                errors.push(`Falta columna: ${col}`);
              }
            });
            return { data: row, errors, isValid: errors.length === 0 };
          });
          setParsedRows(rows);
        },
      });
    },
    [expectedColumns],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      processFile(droppedFile);
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid).map((r) => r.data);
    setIsImporting(true);
    try {
      await onImport(validRows);
      setFile(null);
      setParsedRows([]);
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  if (!file) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Arrastrá un archivo CSV aquí o seleccioná uno"
        className={clsx(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
          dragOver ? 'border-accent-500 bg-accent-50' : 'border-border hover:border-accent-300',
        )}
      >
        <Upload size={32} className="text-text-tertiary" />
        <p className="text-body text-text-secondary">
          Arrastrá un archivo CSV aquí o <span className="text-accent-600 font-semibold">seleccioná uno</span>
        </p>
        <p className="text-caption text-text-tertiary">Solo archivos .csv</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <FileText size={20} className="text-text-secondary" />
        <span className="text-body font-medium text-fg">{file.name}</span>
        <button type="button" onClick={reset} className="ml-auto text-text-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded-lg" aria-label="Eliminar archivo">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-4 text-caption">
        <span className="text-text-secondary">{parsedRows.length} filas detectadas</span>
        {validCount > 0 && <span className="text-success-700 font-medium">{validCount} válidas</span>}
        {invalidCount > 0 && <span className="text-danger-700 font-medium">{invalidCount} con errores</span>}
      </div>

      {parsedRows.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border bg-neutral-50">
                  {expectedColumns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold text-text-secondary">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className={clsx('border-b border-border last:border-b-0', !row.isValid && 'bg-danger-50')}>
                    {expectedColumns.map((col) => (
                      <td key={col} className="px-3 py-2 text-fg">{row.data[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button onClick={handleImport} loading={isImporting} disabled={validCount === 0}>
              {isImporting ? 'Importando...' : `Importar ${validCount} filas`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
