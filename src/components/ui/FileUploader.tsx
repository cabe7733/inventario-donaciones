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
        className={clsx(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer',
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-primary-300',
        )}
      >
        <Upload size={32} className="text-muted" />
        <p className="text-body text-muted">
          Arrastrá un archivo CSV aquí o <span className="text-primary-600 font-medium">seleccioná uno</span>
        </p>
        <p className="text-caption text-muted">Solo archivos .csv</p>
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
        <FileText size={20} className="text-muted" />
        <span className="text-body font-medium">{file.name}</span>
        <button type="button" onClick={reset} className="text-muted hover:text-fg">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-4 text-caption">
        <span>{parsedRows.length} filas detectadas</span>
        {validCount > 0 && <span className="text-success-700">{validCount} válidas</span>}
        {invalidCount > 0 && <span className="text-danger-700">{invalidCount} con errores</span>}
      </div>

      {parsedRows.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border bg-neutral-50 dark:bg-neutral-800">
                  {expectedColumns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className={clsx('border-b border-border', !row.isValid && 'bg-danger-50 dark:bg-danger-900/20')}>
                    {expectedColumns.map((col) => (
                      <td key={col} className="px-3 py-2">{row.data[col]}</td>
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
            <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
              {isImporting ? 'Importando...' : `Importar ${validCount} filas`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
