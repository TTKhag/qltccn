import { AppData } from './types';

const DB = 'pfm-db', STORE = 'kv', KEY = 'app-data';
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
export async function loadData(): Promise<AppData | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(KEY);
    q.onsuccess = () => res((q.result as AppData) ?? null);
    q.onerror = () => rej(q.error);
  });
}
export async function saveData(d: AppData): Promise<void> {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(d, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
