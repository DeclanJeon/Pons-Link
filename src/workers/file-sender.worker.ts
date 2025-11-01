declare const self: DedicatedWorkerGlobalScope;

interface StartTransferPayload {
  file: File;
  transferId: string;
  chunkSize: number;
}

interface ChunkReadyMessage {
  type: 'chunk-ready';
  payload: {
    transferId: string;
    chunkIndex: number;
    chunk: ArrayBuffer;
    isLastChunk: boolean;
  };
}

interface ProgressMessage {
  type: 'progress';
  payload: {
    transferId: string;
    progress: number;
    speed: number;
    eta: number;
    bytesSent: number;
    chunksSent: number;
    totalChunks: number;
  };
}

interface CompleteMessage {
  type: 'complete';
  payload: {
    transferId: string;
    averageSpeed: number;
    totalTime: number;
  };
}

type WorkerMessage = ChunkReadyMessage | ProgressMessage | CompleteMessage;

class FileSender {
  private file: File | null = null;
  private transferId = '';
  private chunkSize = 64 * 1024;
  private totalChunks = 0;
  private currentChunk = 0;
  private isPaused = false;
  private isCancelled = false;
  private startTime = 0;
  private bytesSent = 0;
  private ackedChunks = new Set<number>();
  private pendingChunks = new Map<number, ArrayBuffer>();
  private maxPendingChunks = 50; // ✅ 조정: 50개로 감소 (안정성 향상)
  private lastProgressReport = 0;
  private readonly PROGRESS_REPORT_INTERVAL = 200; // ✅ 200ms마다 진행률 보고

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private async handleMessage(e: MessageEvent) {
    const { type, payload } = e.data;

    switch (type) {
      case 'start-transfer':
        await this.startTransfer(payload);
        break;

      case 'pause-transfer':
        this.isPaused = true;
        break;

      case 'resume-transfer':
        this.isPaused = false;
        this.sendNextBatch();
        break;

      case 'cancel-transfer':
        this.cancel();
        break;

      case 'ack-received':
        this.handleAck(payload);
        break;
    }
  }

  private async startTransfer(payload: StartTransferPayload) {
    this.file = payload.file;
    this.transferId = payload.transferId;
    this.chunkSize = payload.chunkSize;
    this.totalChunks = Math.ceil(this.file.size / this.chunkSize);
    this.startTime = Date.now();
    this.currentChunk = 0;
    this.bytesSent = 0;
    this.ackedChunks.clear();
    this.pendingChunks.clear();
    this.lastProgressReport = Date.now();

    console.log(`[Sender Worker] Starting transfer: ${this.file.name}`, {
      size: this.file.size,
      chunkSize: this.chunkSize,
      totalChunks: this.totalChunks,
    });

    this.sendNextBatch();
  }

  private async sendNextBatch() {
    if (this.isPaused || this.isCancelled || !this.file) return;

    while (
      this.currentChunk < this.totalChunks &&
      this.pendingChunks.size < this.maxPendingChunks
    ) {
      const chunkData = await this.readChunk(this.currentChunk);
      if (!chunkData) break;

      const packet = this.createPacket(this.currentChunk, chunkData);
      this.pendingChunks.set(this.currentChunk, packet);

      self.postMessage(
        {
          type: 'chunk-ready',
          payload: {
            transferId: this.transferId,
            chunkIndex: this.currentChunk,
            chunk: packet,
            isLastChunk: this.currentChunk === this.totalChunks - 1,
          },
        },
        [packet]
      );

      this.currentChunk++;

      // ✅ 진행률 보고 (전송 진행률)
      const now = Date.now();
      if (now - this.lastProgressReport >= this.PROGRESS_REPORT_INTERVAL) {
        this.reportSendProgress();
        this.lastProgressReport = now;
      }
    }
  }

  private async readChunk(index: number): Promise<ArrayBuffer | null> {
    if (!this.file) return null;

    try {
      const start = index * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      const blob = this.file.slice(start, end);
      return await blob.arrayBuffer();
    } catch (error) {
      console.error('[Sender Worker] Chunk read error:', error);
      self.postMessage({
        type: 'error',
        payload: {
          transferId: this.transferId,
          message: `Failed to read chunk ${index}`,
        },
      });
      return null;
    }
  }

  private createPacket(chunkIndex: number, data: ArrayBuffer): ArrayBuffer {
    const idBytes = new TextEncoder().encode(this.transferId);
    const headerSize = 1 + 2 + idBytes.length + 4;
    const packet = new ArrayBuffer(headerSize + data.byteLength);
    const view = new DataView(packet);

    let offset = 0;
    view.setUint8(offset++, 1);
    view.setUint16(offset, idBytes.length, false);
    offset += 2;
    new Uint8Array(packet, offset, idBytes.length).set(idBytes);
    offset += idBytes.length;
    view.setUint32(offset, chunkIndex, false);
    offset += 4;
    new Uint8Array(packet, offset).set(new Uint8Array(data));

    return packet;
  }

  private handleAck(payload: { chunkIndex: number }) {
    const { chunkIndex } = payload;

    if (!this.ackedChunks.has(chunkIndex)) {
      this.ackedChunks.add(chunkIndex);
      this.pendingChunks.delete(chunkIndex);

      const chunkBytes = Math.min(
        this.chunkSize,
        this.file!.size - chunkIndex * this.chunkSize
      );
      this.bytesSent += chunkBytes;

      this.reportProgress();

      if (this.ackedChunks.size === this.totalChunks) {
        this.complete();
      } else {
        this.sendNextBatch();
      }
    }
  }

  private reportSendProgress() {
    // ✅ 전송 중 진행률 (ACK 기반)
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.bytesSent / elapsed : 0;
    const progress = this.file ? this.bytesSent / this.file.size : 0;
    const remaining = this.file ? this.file.size - this.bytesSent : 0;
    const eta = speed > 0 ? remaining / speed : Infinity;

    self.postMessage({
      type: 'progress',
      payload: {
        transferId: this.transferId,
        progress,
        speed,
        eta,
        bytesSent: this.bytesSent,
        chunksSent: this.ackedChunks.size,
        totalChunks: this.totalChunks,
      },
    });
  }

  private reportProgress() {
    this.reportSendProgress();
  }


  private complete() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.bytesSent / totalTime : 0;

    console.log(`[Sender Worker] Transfer complete:`, {
      transferId: this.transferId,
      totalTime: `${totalTime.toFixed(2)}s`,
      averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)} MB/s`,
    });

    const message: CompleteMessage = {
      type: 'complete',
      payload: {
        transferId: this.transferId,
        averageSpeed,
        totalTime,
      },
    };

    self.postMessage(message);
  }

  private cancel() {
    this.isCancelled = true;
    this.pendingChunks.clear();

    self.postMessage({
      type: 'cancelled',
      payload: { transferId: this.transferId },
    });
  }
}

new FileSender();