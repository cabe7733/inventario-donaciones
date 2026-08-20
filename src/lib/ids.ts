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

const DEVICE_KEY = 'donario.deviceId';

export function deviceId(): string {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) return stored;
  const id = newId();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}
