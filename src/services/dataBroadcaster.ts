export type BroadcasterOptions = {
  tickMs?: number;
  maxBytesPerSec?: number;
  maxQueueBytes?: number;
  burstBytes?: number;
  shouldSend?: () => boolean;
  onDrop?: (info: { count: number; bytes: number; reason: 'stale' | 'queue-full' }) => void;
};

type Sender = (data: ArrayBuffer) => void;
type QueueEntry = {
  data: ArrayBuffer;
  stale: boolean;
};
type EnqueueOptions = {
  stale?: boolean;
  replaceQueuedStale?: boolean;
};

export const createBroadcaster = (
  sender: Sender,
  options: BroadcasterOptions = {},
  onBytesSent?: (bytes: number) => void
) => {
  const tickMs = options.tickMs ?? 16;
  const maxBytesPerSec = options.maxBytesPerSec ?? 6291456;
  const burstBytes = options.burstBytes ?? 262144;
  const maxQueueBytes = options.maxQueueBytes ?? 52428800;
  const shouldSend = options.shouldSend ?? (() => true);
  const onDrop = options.onDrop;
  let queue: QueueEntry[] = [];
  let queueBytes = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let tokens = maxBytesPerSec;
  let lastRefill = Date.now();

  const notifyDrop = (count: number, bytes: number, reason: 'stale' | 'queue-full') => {
    if (count > 0 && bytes > 0) {
      onDrop?.({ count, bytes, reason });
    }
  };

  const dropQueued = (predicate: (entry: QueueEntry) => boolean, reason: 'stale' | 'queue-full') => {
    let droppedCount = 0;
    let droppedBytes = 0;
    queue = queue.filter((entry) => {
      if (!predicate(entry)) return true;
      droppedCount += 1;
      droppedBytes += entry.data.byteLength;
      queueBytes -= entry.data.byteLength;
      return false;
    });
    notifyDrop(droppedCount, droppedBytes, reason);
  };

  const refill = () => {
    const now = Date.now();
    const deltaMs = now - lastRefill;
    lastRefill = now;
    const add = Math.floor((maxBytesPerSec * deltaMs) / 1000);
    tokens = Math.min(tokens + add, maxBytesPerSec);
  };

  const drain = () => {
    refill();
    let sentThisTick = 0;
    while (queue.length > 0 && tokens > 0 && sentThisTick < burstBytes) {
      if (!shouldSend()) break;
      const entry = queue[0];
      if (entry.data.byteLength > tokens) break;
      sender(entry.data);
      tokens -= entry.data.byteLength;
      sentThisTick += entry.data.byteLength;
      if (onBytesSent) onBytesSent(entry.data.byteLength);
      queue.shift();
      queueBytes -= entry.data.byteLength;
    }
    if (queue.length === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const ensureLoop = () => {
    if (!interval) interval = setInterval(drain, tickMs);
  };

  const enqueue = (buf: ArrayBuffer, enqueueOptions: EnqueueOptions = {}) => {
    const entry: QueueEntry = {
      data: buf,
      stale: enqueueOptions.stale ?? false,
    };

    if (entry.stale && enqueueOptions.replaceQueuedStale) {
      dropQueued((queuedEntry) => queuedEntry.stale, 'stale');
    }

    if (queueBytes + entry.data.byteLength > maxQueueBytes && entry.stale) {
      dropQueued((queuedEntry) => queuedEntry.stale, 'queue-full');
    }

    if (queueBytes + entry.data.byteLength > maxQueueBytes) {
      notifyDrop(1, entry.data.byteLength, 'queue-full');
      return false;
    }

    queue.push(entry);
    queueBytes += entry.data.byteLength;
    ensureLoop();
    return true;
  };

  const size = () => queueBytes;

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    queue = [];
    queueBytes = 0;
    tokens = maxBytesPerSec;
    lastRefill = Date.now();
  };

  return { enqueue, size, stop };
};
