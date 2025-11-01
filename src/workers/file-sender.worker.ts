declare const self: DedicatedWorkerGlobalScope;

interface StartTransferPayload {
  file: File;
  transferId: string;
  chunkSize: number;
}

class FileSender {
  private file: File | null = null;
  private transferId = '';
  private chunkSize = 64 * 1024;
  private totalChunks = 0;
  private isPaused = false;
  private isCancelled = false;
  private startTime = 0;
  private bytesSent = 0;
  private ackedChunks = new Set<number>();
  private pendingChunks = new Map<number, { data: ArrayBuffer; sentAt: number; retries: number }>();
  private maxPendingChunks = 10;
  private lastProgressReport = 0;
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly MAX_RETRIES = 5; // 3 → 5로 증가
  private readonly ACK_TIMEOUT = 15000; // 10초 → 15초로 증가
  
  private displayProgress = 0;
  private targetProgress = 0;
  private smoothingFactor = 0.2;
  
  private speedSamples: Array<{ time: number; bytes: number }> = [];
  private displaySpeed = 0;
  private targetSpeed = 0;
  
  private ackTimeouts = new Map<number, NodeJS.Timeout>();
  private receiverConfirmed = false;
  
  private chunkCache = new Map<number, ArrayBuffer>();

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
    this.startSmoothingLoop();
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
      case 'receiver-complete':
        this.handleReceiverComplete(payload);
        break;
    }
  }

  private async startTransfer(payload: StartTransferPayload) {
    this.file = payload.file;
    this.transferId = payload.transferId;
    this.chunkSize = payload.chunkSize;
    this.totalChunks = Math.ceil(this.file.size / this.chunkSize);
    this.startTime = Date.now();
    this.bytesSent = 0;
    this.ackedChunks.clear();
    this.pendingChunks.clear();
    this.chunkCache.clear();
    this.lastProgressReport = Date.now();
    this.displayProgress = 0;
    this.targetProgress = 0;
    this.speedSamples = [];
    this.receiverConfirmed = false;

    const lastChunkSize = this.file.size - (this.totalChunks - 1) * this.chunkSize;
    
    console.log(`[Sender Worker] 🚀 Starting transfer:`, {
      fileName: this.file.name,
      fileSize: this.file.size,
      chunkSize: this.chunkSize,
      totalChunks: this.totalChunks,
      lastChunkSize,
    });

    this.sendNextBatch();
  }

  private async sendNextBatch() {
    if (this.isPaused || this.isCancelled || !this.file) return;

    // ✅ 전송할 청크 찾기 (ACK 받지 않은 청크 중 pending 아닌 것)
    for (let i = 0; i < this.totalChunks; i++) {
      // ✅ 이미 ACK 받았으면 스킵
      if (this.ackedChunks.has(i)) continue;
      
      // ✅ 이미 전송 중이면 스킵
      if (this.pendingChunks.has(i)) continue;
      
      // ✅ pending 한도 체크
      if (this.pendingChunks.size >= this.maxPendingChunks) break;
      
      // ✅ 청크 전송
      await this.sendChunk(i);
    }
    
    // ✅ 상태 로그
    if (this.pendingChunks.size > 0) {
      console.log(`[Sender Worker] ⏸️ Waiting for ACKs: ${this.ackedChunks.size}/${this.totalChunks} (pending: ${this.pendingChunks.size})`);
    }
  }

  private async sendChunk(chunkIndex: number) {
    if (!this.file) return;
    
    const chunkData = await this.readChunk(chunkIndex);
    if (!chunkData) {
      console.error(`[Sender Worker] ❌ Failed to read chunk ${chunkIndex}`);
      return;
    }

    const isLastChunk = chunkIndex === this.totalChunks - 1;
    const expectedSize = isLastChunk
      ? this.file.size - chunkIndex * this.chunkSize
      : this.chunkSize;
    
    if (chunkData.byteLength !== expectedSize) {
      console.error(`[Sender Worker] ❌ Chunk size mismatch at ${chunkIndex}:`, {
        expected: expectedSize,
        actual: chunkData.byteLength,
      });
      return;
    }

    const checksum = await this.calculateChecksum(chunkData);
    
    console.log(`[Sender Worker] 📤 Sending chunk ${chunkIndex}/${this.totalChunks - 1}, size: ${chunkData.byteLength} bytes${isLastChunk ? ' (LAST)' : ''}`);

    const packet = this.createPacket(chunkIndex, chunkData, checksum);
    
    this.pendingChunks.set(chunkIndex, {
      data: packet,
      sentAt: Date.now(),
      retries: 0,
    });

    const timeout = setTimeout(() => {
      this.handleTimeout(chunkIndex);
    }, this.ACK_TIMEOUT);
    
    this.ackTimeouts.set(chunkIndex, timeout);

    self.postMessage(
      {
        type: 'chunk-ready',
        payload: {
          transferId: this.transferId,
          chunkIndex,
          chunk: packet,
          isLastChunk,
        },
      },
      [packet]
    );
  }

  private async readChunk(index: number): Promise<ArrayBuffer | null> {
    if (!this.file) return null;

    if (this.chunkCache.has(index)) {
      const cached = this.chunkCache.get(index)!;
      return cached.slice(0);
    }

    try {
      const start = index * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      
      if (start >= this.file.size) {
        console.error(`[Sender Worker] ❌ Invalid chunk index ${index}`);
        return null;
      }
      
      const expectedSize = end - start;
      
      const blob = this.file.slice(start, end);
      const arrayBuffer = await blob.arrayBuffer();
      
      if (arrayBuffer.byteLength !== expectedSize) {
        console.error(`[Sender Worker] ❌ Read size mismatch at ${index}`);
        
        if (arrayBuffer.byteLength > expectedSize) {
          const trimmed = arrayBuffer.slice(0, expectedSize);
          this.chunkCache.set(index, trimmed);
          return trimmed.slice(0);
        } else {
          return null;
        }
      }
      
      if (index === this.totalChunks - 1) {
        console.log(`[Sender Worker] 🏁 Last chunk ${index}: ${arrayBuffer.byteLength} bytes`);
      }
      
      this.chunkCache.set(index, arrayBuffer);
      
      return arrayBuffer.slice(0);
    } catch (error) {
      console.error(`[Sender Worker] ❌ Chunk read error at ${index}:`, error);
      return null;
    }
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private createPacket(chunkIndex: number, data: ArrayBuffer, checksum: string): ArrayBuffer {
    const idBytes = new TextEncoder().encode(this.transferId);
    const checksumBytes = new TextEncoder().encode(checksum);
    
    const headerSize = 1 + 2 + idBytes.length + 4 + 4 + 2 + checksumBytes.length;
    const totalSize = headerSize + data.byteLength;
    const packet = new ArrayBuffer(totalSize);
    const view = new DataView(packet);

    let offset = 0;
    
    view.setUint8(offset, 1);
    offset += 1;
    
    view.setUint16(offset, idBytes.length, false);
    offset += 2;
    
    new Uint8Array(packet, offset, idBytes.length).set(idBytes);
    offset += idBytes.length;
    
    view.setUint32(offset, chunkIndex, false);
    offset += 4;
    
    view.setUint32(offset, data.byteLength, false);
    offset += 4;
    
    view.setUint16(offset, checksumBytes.length, false);
    offset += 2;
    
    new Uint8Array(packet, offset, checksumBytes.length).set(checksumBytes);
    offset += checksumBytes.length;
    
    const dataView = new Uint8Array(data);
    new Uint8Array(packet, offset, data.byteLength).set(dataView);

    return packet;
  }

  private async handleTimeout(chunkIndex: number) {
    const pending = this.pendingChunks.get(chunkIndex);
    if (!pending || this.isCancelled) return;

    if (pending.retries < this.MAX_RETRIES) {
      console.warn(`[Sender Worker] ⏰ Timeout for chunk ${chunkIndex}, retry ${pending.retries + 1}/${this.MAX_RETRIES}`);
      
      const chunkData = await this.readChunk(chunkIndex);
      if (!chunkData) {
        console.error(`[Sender Worker] ❌ Failed to re-read chunk ${chunkIndex}`);
        this.cancel();
        return;
      }
      
      const checksum = await this.calculateChecksum(chunkData);
      const packet = this.createPacket(chunkIndex, chunkData, checksum);
      
      pending.data = packet;
      pending.retries++;
      pending.sentAt = Date.now();
      
      self.postMessage(
        {
          type: 'chunk-ready',
          payload: {
            transferId: this.transferId,
            chunkIndex,
            chunk: packet,
            isLastChunk: chunkIndex === this.totalChunks - 1,
          },
        },
        [packet]
      );
      
      const timeout = setTimeout(() => {
        this.handleTimeout(chunkIndex);
      }, this.ACK_TIMEOUT);
      
      this.ackTimeouts.set(chunkIndex, timeout);
    } else {
      console.error(`[Sender Worker] ❌ Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`);
      
      self.postMessage({
        type: 'error',
        payload: {
          transferId: this.transferId,
          message: `Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`,
        },
      });
      
      this.cancel();
    }
  }

  private handleAck(payload: { chunkIndex: number }) {
    const { chunkIndex } = payload;

    const timeout = this.ackTimeouts.get(chunkIndex);
    if (timeout) {
      clearTimeout(timeout);
      this.ackTimeouts.delete(chunkIndex);
    }

    if (this.ackedChunks.has(chunkIndex)) {
      return;
    }

    if (chunkIndex >= this.totalChunks) {
      console.error(`[Sender Worker] ❌ Invalid ACK: chunk ${chunkIndex} >= totalChunks ${this.totalChunks}`);
      return;
    }

    this.ackedChunks.add(chunkIndex);
    this.pendingChunks.delete(chunkIndex);

    const chunkBytes = Math.min(
      this.chunkSize,
      this.file!.size - chunkIndex * this.chunkSize
    );
    this.bytesSent += chunkBytes;

    console.log(`[Sender Worker] ✅ ACK received for chunk ${chunkIndex}, total ACKed: ${this.ackedChunks.size}/${this.totalChunks}`);

    const now = Date.now();
    this.speedSamples.push({
      time: now,
      bytes: this.bytesSent,
    });

    this.speedSamples = this.speedSamples.filter(
      sample => now - sample.time < 1000
    );

    this.targetProgress = this.bytesSent / this.file!.size;

    if (this.ackedChunks.size === this.totalChunks) {
      console.log(`[Sender Worker] 🎉 All ${this.totalChunks} chunks ACKed, waiting for receiver assembly...`);
      this.targetProgress = 0.99;
      
      // ✅ 모든 타임아웃 취소
      this.ackTimeouts.forEach(timeout => clearTimeout(timeout));
      this.ackTimeouts.clear();
      this.pendingChunks.clear();
      
    } else {
      this.sendNextBatch();
    }
  }

  private startSmoothingLoop() {
    const smoothingInterval = setInterval(() => {
      if (this.isCancelled) {
        clearInterval(smoothingInterval);
        return;
      }

      this.displayProgress +=
        (this.targetProgress - this.displayProgress) * this.smoothingFactor;

      if (Math.abs(this.targetProgress - this.displayProgress) < 0.001) {
        this.displayProgress = this.targetProgress;
      }

      if (this.speedSamples.length >= 2) {
        const oldest = this.speedSamples[0];
        const newest = this.speedSamples[this.speedSamples.length - 1];
        const timeDiff = (newest.time - oldest.time) / 1000;
        const bytesDiff = newest.bytes - oldest.bytes;
        this.targetSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
      }

      this.displaySpeed +=
        (this.targetSpeed - this.displaySpeed) * this.smoothingFactor;

      const now = Date.now();
      if (now - this.lastProgressReport >= this.PROGRESS_REPORT_INTERVAL) {
        this.reportProgress();
        this.lastProgressReport = now;
      }
    }, 16);
  }

  private reportProgress() {
    const remaining = this.file ? this.file.size - this.bytesSent : 0;
    const eta = this.displaySpeed > 0 ? remaining / this.displaySpeed : Infinity;

    self.postMessage({
      type: 'progress',
      payload: {
        transferId: this.transferId,
        progress: this.displayProgress,
        actualProgress: this.targetProgress,
        speed: this.displaySpeed,
        eta,
        bytesSent: this.bytesSent,
        chunksSent: this.ackedChunks.size,
        totalChunks: this.totalChunks,
        pendingChunks: this.pendingChunks.size,
      },
    });
  }

  private handleReceiverComplete(payload: { transferId: string }) {
    if (payload.transferId === this.transferId && !this.isCancelled) {
      this.receiverConfirmed = true;
      console.log(`[Sender Worker] ✅ Receiver confirmed assembly complete`);
      
      this.displayProgress = 1;
      this.targetProgress = 1;
      this.complete();
    }
  }

  private complete() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.bytesSent / totalTime : 0;

    console.log(`[Sender Worker] 🎊 Transfer complete:`, {
      transferId: this.transferId,
      totalTime: `${totalTime.toFixed(2)}s`,
      averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)} MB/s`,
      totalChunks: this.totalChunks,
      ackedChunks: this.ackedChunks.size,
    });

    self.postMessage({
      type: 'complete',
      payload: {
        transferId: this.transferId,
        averageSpeed,
        totalTime,
      },
    });
    
    this.chunkCache.clear();
  }

  private cancel() {
    this.isCancelled = true;
    this.pendingChunks.clear();
    this.chunkCache.clear();
    
    this.ackTimeouts.forEach(timeout => clearTimeout(timeout));
    this.ackTimeouts.clear();

    self.postMessage({
      type: 'cancelled',
      payload: { transferId: this.transferId },
    });
  }
}

new FileSender();