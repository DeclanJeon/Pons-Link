import {
  calculateTotalChunks,
  calculateFileOffset,
  calculateActualChunkSize,
} from '../lib/fileTransferUtils';

declare const self: DedicatedWorkerGlobalScope;

const TRANSFER_CONFIG = {
  windowSize: 16,
  maxRetries: 3,
  stallTimeout: 5000,
  sendDelay: 5,
  chunkTimeout: 5000,
};

interface ChunkState {
  acked: boolean;
  sent: boolean;
  retries: number;
  lastSentTime: number;
  size: number;
}

class AdaptiveWindowController {
  private currentWindowSize: number = 8;
  private readonly MIN_WINDOW = 4;
  private readonly MAX_WINDOW = 64;
  private readonly INCREASE_STEP = 2;
  private readonly DECREASE_FACTOR = 0.5;
  private consecutiveSuccesses: number = 0;
  private readonly SUCCESS_THRESHOLD = 10;

  onChunkAck(): void {
    this.consecutiveSuccesses++;
    if (this.consecutiveSuccesses >= this.SUCCESS_THRESHOLD) {
      this.increaseWindow();
      this.consecutiveSuccesses = 0;
    }
  }

  onChunkTimeout(): void {
    this.decreaseWindow();
    this.consecutiveSuccesses = 0;
  }

  private increaseWindow(): void {
    const newSize = Math.min(this.currentWindowSize + this.INCREASE_STEP, this.MAX_WINDOW);
    if (newSize !== this.currentWindowSize) {
      this.currentWindowSize = newSize;
    }
  }

  private decreaseWindow(): void {
    const newSize = Math.max(Math.floor(this.currentWindowSize * this.DECREASE_FACTOR), this.MIN_WINDOW);
    if (newSize !== this.currentWindowSize) {
      this.currentWindowSize = newSize;
    }
  }

  getWindowSize(): number {
    return this.currentWindowSize;
  }

  reset(): void {
    this.currentWindowSize = 8;
    this.consecutiveSuccesses = 0;
  }
}

class HybridFileWorker {
  private file: File | null = null;
  private transferId: string = '';
  private chunkSize: number = 0;
  private totalChunks: number = 0;
  private totalSize: number = 0;
  private chunkStates: Map<number, ChunkState> = new Map();
  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private isSendingAllowed: boolean = true;
  private windowController = new AdaptiveWindowController();
  private inFlightChunks: Set<number> = new Set();
  private nextChunkToSend: number = 0;
  private startTime: number = 0;
  private bytesAcked: number = 0;
  private bytesSent: number = 0;
  private lastProgressReportTime: number = 0;
  private lastActivityTime: number = 0;
  private stallCheckInterval: number | null = null;
  private chunkTimers: Map<number, number> = new Map();

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private resetState(): void {
    this.file = null;
    this.transferId = '';
    this.chunkSize = 0;
    this.totalChunks = 0;
    this.totalSize = 0;
    this.chunkStates.clear();
    this.isCancelled = false;
    this.isPaused = false;
    this.isSendingAllowed = true;
    this.windowController.reset();
    this.inFlightChunks.clear();
    this.nextChunkToSend = 0;
    this.startTime = 0;
    this.bytesAcked = 0;
    this.bytesSent = 0;
    this.lastActivityTime = 0;
    this.chunkTimers.forEach(timer => self.clearTimeout(timer));
    this.chunkTimers.clear();
    if (this.stallCheckInterval) {
      self.clearInterval(this.stallCheckInterval);
      this.stallCheckInterval = null;
    }
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const { type, payload } = event.data;
    switch (type) {
      case 'start-transfer':
        this.resetState();
        await this.startTransfer(payload.file, payload.transferId, payload.chunkSize);
        break;
      case 'ack-received':
        this.handleAckReceived(payload.chunkIndex);
        break;
      case 'set-sending-status':
        this.isSendingAllowed = payload.canSend;
        if (this.isSendingAllowed) {
          this.transferLoop();
        }
        break;
      case 'pause-transfer':
        this.isPaused = true;
        break;
      case 'resume-transfer':
        this.isPaused = false;
        this.transferLoop();
        break;
      case 'cancel-transfer':
        this.cancelTransfer();
        break;
    }
  }

