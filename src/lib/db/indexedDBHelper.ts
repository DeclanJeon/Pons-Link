import { storageManager } from './storageManager';

const DB_NAME = 'PonsLinkFileTransfer';
const DB_VERSION = 1;
const CHUNK_STORE_NAME = 'file_chunks';

let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db);
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbInitPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(CHUNK_STORE_NAME)) {
        const store = database.createObjectStore(CHUNK_STORE_NAME, { keyPath: 'key' });
        store.createIndex('transfer_chunk_idx', ['transferId', 'chunkIndex'], { unique: true });
        store.createIndex('timestamp_idx', 'timestamp', { unique: false });
      }
    };
  });
  return dbInitPromise;
};

export const memorySaveChunk = async (transferId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> => {
  await storageManager.set(transferId, chunkIndex, data);
};

export const saveChunk = async (transferId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> => {
  try {
    const dbInstance = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([CHUNK_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const key = `${transferId}_${chunkIndex}`;
      const request = store.put({
        key,
        transferId,
        chunkIndex,
        data,
        timestamp: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    await memorySaveChunk(transferId, chunkIndex, data);
  }
};

export const getAndAssembleFile = async (transferId: string, mimeType: string): Promise<Blob | null> => {
  let dbInstance: IDBDatabase;
  try {
    dbInstance = await initDB();
  } catch {
    const memoryChunks = await storageManager.getAll(transferId);
    if (memoryChunks.size > 0) {
      return assembleFromMemory(memoryChunks, mimeType);
    }
    throw new Error('Storage unavailable and no memory backup');
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance.transaction([CHUNK_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const index = store.index('transfer_chunk_idx');
      const keyRange = IDBKeyRange.bound([transferId, 0], [transferId, Infinity]);
      const request = index.getAll(keyRange);
      const timeoutId = setTimeout(() => {
        transaction.abort();
        reject(new Error('IndexedDB transaction timeout'));
      }, 30000);
      transaction.oncomplete = () => {
        clearTimeout(timeoutId);
      };
      transaction.onerror = () => {
        clearTimeout(timeoutId);
        reject(transaction.error);
      };
      request.onsuccess = () => {
        clearTimeout(timeoutId);
        try {
          const chunks = request.result as Array<{ chunkIndex: number; data: ArrayBuffer }>;
          if (!chunks || chunks.length === 0) {
            reject(new Error('No chunks found'));
            return;
          }
          chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
          for (let i = 0; i < chunks.length; i++) {
            if (chunks[i].chunkIndex !== i) {
              reject(new Error(`Chunk sequence broken at index ${i}`));
              return;
            }
          }
          const blobParts: (ArrayBuffer | Blob)[] = [];
          let intermediateSize = 0;
          const INTERMEDIATE_BLOB_THRESHOLD = 50 * 1024 * 1024;
          for (const chunk of chunks) {
            if (!(chunk.data instanceof ArrayBuffer)) {
              reject(new Error(`Invalid chunk data type at index ${chunk.chunkIndex}`));
              return;
            }
            blobParts.push(chunk.data);
            intermediateSize += chunk.data.byteLength;
            if (intermediateSize > INTERMEDIATE_BLOB_THRESHOLD) {
              const intermediateBlob = new Blob(blobParts, { type: mimeType });
              blobParts.length = 0;
              blobParts.push(intermediateBlob);
              intermediateSize = 0;
            }
          }
          const finalBlob = new Blob(blobParts, { type: mimeType });
          resolve(finalBlob);
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => {
        clearTimeout(timeoutId);
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
};

function assembleFromMemory(chunks: Map<number, ArrayBuffer>, mimeType: string): Blob {
  const sortedChunks = Array.from(chunks.entries()).sort((a, b) => a[0] - b[0]).map(([_, data]) => data);
  return new Blob(sortedChunks, { type: mimeType });
}

export const getSavedChunkIndexes = async (transferId: string): Promise<number[]> => {
  try {
    const dbInstance = await initDB();
    return new Promise<number[]>((resolve, reject) => {
      const result: number[] = [];
      const transaction = dbInstance.transaction([CHUNK_STORE_NAME], 'readonly');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const index = store.index('transfer_chunk_idx');
      const keyRange = IDBKeyRange.bound([transferId, 0], [transferId, Infinity]);
      const cursorRequest = index.openCursor(keyRange);
      const timeoutId = setTimeout(() => {
        try {
          transaction.abort();
        } catch {
    // Intentionally empty - we fall back to memory storage if IndexedDB fails
  }
        reject(new Error('IndexedDB transaction timeout'));
      }, 10000);
      transaction.oncomplete = () => {
        clearTimeout(timeoutId);
      };
      transaction.onerror = () => {
        clearTimeout(timeoutId);
        reject(transaction.error);
      };
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value as { chunkIndex: number };
          if (typeof value?.chunkIndex === 'number') {
            result.push(value.chunkIndex);
          }
          cursor.continue();
        } else {
          resolve(result.sort((a, b) => a - b));
        }
      };
      cursorRequest.onerror = () => {
        clearTimeout(timeoutId);
        reject(cursorRequest.error);
      };
    });
  } catch {
    const memoryChunks = await storageManager.getAll(transferId);
    return Array.from(memoryChunks.keys()).sort((a, b) => a - b);
  }
};

export const deleteFileChunks = async (transferId: string): Promise<void> => {
  try {
    const dbInstance = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = dbInstance.transaction([CHUNK_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CHUNK_STORE_NAME);
      const index = store.index('transfer_chunk_idx');
      const keyRange = IDBKeyRange.bound([transferId, 0], [transferId, Infinity]);
      const cursorRequest = index.openKeyCursor(keyRange);
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursor>).result;
        if (cursor) {
          store.delete(cursor.primaryKey as IDBValidKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () => {
        reject(cursorRequest.error);
      };
    });
  } catch {
    // Intentionally empty - we fall back to memory storage if IndexedDB fails
  }
  try {
    await storageManager.deleteAll(transferId);
  } catch {
    // Intentionally empty - we fall back to memory storage if IndexedDB fails
  }
};
