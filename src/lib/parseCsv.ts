export function splitCsvLine(line: string): string[] {
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

export function detectSeparator(sample: string[]): string {
  for (const line of sample) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    if (s.includes(';')) return ';';
    if (s.includes('\t')) return '\t';
    if (s.includes(',')) return ',';
  }
  return ',';
}

export interface ParsedProductRow {
  raw: string[];
  product: string;
  category: string;
  qty: number;
  unit: string | null;
  lineNo: number;
}

export function isProductHeaderRow(cells: string[]): boolean {
  if (cells.length < 3) return false;
  const first = cells[0].toLowerCase();
  if (first === 'producto' || first === 'product' || first === 'nombre' || first === 'name') {
    return cells.some((c) => {
      const lc = c.toLowerCase();
      return lc.includes('cant') || lc === 'qty' || lc === 'stock';
    });
  }
  return false;
}

export function parseProductFile(text: string): ParsedProductRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const sep = detectSeparator(lines);
  const split = (l: string) => (sep === '\t' ? l.split('\t') : splitCsvLine(l));

  let headerCols: string[] | null = null;
  let headerIdx = 0;
  const firstCells = split(lines[0]);
  if (isProductHeaderRow(firstCells)) { headerCols = firstCells.map((c) => c.toLowerCase()); headerIdx = 1; }

  const rows: ParsedProductRow[] = [];
  for (let i = headerIdx; i < lines.length; i++) {
    const cells = split(lines[i]);
    let product = '', category = '', qtyStr = '', unit: string | null = null;
    if (headerCols) {
      const get = (...names: string[]) => { for (const n of names) { const idx = headerCols!.indexOf(n); if (idx >= 0) return cells[idx] ?? ''; } return ''; };
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
    rows.push({ raw: cells, product: product.trim(), category: category.trim(), qty: Number.isFinite(qty) ? qty : NaN, unit: unit?.trim() || null, lineNo: i + 1 });
  }
  return rows;
}

export interface ParsedVolunteerRow {
  raw: string[];
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  skills: string | null;
  availability: string | null;
  lineNo: number;
}

export function isVolunteerHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const first = cells[0].toLowerCase();
  return first === 'nombre' || first === 'name' || first === 'full_name' || first === 'fullname';
}

export function parseVolunteerFile(text: string): ParsedVolunteerRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const sep = detectSeparator(lines);
  const split = (l: string) => (sep === '\t' ? l.split('\t') : splitCsvLine(l));

  let headerCols: string[] | null = null;
  let headerIdx = 0;
  const firstCells = split(lines[0]);
  if (isVolunteerHeaderRow(firstCells)) { headerCols = firstCells.map((c) => c.toLowerCase()); headerIdx = 1; }

  const rows: ParsedVolunteerRow[] = [];
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
