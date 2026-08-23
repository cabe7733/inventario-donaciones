export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO(): string {
  return new Date().toISOString();
}

const DEVICE_ID_KEY = 'donario.deviceId';

// ponytail: persistent per-browser device id. Falls back to a fresh UUID if storage
// is unavailable (SSR, private mode, quota). The schema's `device_id` is `text`, so
// the UUID is fine as a string.
let cached: string | null = null;
export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
  } catch {
    // localStorage may be blocked; fall through to fresh id
  }
  const fresh = newId();
  try {
    localStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    // ignore
  }
  cached = fresh;
  return fresh;
}
