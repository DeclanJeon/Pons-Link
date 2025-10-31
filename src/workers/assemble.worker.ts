declare const self: DedicatedWorkerGlobalScope;

const DB_NAME = 'PonsLinkFileTransfer';
const DB_VERSION = 1;
const STORE = 'file_chunks';

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data || {};
  if (type !== 'assemble') return;
  const { transferId, mimeType, totalChunks } = payload as { transferId: string; mimeType: string; totalChunks: number };
  try {
    const db = await openDB();
    const tx = db.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const index = store.index('transfer_chunk_idx');
    const range = IDBKeyRange.bound([transferId, 0], [transferId, Infinity]);
    const parts: (ArrayBuffer | Blob)[] = [];
    let processed = 0;
    let intermediate = 0;
    const THRESHOLD = 50 * 1024 * 1024;

    await new Promise<void>((resolve, reject) => {
      const cursorReq = index.openCursor(range);
      cursorReq.onerror = () => reject(cursorReq.error);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result as IDBCursorWithValue | null;
        if (!cursor) {
          resolve();
          return;
        }
        const value = cursor.value as { data: ArrayBuffer };
        if (value && value.data instanceof ArrayBuffer) {
          parts.push(value.data);
          intermediate += value.data.byteLength;
          processed += 1;
          if (totalChunks > 0 && processed % 50 === 0) {
            self.postMessage({ type: 'progress', payload: { transferId, processed, totalChunks } });
          }
          if (intermediate >= THRESHOLD) {
            const blob = new Blob(parts, { type: mimeType });
            parts.length = 0;
            parts.push(blob);
            intermediate = 0;
          }
        }
        cursor.continue();
      };
    });

    const blob = new Blob(parts, { type: mimeType });
    self.postMessage({ type: 'assembled', payload: { transferId, blob } });
  } catch (err) {
    self.postMessage({ type: 'error', payload: { transferId, message: (err as Error)?.message || 'assemble failed' } });
  }
};