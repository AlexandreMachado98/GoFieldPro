const DB_NAME = 'geofield_app_state_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

function openStateDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function resolveKey(key: string, userId?: string | null): string {
  if (userId) {
    return `${userId}__${key}`;
  }
  return key;
}

export async function saveAppState(key: string, value: any, userId?: string | null): Promise<void> {
  try {
    const finalKey = resolveKey(key, userId);
    const db = await openStateDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, finalKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to save to IndexedDB', e);
  }
}

export async function loadAppState<T>(key: string, userId?: string | null): Promise<T | null> {
  try {
    const finalKey = resolveKey(key, userId);
    const db = await openStateDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(finalKey);
      request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to load from IndexedDB', e);
    return null;
  }
}

export async function clearUserAppState(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const db = await openStateDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      const prefix = `${userId}__`;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const keyStr = String(cursor.key);
          if (keyStr.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to clear user state from IndexedDB', e);
  }
}

export async function purgeLegacyAppState(): Promise<void> {
  try {
    const db = await openStateDB();
    const legacyKeys = ['geofield_layers', 'geofield_projects', 'geofield_waypoints', 'geofield_savedTracks'];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const k of legacyKeys) {
        store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to purge legacy app state', e);
  }
}

/**
 * Checkpoint and Recovery for Active Track Recording
 */
const ACTIVE_TRACK_KEY = 'geofield_active_track_draft';

export async function saveActiveTrackDraft(track: any, userId?: string | null): Promise<void> {
  if (!track) {
    await clearActiveTrackDraft(userId);
    return;
  }
  await saveAppState(ACTIVE_TRACK_KEY, track, userId);
}

export async function loadActiveTrackDraft<T>(userId?: string | null): Promise<T | null> {
  return await loadAppState<T>(ACTIVE_TRACK_KEY, userId);
}

export async function clearActiveTrackDraft(userId?: string | null): Promise<void> {
  try {
    const finalKey = resolveKey(ACTIVE_TRACK_KEY, userId);
    const db = await openStateDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(finalKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to clear active track draft from IndexedDB', e);
  }
}

