import Fuse from 'fuse.js';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Búsqueda fuzzy con acentos insensibles. getFn normaliza cada campo al comparar.
export function createSearcher<T>(items: T[], keys: string[]) {
  return new Fuse<T>(items, {
    keys,
    threshold: 0.35,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    // ponytail: patrón simplificado sobre objetos planos; si se anidan, se reemplaza getFn
    getFn: (item, path) => {
      const v = (item as Record<string, unknown>)[String(path)];
      if (Array.isArray(v)) return v.map((x) => normalize(String(x)));
      return normalize(String(v ?? ''));
    },
  });
}

export function searchWith<T>(items: T[], keys: string[], query: string): T[] {
  const q = query.trim();
  if (!q) return items;
  return createSearcher(items, keys)
    .search(q)
    .map((r) => r.item);
}