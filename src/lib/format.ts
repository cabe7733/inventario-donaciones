const nf = new Intl.NumberFormat('es-419', { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function toLocalDateOnly(d: Date): string {
  return toLocalDateKey(d.toISOString());
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-419', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-419', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(key: string): string {
  // key: YYYY-MM-DD local
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-419', { day: 'numeric', month: 'short' });
}

export function todayKey(): string {
  return toLocalDateKey(new Date().toISOString());
}

export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}