// src/service-worker.ts

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// ✅ 정적 리소스 프리캐싱
precacheAndRoute(self.__WB_MANIFEST);

// ✅ 이미지 캐싱 (1주일 유지)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7일
      }),
    ],
  })
);

// ✅ API 응답 캐싱 (네트워크 우선, 오프라인 시 캐시)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5분
      }),
    ],
  })
);

// ✅ 폰트 캐싱
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1년
      }),
    ],
  })
);

// ✅ 백그라운드 동기화 등록
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'resume-file-transfer') {
    event.waitUntil(resumeFileTransfers());
  }
});

async function resumeFileTransfers() {
  // IndexedDB에서 중단된 전송 목록 가져오기
  const db = await openDB('PonsLinkTransfers', 1);
  const pendingTransfers = await db.getAll('pending');

  for (const transfer of pendingTransfers) {
    // 전송 재개 로직
    await fetch('/api/resume-transfer', {
      method: 'POST',
      body: JSON.stringify(transfer),
    });
  }
}

// ✅ Push 알림 수신
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? {};

  const options: any = {
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'PonsLink', options)
  );
});

// ✅ 알림 클릭 처리
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.url)
    );
  }
});

// ✅ 파일 청크 캐싱 (대용량 파일 최적화)
const FILE_CHUNK_CACHE = 'file-chunks-v1';

self.addEventListener('message', async (event: any) => {
  if (event.data.type === 'CACHE_FILE_CHUNK') {
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
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/file-chunk/')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});

// IndexedDB 헬퍼 함수
function openDB(name: string, version: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
