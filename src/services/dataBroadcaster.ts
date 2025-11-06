export type BroadcasterOptions = {
  tickMs?: number;
  maxBytesPerSec?: number;
  maxQueueBytes?: number;
  burstBytes?: number;
};

type Sender = (data: ArrayBuffer) => void;

export const createBroadcaster = (
  sender: Sender,
  options: BroadcasterOptions = {},
  onBytesSent?: (bytes: number) => void
) => {
  const tickMs = options.tickMs ?? 16;
  const maxBytesPerSec = options.maxBytesPerSec ?? 6291456;
  const burstBytes = options.burstBytes ?? 262144;
  const maxQueueBytes = options.maxQueueBytes ?? 52428800;
  let queue: ArrayBuffer[] = [];
  let queueBytes = 0;
  let interval: any = null;
  let tokens = maxBytesPerSec;
  let lastRefill = Date.now();

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
      const buf = queue[0];
      if (buf.byteLength > tokens) break;
      sender(buf);
      tokens -= buf.byteLength;
      sentThisTick += buf.byteLength;
      if (onBytesSent) onBytesSent(buf.byteLength);
      queue.shift();
      queueBytes -= buf.byteLength;
    }
    if (queue.length === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const ensureLoop = () => {
    if (!interval) interval = setInterval(drain, tickMs);
  };

  const enqueue = (buf: ArrayBuffer) => {
    if (queueBytes + buf.byteLength > maxQueueBytes) return false;
    queue.push(buf);
    queueBytes += buf.byteLength;
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