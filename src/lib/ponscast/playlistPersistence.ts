import type { PlaylistSnapshot } from '@/stores/useFileStreamingStore';

const DB_NAME = 'PonsCastPlaylistCache';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';
export const DEFAULT_PLAYLIST_CACHE_ID = 'default';

type PersistedPlaylistRecord = {
  id: string;
  snapshot: PlaylistSnapshot;
  files: File[];
  savedAt: string;
};

const openPlaylistDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB is not available in this browser.'));
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Failed to open PonsCast playlist cache.'));
});

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openPlaylistDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('PonsCast playlist cache request failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('PonsCast playlist cache transaction failed.'));
    };
  });
};

export const savePonsCastPlaylistCache = async (
  snapshot: PlaylistSnapshot,
  files: File[],
  id = DEFAULT_PLAYLIST_CACHE_ID,
) => {
  const record: PersistedPlaylistRecord = {
    id,
    snapshot,
    files,
    savedAt: new Date().toISOString(),
  };
  await withStore('readwrite', store => store.put(record));
  return record;
};

export const loadPonsCastPlaylistCache = async (id = DEFAULT_PLAYLIST_CACHE_ID) => {
  const record = await withStore<PersistedPlaylistRecord | undefined>('readonly', store => store.get(id));
  return record ?? null;
};

export const clearPonsCastPlaylistCache = async (id = DEFAULT_PLAYLIST_CACHE_ID) => {
  await withStore('readwrite', store => store.delete(id));
};