  private async startTransfer(file: File, transferId: string, chunkSize: number): Promise<void> {
    this.file = file;
    this.transferId = transferId;
    this.chunkSize = chunkSize;
    this.totalSize = file.size;
    this.totalChunks = calculateTotalChunks(file.size, this.chunkSize);
    this.startTime = Date.now();
    this.lastActivityTime = Date.now();
    this.initializeChunkStates();
    this.stallCheckInterval = self.setInterval(() => this.checkStall(), 1000);
    this.transferLoop();
  }

  private initializeChunkStates(): void {
    for (let i = 0; i < this.totalChunks; i++) {
      this.chunkStates.set(i, {
        acked: false,
        sent: false,
        retries: 0,
        lastSentTime: 0,
        size: calculateActualChunkSize(this.totalSize, i, this.chunkSize),
      });
    }
  }

  private async transferLoop(): Promise<void> {
    if (this.isCancelled || this.isPaused) return;
    const windowSize = this.windowController.getWindowSize();
    while (this.isSendingAllowed && this.inFlightChunks.size < windowSize && this.nextChunkToSend < this.totalChunks) {
      const chunkIndex = this.nextChunkToSend;
      this.nextChunkToSend++;
      await this.sendChunk(chunkIndex);
      if (TRANSFER_CONFIG.sendDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, TRANSFER_CONFIG.sendDelay));
      }
    }
    if (this.getAckedCount() === this.totalChunks) {
      await this.completeTransfer();
    }
  }

  private async sendChunk(chunkIndex: number): Promise<void> {
    if (!this.file || this.isCancelled) return;
    const state = this.chunkStates.get(chunkIndex);
    if (!state || state.acked) return;
    if (state.retries >= TRANSFER_CONFIG.maxRetries) {
      this.cancelTransfer(`Chunk ${chunkIndex} failed after ${TRANSFER_CONFIG.maxRetries} retries`);
      return;
    }
    try {
      const offset = calculateFileOffset(chunkIndex, this.chunkSize);
      const blob = this.file.slice(offset, offset + state.size);
      const data = await blob.arrayBuffer();
      const packet = this.createChunkPacket(chunkIndex, data);
      self.postMessage(
        {
          type: 'chunk-ready',
          payload: {
            transferId: this.transferId,
            chunk: packet,
            chunkIndex
          }
        },
        [packet]
      );
      state.sent = true;
      state.lastSentTime = Date.now();
      this.inFlightChunks.add(chunkIndex);
      this.bytesSent += state.size;
      this.lastActivityTime = Date.now();
      this.scheduleRetry(chunkIndex);
    } catch {
      state.retries++;
      this.inFlightChunks.delete(chunkIndex);
      setTimeout(() => this.sendChunk(chunkIndex), 1000);
    }
  }

  private createChunkPacket(chunkIndex: number, data: ArrayBuffer): ArrayBuffer {
    const transferIdBytes = new TextEncoder().encode(this.transferId);
    const headerSize = 1 + 2 + transferIdBytes.length + 4;
    const packet = new ArrayBuffer(headerSize + data.byteLength);
    const view = new DataView(packet);
    let offset = 0;
    view.setUint8(offset, 1);
    offset += 1;
    view.setUint16(offset, transferIdBytes.length, false);
    offset += 2;
    new Uint8Array(packet, offset, transferIdBytes.length).set(transferIdBytes);
    offset += transferIdBytes.length;
    view.setUint32(offset, chunkIndex, false);
    offset += 4;
    new Uint8Array(packet, offset).set(new Uint8Array(data));
    return packet;
  }

  private handleAckReceived(chunkIndex: number): void {
    const state = this.chunkStates.get(chunkIndex);
    if (state && !state.acked) {
      state.acked = true;
      this.inFlightChunks.delete(chunkIndex);
      this.bytesAcked += state.size;
      this.lastActivityTime = Date.now();
      const timer = this.chunkTimers.get(chunkIndex);
      if (timer) {
        self.clearTimeout(timer);
        this.chunkTimers.delete(chunkIndex);
      }
      this.windowController.onChunkAck();
      this.reportProgress();
      this.transferLoop();
    }
  }

  private checkStall(): void {
    if (this.isPaused || this.isCancelled) return;
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;
    if (timeSinceActivity > TRANSFER_CONFIG.stallTimeout && this.inFlightChunks.size > 0) {
      const inflights = Array.from(this.inFlightChunks);
      for (const chunkIndex of inflights) {
        const state = this.chunkStates.get(chunkIndex);
        if (!state) continue;
        if (state.retries < TRANSFER_CONFIG.maxRetries) {
          state.retries++;
          state.sent = false;
          this.inFlightChunks.delete(chunkIndex);
          this.sendChunk(chunkIndex);
        } else {
          this.cancelTransfer(`Chunk ${chunkIndex} failed after max retries`);
        }
      }
      this.lastActivityTime = now;
    }
  }

  private async completeTransfer(): Promise<void> {
    if (this.isCancelled) return;
    const transferIdBytes = new TextEncoder().encode(this.transferId);
    const endPacket = new ArrayBuffer(1 + 2 + transferIdBytes.length);
    const view = new DataView(endPacket);
    view.setUint8(0, 2);
    view.setUint16(1, transferIdBytes.length, false);
    new Uint8Array(endPacket, 3).set(transferIdBytes);
    for (let i = 0; i < 3; i++) {
      self.postMessage({
        type: 'chunk-ready',
        payload: {
          transferId: this.transferId,
          chunk: endPacket.slice(0)
        }
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.totalSize / totalTime : 0;
    self.postMessage({
      type: 'transfer-complete',
      payload: {
        transferId: this.transferId,
        startTime: this.startTime,
        totalSize: this.totalSize,
        averageSpeed,
        totalTime,
      }
    });
    this.cleanup();
  }

  private reportProgress(): void {
    const now = Date.now();
    if (now - this.lastProgressReportTime < 250) return;
    this.lastProgressReportTime = now;
    const elapsed = (now - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.bytesAcked / elapsed : 0;
    const eta = speed > 0 ? (this.totalSize - this.bytesAcked) / speed : Infinity;
    self.postMessage({
      type: 'progress-update',
      payload: {
        transferId: this.transferId,
        ackedSize: this.bytesAcked,
        sentSize: this.bytesSent,
        totalSize: this.totalSize,
        ackedChunks: this.getAckedCount(),
        sentChunks: this.nextChunkToSend,
        totalChunks: this.totalChunks,
        speed,
        eta,
        startTime: this.startTime,
      },
    });
  }

  private getAckedCount = (): number => Array.from(this.chunkStates.values()).filter(s => s.acked).length;

  private cancelTransfer(reason: string = 'User cancelled'): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    self.postMessage({
      type: 'transfer-cancelled',
      payload: { transferId: this.transferId, reason }
    });
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stallCheckInterval) {
      self.clearInterval(this.stallCheckInterval);
      this.stallCheckInterval = null;
    }
    this.chunkTimers.forEach(timer => self.clearTimeout(timer));
    this.chunkTimers.clear();
    this.resetState();
  }

  private scheduleRetry(chunkIndex: number): void {
    const existingTimer = this.chunkTimers.get(chunkIndex);
    if (existingTimer) {
      self.clearTimeout(existingTimer);
    }
    const timer = self.setTimeout(() => {
      const state = this.chunkStates.get(chunkIndex);
      if (state && !state.acked && this.inFlightChunks.has(chunkIndex)) {
        this.windowController.onChunkTimeout();
        state.retries++;
        state.sent = false;
        this.inFlightChunks.delete(chunkIndex);
        this.sendChunk(chunkIndex);
      }
    }, TRANSFER_CONFIG.chunkTimeout);
    this.chunkTimers.set(chunkIndex, timer);
  }
}

new HybridFileWorker();
