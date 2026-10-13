// Shared by Angular's saver and the standalone offline reader.
export const DB_NAME = 'suttru-offline-v1';
export const EPOCH_KEY = 'suttru-offline-session';
export function session() {
  const user = JSON.parse(localStorage.getItem('tripmate_user') || 'null');
  if (!user?.id || !localStorage.getItem('tripmate_access_token')) throw new Error('Sign in online before saving or opening offline trips.');
  let epoch = localStorage.getItem(EPOCH_KEY);
  if (!epoch) { epoch = crypto.randomUUID(); localStorage.setItem(EPOCH_KEY, epoch); }
  return { owner: user.id, epoch };
}
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readPacks() {
  const identity = session(), db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readonly');
    const request = tx.objectStore('packs').getAll();
    tx.oncomplete = () => {
      db.close();
      try {
        const current = session();
        if (current.owner !== identity.owner || current.epoch !== identity.epoch) throw new Error('Session changed.');
        resolve(request.result.filter(p => p.owner === identity.owner && p.epoch === identity.epoch));
      } catch (error) { reject(error); }
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function savePack(pack) {
  const current = session();
  if (pack.owner !== current.owner || pack.epoch !== current.epoch) throw new Error('Session changed. Save again after signing in.');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite'), store = tx.objectStore('packs');
    const request = store.getAll();
    let failure;
    request.onsuccess = () => {
      const size = request.result.filter(p => p.key !== pack.key).reduce((n, p) => n + p.bytes, pack.bytes);
      if (size > 50 * 1024 * 1024) { failure = new Error('Offline storage limit is 50 MB. Remove a saved trip first.'); tx.abort(); }
      else store.put(pack);
    };
    tx.oncomplete = () => {
      db.close();
      try {
        const latest = session();
        if (latest.owner !== pack.owner || latest.epoch !== pack.epoch) throw new Error('Session changed; this pack is not available.');
        resolve();
      } catch (error) { reject(error); }
    };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error('Storage unavailable.')); };
  });
}
export async function removePack(key) {
  const packs = await readPacks();
  if (!packs.some(p => p.key === key)) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    tx.objectStore('packs').delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function clearOffline() {
  // Invalidate immediately, even if a write is in flight or IndexedDB is unavailable.
  localStorage.setItem(EPOCH_KEY, crypto.randomUUID());
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    tx.objectStore('packs').clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
