declare const self: ServiceWorkerGlobalScope;

const IMAGE_CACHE = 'images-v1';
const API_CACHE = 'api-cache-v1';
const FONT_CACHE = 'fonts-v1';
const MAX_IMAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_API_AGE_MS = 5 * 60 * 1000;
const MAX_FONT_AGE_MS = 365 * 24 * 60 * 60 * 1000;

type SyncEventLike = ExtendableEvent & { tag: string };
type PushEventLike = ExtendableEvent & { data?: { json: () => unknown } };
type NotificationClickEventLike = ExtendableEvent & {
  action: string;
  notification: Notification & { data?: { url?: string } };
};
type ChunkCacheMessage = {
  type: 'CACHE_FILE_CHUNK';
  payload: {
    transferId: string;
    chunkIndex: number;
    data: BodyInit;
  };
};
type PendingTransfer = Record<string, unknown> & {
  transferId?: string | number;
};
type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
};

const isChunkCacheMessage = (value: unknown): value is ChunkCacheMessage => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChunkCacheMessage>;
  const payload = message.payload as Partial<ChunkCacheMessage['payload']> | undefined;

  return message.type === 'CACHE_FILE_CHUNK'
    && Boolean(payload)
    && typeof payload?.transferId === 'string'
    && typeof payload?.chunkIndex === 'number'
    && payload.data !== undefined;
};

const readPushPayload = (value: unknown): PushPayload => {
  if (!value || typeof value !== 'object') return {};
  const payload = value as PushPayload;
  return {
    title: typeof payload.title === 'string' ? payload.title : undefined,
    body: typeof payload.body === 'string' ? payload.body : undefined,
    url: typeof payload.url === 'string' ? payload.url : undefined,
  };
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

// ✅ 백그라운드 동기화 등록
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEventLike;
  if (syncEvent.tag === 'resume-file-transfer') {
    syncEvent.waitUntil(resumeFileTransfers());
  }
});

async function resumeFileTransfers() {
  // IndexedDB에서 중단된 전송 목록 가져오기
  const db = await openDB('PonsLinkTransfers', 1);
  try {
    const pendingTransfers = await getAllFromStore(db, 'pending');

    for (const transfer of pendingTransfers) {
      const response = await fetch('/api/resume-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(transfer),
      });

      if (!response.ok) {
        throw new Error(`Resume transfer failed with ${response.status}`);
      }

      await deleteFromStore(db, 'pending', getTransferStoreKey(transfer));
    }
  } finally {
    db.close();
  }
}

// ✅ Push 알림 수신
self.addEventListener('push', (event: Event) => {
  const pushEvent = event as PushEventLike;
  const data = readPushPayload(pushEvent.data?.json());

  const options: NotificationOptions = {
    body: data.body || 'File transfer completed',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  pushEvent.waitUntil(
    self.registration.showNotification(data.title || 'PonsLink', options)
  );
});

// ✅ 알림 클릭 처리
self.addEventListener('notificationclick', (event: Event) => {
  const notificationEvent = event as NotificationClickEventLike;
  notificationEvent.notification.close();

  if (notificationEvent.action === 'open') {
    notificationEvent.waitUntil(
      self.clients.openWindow(notificationEvent.notification.data?.url || '/')
    );
  }
});

// ✅ 파일 청크 캐싱 (대용량 파일 최적화)
const FILE_CHUNK_CACHE = 'file-chunks-v1';

self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (isChunkCacheMessage(event.data)) {
    const { transferId, chunkIndex, data } = event.data.payload;

    const cache = await caches.open(FILE_CHUNK_CACHE);
    const response = new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Transfer-ID': transferId,
        'X-Chunk-Index': chunkIndex.toString(),
      },
    });

    await cache.put(
      `/file-chunk/${transferId}/${chunkIndex}`,
      response
    );
  }
});

// ✅ 청크 조회
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/file-chunk/')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  if (event.request.destination === 'image') {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE, MAX_IMAGE_AGE_MS, 100));
    return;
  }

  if (event.request.destination === 'font') {
    event.respondWith(cacheFirst(event.request, FONT_CACHE, MAX_FONT_AGE_MS, 20));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE, MAX_API_AGE_MS, 50));
  }
});

// IndexedDB 헬퍼 함수
function openDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'transferId' });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllFromStore(db: IDBDatabase, storeName: string): Promise<PendingTransfer[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result ?? []) as PendingTransfer[]);
  });
}

function deleteFromStore(db: IDBDatabase, storeName: string, key: IDBValidKey | undefined): Promise<void> {
  if (key === undefined) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const request = transaction.objectStore(storeName).delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function getTransferStoreKey(transfer: PendingTransfer): IDBValidKey | undefined {
  const transferId = transfer?.transferId;
  return typeof transferId === 'string' || typeof transferId === 'number' ? transferId : undefined;
}

async function cacheFirst(request: Request, cacheName: string, maxAgeMs: number, maxEntries: number): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && !isExpired(cached, maxAgeMs)) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, withCacheTimestamp(response.clone()));
    await trimCache(cache, maxEntries);
  }
  return response;
}

async function networkFirst(request: Request, cacheName: string, maxAgeMs: number, maxEntries: number): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, withCacheTimestamp(response.clone()));
      await trimCache(cache, maxEntries);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && !isExpired(cached, maxAgeMs)) {
      return cached;
    }
    throw error;
  }
}

function withCacheTimestamp(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Pons-Cache-Time', String(Date.now()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isExpired(response: Response, maxAgeMs: number): boolean {
  const cachedAt = Number(response.headers.get('X-Pons-Cache-Time') ?? 0);
  return !cachedAt || Date.now() - cachedAt > maxAgeMs;
}

async function trimCache(cache: Cache, maxEntries: number): Promise<void> {
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow <= 0) return;

  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}
