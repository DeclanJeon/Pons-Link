declare const self: DedicatedWorkerGlobalScope;

interface ChunkPayload {
  transferId: string;
  index: number;
  data: ArrayBuffer;
  senderId: string;
}

interface InitTransferPayload {
  transferId: string;
  totalChunks: number;
  totalSize: number;
  senderId: string;
  mimeType?: string;
  fileName?: string;
  originalChecksum?: string;
}

interface AssemblePayload {
  transferId: string;
  mimeType: string;
  fileName: string;
}

interface TransferState {
  chunks: Map<number, ArrayBuffer>;
  receivedCount: number;
  totalChunks: number;
  totalSize: number;
  receivedSize: number;
  startTime: number;
  lastUpdateTime: number;
  lastReportTime: number;
  senderId: string;
  mimeType?: string;
  fileName?: string;
  isAssembling: boolean;
  isComplete: boolean;
  originalChecksum?: string;
  useDiskWrite: boolean;
  fileHandleReady: boolean; // ✅ 추가: 파일 핸들 준비 상태
}

class FileReceiver {
  private transfers = new Map<string, TransferState>();
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly ASSEMBLY_DELAY = 500;
  private readonly SIZE_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB
  private pendingHandles = new Set<string>(); // ✅ 추가: 대기 중인 핸들 세트

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private async handleMessage(e: MessageEvent) {
    const { type, payload } = e.data;

    switch (type) {
      case 'init-transfer':
        this.initTransfer(payload);
        break;
      case 'chunk':
        await this.handleChunk(payload);
        break;
      case 'assemble':
        await this.assemble(payload);
        break;
      case 'cancel':
        this.cancelTransfer(payload.transferId);
        break;
      case 'file-handle-ready':
        await this.startDiskWrite(payload);
        break;
    }
  }

  private initTransfer(payload: InitTransferPayload) {
    if (this.transfers.has(payload.transferId)) {
      console.warn(`[Receiver Worker] Transfer already initialized: ${payload.transferId}`);
      return;
    }

    const useDiskWrite = payload.totalSize >= this.SIZE_THRESHOLD;

    this.transfers.set(payload.transferId, {
      chunks: new Map(),
      receivedCount: 0,
      totalChunks: payload.totalChunks,
      totalSize: payload.totalSize,
      receivedSize: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      lastReportTime: Date.now(),
      senderId: payload.senderId,
      mimeType: payload.mimeType,
      fileName: payload.fileName,
      isAssembling: false,
      isComplete: false,
      originalChecksum: payload.originalChecksum,
      useDiskWrite,
      fileHandleReady: !useDiskWrite // 소형 파일은 즉시 준비 완료
    });

    // ✅ 추가: init-transfer 내부 마지막에 추가
    const readyEarly = this.pendingHandles.has(payload.transferId);
    if (readyEarly) {
      this.pendingHandles.delete(payload.transferId);
      const s = this.transfers.get(payload.transferId);
      if (s) s.fileHandleReady = true;
    }

    console.log(`[Receiver Worker] 📦 Transfer initialized:`, {
      transferId: payload.transferId,
      totalChunks: payload.totalChunks,
      totalSize: payload.totalSize,
      strategy: useDiskWrite ? '💾 Disk Write' : '🧠 Memory (Blob)'
    });
  }

