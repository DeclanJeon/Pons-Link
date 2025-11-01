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
}

class FileReceiver {
  private transfers = new Map<string, TransferState>();
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly ASSEMBLY_DELAY = 3000;

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
    }
  }

  private initTransfer(payload: InitTransferPayload) {
    if (this.transfers.has(payload.transferId)) {
      console.warn(`[Receiver Worker] Transfer already initialized: ${payload.transferId}`);
      return;
    }

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
    });

    console.log(`[Receiver Worker] 🚀 Transfer initialized:`, {
      transferId: payload.transferId,
      totalChunks: payload.totalChunks,
      totalSize: payload.totalSize,
      senderId: payload.senderId,
    });
  }

  private async handleChunk(payload: ChunkPayload) {
    const { transferId, index, data: rawData, senderId } = payload;
    let state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] ❌ Unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.log(`[Receiver Worker] 🚫 Transfer complete, ignoring chunk ${index} and sending ACK`);
      // ✅ ACK를 보내서 송신자가 재전송을 멈추도록 함
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });
      return;
    }

    // ✅ 인덱스 검증 (이미 파싱되어 전달됨)
    if (index < 0) {
      console.error(`[Receiver Worker] ❌ Negative index: ${index}`);
      return;
    }
    
    if (state.totalChunks > 0 && index >= state.totalChunks) {
      console.error(`[Receiver Worker] ❌ Index out of range: ${index} >= ${state.totalChunks}`);
      return;
    }

    if (state.chunks.has(index)) {
      console.warn(`[Receiver Worker] ⚠️ Duplicate chunk ${index}`);
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });
      return;
    }

    // ✅ 패킷 파싱 (체크섬 포함)
    const arrayBuffer = rawData instanceof ArrayBuffer ? rawData : (rawData as any).buffer;
    const view = new DataView(arrayBuffer);
    let offset = 0;

    try {
      // 패킷 타입 (1 byte)
      const packetType = view.getUint8(offset);
      offset += 1;

      if (packetType !== 1) {
        console.error(`[Receiver Worker] ❌ Invalid packet type: ${packetType}`);
        return;
      }

      // transferId 길이 (2 bytes)
      const idLen = view.getUint16(offset, false);
      offset += 2;

      // transferId (n bytes)
      const idBytes = new Uint8Array(arrayBuffer, offset, idLen);
      offset += idLen;
      const parsedTransferId = new TextDecoder().decode(idBytes);

      if (parsedTransferId !== transferId) {
        console.error(`[Receiver Worker] ❌ TransferId mismatch: expected ${transferId}, got ${parsedTransferId}`);
        return;
      }

      // 청크 인덱스 (4 bytes)
      const chunkIndex = view.getUint32(offset, false);
      offset += 4;

      if (chunkIndex !== index) {
        console.error(`[Receiver Worker] ❌ ChunkIndex mismatch: expected ${index}, got ${chunkIndex}`);
        return;
      }

      // 데이터 길이 (4 bytes)
      const dataLength = view.getUint32(offset, false);
      offset += 4;

      // ✅ 체크섬 길이 (2 bytes)
      const checksumLength = view.getUint16(offset, false);
      offset += 2;

      // ✅ 체크섬 (64 bytes)
      const checksumBytes = new Uint8Array(arrayBuffer, offset, checksumLength);
      offset += checksumLength;
      const expectedChecksum = new TextDecoder().decode(checksumBytes);

      // 데이터 추출
      if (offset + dataLength > arrayBuffer.byteLength) {
        console.error(`[Receiver Worker] ❌ Data overflow:`, {
          offset,
          dataLength,
          totalSize: arrayBuffer.byteLength,
        });
        return;
      }

      const chunkData = arrayBuffer.slice(offset, offset + dataLength);

      // ✅ 체크섬 검증
      const actualChecksum = await this.calculateChecksum(chunkData);

      if (actualChecksum !== expectedChecksum) {
        console.error(`[Receiver Worker] ❌ CHECKSUM MISMATCH for chunk ${index}:`, {
          expected: expectedChecksum,
          actual: actualChecksum,
          dataLength: chunkData.byteLength,
        });
        return; // ACK를 보내지 않음 (재전송 유도)
      }

      console.log(`[Receiver Worker] ✅ Chunk ${index} checksum verified (${chunkData.byteLength} bytes)`);

      // 청크 저장
      state.chunks.set(index, chunkData);
      state.receivedCount++;
      state.receivedSize += chunkData.byteLength;
      state.lastUpdateTime = Date.now();

      // ACK 전송
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });

      // 진행률 보고
      const now = Date.now();
      if (now - state.lastReportTime >= this.PROGRESS_REPORT_INTERVAL || state.receivedCount % 50 === 0) {
        this.reportProgress(transferId, state);
        state.lastReportTime = now;
      }

    } catch (error) {
      console.error(`[Receiver Worker] ❌ Parsing error:`, error);
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
      },
    });
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async assemble(payload: AssemblePayload) {
    const { transferId, mimeType, fileName } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] ❌ Cannot assemble unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.warn(`[Receiver Worker] ⚠️ Transfer ${transferId} already complete`);
      return;
    }

    if (state.chunks.size !== state.totalChunks) {
      console.error(`[Receiver Worker] ❌ Chunk count mismatch: expected ${state.totalChunks}, got ${state.chunks.size}`);
      self.postMessage({ type: 'error', payload: { transferId, message: 'Chunk count mismatch' } });
      return;
    }

    self.postMessage({ type: 'assembling', payload: { transferId } });

    try {
      const sortedChunks: ArrayBuffer[] = [];
      let calculatedSize = 0;

      for (let i = 0; i < state.totalChunks; i++) {
        const chunk = state.chunks.get(i);
        if (!chunk) {
          console.error(`[Receiver Worker] ❌ Missing chunk ${i}`);
          self.postMessage({ type: 'error', payload: { transferId, message: `Missing chunk ${i}` } });
          return;
        }
        sortedChunks.push(chunk);
        calculatedSize += chunk.byteLength;
      }

      if (calculatedSize !== state.totalSize) {
        console.error(`[Receiver Worker] ❌ Size mismatch: expected ${state.totalSize}, got ${calculatedSize}`);
        self.postMessage({ type: 'error', payload: { transferId, message: 'Size mismatch' } });
        return;
      }

      const blob = new Blob(sortedChunks, { type: mimeType });

      // ✅ 최종 파일 체크섬 검증
      const finalChecksum = await this.calculateBlobChecksum(blob);
      console.log(`[Receiver Worker] 🔐 Final checksum: ${finalChecksum}`);

      if (state.originalChecksum && finalChecksum !== state.originalChecksum) {
        console.error(`[Receiver Worker] ❌ FILE CORRUPTED:`, {
          expected: state.originalChecksum,
          actual: finalChecksum,
        });
        self.postMessage({ type: 'error', payload: { transferId, message: 'File corrupted: checksum mismatch' } });
        return;
      }

      console.log(`[Receiver Worker] ✅ File integrity verified!`);

      const url = URL.createObjectURL(blob);
      const totalTime = (Date.now() - state.startTime) / 1000;
      const averageSpeed = totalTime > 0 ? state.totalSize / totalTime : 0;

      state.isComplete = true;

      self.postMessage({
        type: 'complete',
        payload: { transferId, url, name: fileName, size: blob.size, averageSpeed, totalTime },
      });

      // ✅ 수정: 청크 데이터만 삭제, 상태는 유지 (60초 후 삭제)
      state.chunks.clear();
      
      setTimeout(() => {
        const s = this.transfers.get(transferId);
        if (s) {
          this.transfers.delete(transferId);
          console.log(`[Receiver Worker] 🗑️ Transfer state deleted: ${transferId}`);
        }
      }, 60000); // ✅ 10초 → 60초로 증가

    } catch (e) {
      self.postMessage({ type: 'error', payload: { transferId, message: (e as Error).message } });
    }
  }

  private async calculateBlobChecksum(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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