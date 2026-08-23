import { describe, it, expect } from 'vitest';
import {
  splitCsvLine,
  detectSeparator,
  isProductHeaderRow,
  parseProductFile,
  isVolunteerHeaderRow,
  parseVolunteerFile,
} from '../lib/parseCsv';

describe('splitCsvLine', () => {
  it('splits comma-separated values', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('splits semicolon-separated values', () => {
    expect(splitCsvLine('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace', () => {
    expect(splitCsvLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(splitCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('handles escaped quotes', () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', 'c']);
  });

  it('handles single-quoted fields', () => {
    expect(splitCsvLine("'a;b',c")).toEqual(['a;b', 'c']);
  });

  it('handles empty fields', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('detectSeparator', () => {
  it('detects semicolon', () => {
    expect(detectSeparator(['a;b;c'])).toBe(';');
  });

  it('detects comma', () => {
    expect(detectSeparator(['a,b,c'])).toBe(',');
  });

  it('detects tab', () => {
    expect(detectSeparator(['a\tb\tc'])).toBe('\t');
  });

  it('skips comment lines', () => {
    expect(detectSeparator(['# comment', 'a;b;c'])).toBe(';');
  });

  it('skips empty lines', () => {
    expect(detectSeparator(['', 'a,b,c'])).toBe(',');
  });

  it('defaults to comma', () => {
    expect(detectSeparator(['abc'])).toBe(',');
  });
});

describe('isProductHeaderRow', () => {
  it('detects Spanish header', () => {
    expect(isProductHeaderRow(['producto', 'categoria', 'cantidad'])).toBe(true);
  });

  it('detects English header', () => {
    expect(isProductHeaderRow(['product', 'category', 'qty'])).toBe(true);
  });

  it('detects header with stock keyword', () => {
    expect(isProductHeaderRow(['nombre', 'categoría', 'cantidad en stock'])).toBe(true);
  });

  it('rejects non-header rows', () => {
    expect(isProductHeaderRow(['Arroz', 'Alimentos', '25'])).toBe(false);
  });

  it('rejects short rows', () => {
    expect(isProductHeaderRow(['producto', 'categoria'])).toBe(false);
  });
});

describe('parseProductFile', () => {
  it('parses CSV with header', () => {
    const csv = 'producto;categoria;cantidad;unidad\nArroz;Alimentos;25;bolsa\n';
    const rows = parseProductFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe('Arroz');
    expect(rows[0].category).toBe('Alimentos');
    expect(rows[0].qty).toBe(25);
    expect(rows[0].unit).toBe('bolsa');
    expect(rows[0].lineNo).toBe(2);
  });

  it('parses CSV without header', () => {
    const csv = 'Arroz;Alimentos;25;bolsa\n';
    const rows = parseProductFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe('Arroz');
    expect(rows[0].qty).toBe(25);
    expect(rows[0].lineNo).toBe(1);
  });

  it('parses comma-separated values', () => {
    const csv = 'Arroz,Alimentos,25,bolsa\n';
    const rows = parseProductFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe('Arroz');
  });

  it('skips empty lines and comments', () => {
    const csv = '# comment\n\nArroz;Alimentos;25\n\nLeche;Lácteos;40\n';
    const rows = parseProductFile(csv);
    expect(rows).toHaveLength(2);
  });

  it('handles missing unit', () => {
    const csv = 'Arroz;Alimentos;25\n';
    const rows = parseProductFile(csv);
    expect(rows[0].unit).toBeNull();
  });

  it('returns empty array for empty input', () => {
    expect(parseProductFile('')).toEqual([]);
  });

  it('returns empty array for only comments', () => {
    expect(parseProductFile('# just a comment\n# another')).toEqual([]);
  });
});

describe('isVolunteerHeaderRow', () => {
  it('detects nombre header', () => {
    expect(isVolunteerHeaderRow(['nombre', 'telefono', 'email'])).toBe(true);
  });

  it('detects name header', () => {
    expect(isVolunteerHeaderRow(['name', 'phone'])).toBe(true);
  });

  it('detects full_name header', () => {
    expect(isVolunteerHeaderRow(['full_name', 'phone'])).toBe(true);
  });

  it('rejects non-header rows', () => {
    expect(isVolunteerHeaderRow(['Juan Pérez', '555-1234'])).toBe(false);
  });
});

describe('parseVolunteerFile', () => {
  it('parses CSV with header', () => {
    const csv = 'nombre;telefono;email;documento;habilidades;disponibilidad\nJuan Pérez;555-1234;juan@email.com;12345678;cocina;tiempo completo\n';
    const rows = parseVolunteerFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Juan Pérez');
    expect(rows[0].phone).toBe('555-1234');
    expect(rows[0].email).toBe('juan@email.com');
    expect(rows[0].id_number).toBe('12345678');
    expect(rows[0].skills).toBe('cocina');
    expect(rows[0].availability).toBe('tiempo completo');
  });

  it('parses CSV without header', () => {
    const csv = 'Juan Pérez;555-1234;juan@email.com\n';
    const rows = parseVolunteerFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Juan Pérez');
    expect(rows[0].phone).toBe('555-1234');
    expect(rows[0].email).toBe('juan@email.com');
  });

  it('handles missing optional fields', () => {
    const csv = 'Juan Pérez\n';
    const rows = parseVolunteerFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Juan Pérez');
    expect(rows[0].phone).toBeNull();
    expect(rows[0].email).toBeNull();
  });

  it('skips empty lines', () => {
    const csv = 'Juan Pérez;555-1234\n\nMaría García;555-5678\n';
    const rows = parseVolunteerFile(csv);
    expect(rows).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(parseVolunteerFile('')).toEqual([]);
  });
});