  private async handleChunk(payload: ChunkPayload) {
    const { transferId, index, data: rawData, senderId } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] Unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.log(`[Receiver Worker] ✅ Transfer complete, ignoring chunk ${index}`);
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });
      return;
    }

    if (index < 0 || (state.totalChunks > 0 && index >= state.totalChunks)) {
      console.error(`[Receiver Worker] Invalid index: ${index}`);
      return;
    }

    if (state.chunks.has(index)) {
      console.log(`[Receiver Worker] ⚠️ Duplicate chunk ${index}, sending ACK again`);
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });
      return;
    }

    const arrayBuffer = rawData instanceof ArrayBuffer ? rawData : (rawData as { buffer: ArrayBuffer }).buffer;
    const view = new DataView(arrayBuffer);
    let offset = 0;

    try {
      const packetType = view.getUint8(offset);
      offset += 1;

      if (packetType !== 1) {
        console.error(`[Receiver Worker] Invalid packet type: ${packetType}`);
        return;
      }

      const idLen = view.getUint16(offset, false);
      offset += 2;

      const idBytes = new Uint8Array(arrayBuffer, offset, idLen);
      offset += idLen;
      const parsedTransferId = new TextDecoder().decode(idBytes);

      if (parsedTransferId !== transferId) {
        console.error(`[Receiver Worker] TransferId mismatch`);
        return;
      }

      const chunkIndex = view.getUint32(offset, false);
      offset += 4;

      if (chunkIndex !== index) {
        console.error(`[Receiver Worker] ChunkIndex mismatch`);
        return;
      }

      const dataLength = view.getUint32(offset, false);
      offset += 4;

      if (offset + dataLength > arrayBuffer.byteLength) {
        console.error(`[Receiver Worker] Data overflow`);
        return;
      }

      // ⚠️ 중요: 청크 데이터를 복사해서 저장 (Transferable 문제 해결)
      const chunkData = arrayBuffer.slice(offset, offset + dataLength);

      state.chunks.set(index, chunkData);
      state.receivedCount++;
      state.receivedSize += chunkData.byteLength;
      state.lastUpdateTime = Date.now();

      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });

      const now = Date.now();
      if (now - state.lastReportTime >= this.PROGRESS_REPORT_INTERVAL || state.receivedCount % 100 === 0) {
        this.reportProgress(transferId, state);
        state.lastReportTime = now;
      }

      if (state.receivedCount === state.totalChunks) {
        console.log(`[Receiver Worker] 🎉 All ${state.totalChunks} chunks received!`);
        
        setTimeout(() => {
          const currentState = this.transfers.get(transferId);
          if (currentState && !currentState.isAssembling && !currentState.isComplete) {
            this.assemble({
              transferId,
              mimeType: currentState.mimeType || 'application/octet-stream',
              fileName: currentState.fileName || 'download'
            });
          }
        }, this.ASSEMBLY_DELAY);
      }

    } catch (error) {
      console.error(`[Receiver Worker] Parsing error:`, error);
    }
  }

  private reportProgress(transferId: string, state: TransferState) {
    if (state.totalSize === 0) return;

    const elapsed = (Date.now() - state.startTime) / 1000;
    const speed = elapsed > 0 ? state.receivedSize / elapsed : 0;
    const progress = Math.min(1, state.receivedSize / state.totalSize);
    const remaining = Math.max(0, state.totalSize - state.receivedSize);
    const eta = speed > 0 ? remaining / speed : Infinity;

    self.postMessage({
      type: 'progress',
      payload: {
        transferId,
        progress,
        speed,
        eta,
        received: state.receivedSize,
        total: state.totalSize,
        chunksReceived: state.receivedCount,
        totalChunks: state.totalChunks
      },
    });
  }

  private async assemble(payload: AssemblePayload) {
    const { transferId, mimeType, fileName } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] Cannot assemble unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.warn(`[Receiver Worker] Already complete: ${transferId}`);
      return;
    }

    if (state.isAssembling) {
      console.warn(`[Receiver Worker] Already assembling: ${transferId}`);
      return;
    }

    if (state.chunks.size !== state.totalChunks) {
      console.error(`[Receiver Worker] ❌ Chunk mismatch: expected ${state.totalChunks}, got ${state.chunks.size}`);
      
      const missingChunks: number[] = [];
      for (let i = 0; i < state.totalChunks; i++) {
        if (!state.chunks.has(i)) {
          missingChunks.push(i);
        }
      }
      
      if (missingChunks.length > 0) {
        console.error(`[Receiver Worker] Missing chunks: ${missingChunks.slice(0, 20).join(', ')}`);
        self.postMessage({
          type: 'error',
          payload: {
            transferId,
            message: `Missing ${missingChunks.length} chunks`
          }
        });
        return;
      }
    }

    state.isAssembling = true;
    self.postMessage({ type: 'assembling', payload: { transferId } });

    try {
      if (state.useDiskWrite) {
        // 2GB 이상: File System Access API 사용
        await this.assembleToDisk(transferId, state, fileName, mimeType);
      } else {
        // 2GB 미만: Blob 사용
        await this.assembleToBlob(transferId, state, fileName, mimeType);
      }
    } catch (e) {
      console.error(`[Receiver Worker] Assembly error:`, e);
      self.postMessage({ type: 'error', payload: { transferId, message: (e as Error).message } });
    }
  }

  private async assembleToBlob(transferId: string, state: TransferState, fileName: string, mimeType: string) {
    console.log(`[Receiver Worker] 🧠 Assembling to Blob (${state.totalChunks} chunks, ${state.totalSize} bytes)`);

    const sortedChunks: ArrayBuffer[] = [];
    let calculatedSize = 0;
    let lastReport = 0;

    for (let i = 0; i < state.totalChunks; i++) {
      const chunk = state.chunks.get(i);
      if (!chunk) {
        self.postMessage({ type: 'error', payload: { transferId, message: `Missing chunk ${i}` } });
        return;
      }
      sortedChunks.push(chunk);
      calculatedSize += chunk.byteLength;

      const now = Date.now();
      if (now - lastReport >= 200 || i === state.totalChunks - 1) {
        const progress = (i + 1) / state.totalChunks;
        self.postMessage({
          type: 'assemble-progress',
          payload: { transferId, progress, chunks: i + 1, totalChunks: state.totalChunks, mode: 'blob' }
        });
        lastReport = now;
      }
    }

    if (calculatedSize !== state.totalSize) {
      self.postMessage({ type: 'error', payload: { transferId, message: `Size mismatch: expected ${state.totalSize}, got ${calculatedSize}` } });
      return;
    }

    self.postMessage({ type: 'finalize-start', payload: { transferId, stage: 'blob' } });
    const blob = new Blob(sortedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const totalTime = (Date.now() - state.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? state.totalSize / totalTime : 0;

    state.isComplete = true;

    self.postMessage({
      type: 'complete',
      payload: {
        transferId,
        url,
        name: fileName,
        size: blob.size,
        averageSpeed,
        totalTime
      },
    });

    // 메모리 정리
    state.chunks.clear();
    
    setTimeout(() => {
      this.transfers.delete(transferId);
    }, 60000);

    console.log(`[Receiver Worker] ✅ Blob assembly complete!`);
  }

  private async assembleToDisk(transferId: string, state: TransferState, fileName: string, mimeType: string) {
    if (!state.fileHandleReady) {
      self.postMessage({ type: 'request-file-handle', payload: { transferId, fileName, mimeType, totalSize: state.totalSize, totalChunks: state.totalChunks } });
      return;
    }
    const BATCH_TARGET_BYTES = 4 * 1024 * 1024;
    const BATCH_MAX_CHUNKS = 128;

    let parts: ArrayBuffer[] = [];
    let total = 0;

    for (let i = 0; i < state.totalChunks; i++) {
      const chunk = state.chunks.get(i);
      if (!chunk) {
        self.postMessage({ type: 'error', payload: { transferId, message: `Missing chunk ${i}` } });
        return;
      }
      const copy = chunk.slice(0);
      parts.push(copy);
      total += copy.byteLength;
      state.chunks.delete(i);

      const shouldFlush = total >= BATCH_TARGET_BYTES || parts.length >= BATCH_MAX_CHUNKS || i === state.totalChunks - 1;
      if (shouldFlush) {
        const isLastBatch = i === state.totalChunks - 1;
        self.postMessage({ type: 'write-batch', payload: { transferId, parts, isLastBatch } }, parts as unknown as Transferable[]);
        parts = [];
        total = 0;
        if (i > 0 && i % 2000 === 0) await new Promise(r => setTimeout(r, 30));
      }
    }

    state.isComplete = true;
  }

  private async startDiskWrite(payload: { transferId: string }) {
    const { transferId } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] Unknown transfer for disk write: ${transferId}`);
      return;
    }

    console.log(`[Receiver Worker] 💾 Starting disk write (${state.totalChunks} chunks)`);

    for (let i = 0; i < state.totalChunks; i++) {
      const chunk = state.chunks.get(i);
      if (!chunk) {
        self.postMessage({
          type: 'error',
          payload: { transferId, message: `Missing chunk ${i}` }
        });
        return;
      }

      // ⚠️ 중요: 복사본 전송 (원본 유지)
      const chunkCopy = chunk.slice(0);

      self.postMessage({
        type: 'write-chunk',
        payload: {
          transferId,
          chunkIndex: i,
          data: chunkCopy,
          isLast: i === state.totalChunks - 1
        }
      }, [chunkCopy]);

      if (i % 1000 === 0) {
        console.log(`[Receiver Worker] 💾 Sent ${i}/${state.totalChunks} chunks to disk`);
      }

      if (i > 0 && i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    state.isComplete = true;
    state.chunks.clear();

    console.log(`[Receiver Worker] ✅ All chunks sent for disk write`);
  }

  private cancelTransfer(transferId: string) {
    const state = this.transfers.get(transferId);
    if (state) {
      state.chunks.clear();
      this.transfers.delete(transferId);
    }

    self.postMessage({
      type: 'cancelled',
      payload: { transferId },
    });
  }
}

new FileReceiver();