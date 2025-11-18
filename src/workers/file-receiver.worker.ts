declare const self: DedicatedWorkerGlobalScope;

// --- OPFS Type Definitions ---
interface FileSystemSyncAccessHandle {
  read(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
  write(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
  flush(): void;
  close(): void;
  truncate(newSize: number): void;
  getSize(): number;
}

interface FileSystemFileHandle {
  createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}
// -----------------------------

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

interface TransferState {
  receivedCount: number;
  totalChunks: number;
  totalSize: number;
  receivedSize: number;
  startTime: number;
  lastReportTime: number;
  senderId: string;
  mimeType: string;
  fileName: string;
  isComplete: boolean;
  useDiskWrite: boolean;
  
  // 🧠 Memory Mode
  chunks: Map<number, ArrayBuffer>; 
  
  // 💾 Disk Mode (OPFS)
  opfsHandle?: FileSystemSyncAccessHandle;
  opfsRoot?: FileSystemDirectoryHandle;
  tempFileName?: string;
  
  // 🔄 Sequencer (순서 보장용)
  nextExpectedIndex: number; // 다음에 디스크에 써야 할 청크 번호
  pendingChunks: Map<number, Uint8Array>; // 순서가 안 맞아서 대기 중인 청크들
}

class FileReceiver {
  private transfers = new Map<string, TransferState>();
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly SIZE_THRESHOLD = 100 * 1024 * 1024; // 100MB

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private async handleMessage(e: MessageEvent) {
    const { type, payload } = e.data;

    try {
      switch (type) {
        case 'init-transfer':
          await this.initTransfer(payload);
          break;
        case 'chunk':
          await this.handleChunk(payload);
          break;
        case 'cancel':
          await this.cancelTransfer(payload.transferId);
          break;
      }
    } catch (error) {
      console.error(`[Receiver Worker] Error handling ${type}:`, error);
      if (payload?.transferId) {
        self.postMessage({ 
          type: 'error', 
          payload: { transferId: payload.transferId, message: error.message } 
        });
      }
    }
  }

  private async initTransfer(payload: InitTransferPayload) {
    if (this.transfers.has(payload.transferId)) return;

    const useDiskWrite = payload.totalSize >= this.SIZE_THRESHOLD;
    
    const state: TransferState = {
      receivedCount: 0,
      totalChunks: payload.totalChunks,
      totalSize: payload.totalSize,
      receivedSize: 0,
      startTime: Date.now(),
      lastReportTime: Date.now(),
      senderId: payload.senderId,
      mimeType: payload.mimeType || 'application/octet-stream',
      fileName: payload.fileName || `download_${Date.now()}`,
      isComplete: false,
      useDiskWrite,
      chunks: new Map(),
      
      // Sequencer 초기화
      nextExpectedIndex: 0,
      pendingChunks: new Map()
    };

    if (useDiskWrite) {
      try {
        const root = await navigator.storage.getDirectory();
        const tempName = `temp_${payload.transferId}`;
        const fileHandle = await root.getFileHandle(tempName, { create: true });
        
        const accessHandle = await fileHandle.createSyncAccessHandle();
        
        state.opfsRoot = root;
        state.opfsHandle = accessHandle;
        state.tempFileName = tempName;
        
        console.log(`[Receiver Worker] 💾 OPFS Initialized: ${tempName}`);
      } catch (e) {
        console.error('[Receiver Worker] OPFS init failed, falling back to memory:', e);
        state.useDiskWrite = false;
      }
    }

    this.transfers.set(payload.transferId, state);
    self.postMessage({ type: 'transfer-ready', payload: { transferId: payload.transferId } });
  }

  private async handleChunk(payload: ChunkPayload) {
    const { transferId, index, data: rawData, senderId } = payload;
    const state = this.transfers.get(transferId);

    if (!state || state.isComplete) {
      self.postMessage({ type: 'ack', payload: { transferId, chunkIndex: index, senderId } });
      return;
    }

    // ArrayBuffer Parsing
    const arrayBuffer = rawData instanceof ArrayBuffer ? rawData : (rawData as { buffer: ArrayBuffer }).buffer;
    const view = new DataView(arrayBuffer);
    let offset = 1;
    const idLen = view.getUint16(offset, false);
    offset += 2 + idLen;
    const chunkIndex = view.getUint32(offset, false); // 패킷 내부의 진짜 인덱스 확인
    offset += 4;
    const dataLength = view.getUint32(offset, false);
    offset += 4;
    
    const chunkData = new Uint8Array(arrayBuffer, offset, dataLength);

    // --- 데이터 저장 로직 (Sequencer 적용) ---
    if (state.useDiskWrite && state.opfsHandle) {
      // 1. 일단 받은 데이터를 대기열(Pending)에 넣거나 바로 씁니다.
      if (chunkIndex === state.nextExpectedIndex) {
        // A. 정순서 도착: 즉시 쓰기
        state.opfsHandle.write(chunkData);
        state.nextExpectedIndex++;

        // B. 대기열 확인: 혹시 다음 순서 데이터가 이미 와 있나?
        while (state.pendingChunks.has(state.nextExpectedIndex)) {
          const nextData = state.pendingChunks.get(state.nextExpectedIndex)!;
          state.opfsHandle.write(nextData);
          state.pendingChunks.delete(state.nextExpectedIndex);
          state.nextExpectedIndex++;
        }
      } else {
        // C. 순서 어긋남: 대기열에 저장 (메모리에 잠시 보관)
        // console.warn(`[Receiver] Out of order! Got ${chunkIndex}, expect ${state.nextExpectedIndex}`);
        state.pendingChunks.set(chunkIndex, chunkData.slice()); // 복사해서 저장
      }
    } else {
      // 🧠 Memory Mode: Map은 순서 상관없음 (나중에 정렬해서 합침)
      state.chunks.set(chunkIndex, chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength));
    }

    state.receivedCount++;
    state.receivedSize += chunkData.byteLength;

    // ACK 전송
    self.postMessage({ type: 'ack', payload: { transferId, chunkIndex, senderId } });

    // 진행률 보고
    const now = Date.now();
    if (now - state.lastReportTime >= this.PROGRESS_REPORT_INTERVAL || state.receivedCount === state.totalChunks) {
      this.reportProgress(transferId, state);
      state.lastReportTime = now;
    }

    // 완료 처리
    if (state.receivedCount === state.totalChunks) {
      // 혹시라도 pending에 남은게 있는지 확인 (이론상 없어야 함)
      if (state.useDiskWrite && state.pendingChunks.size > 0) {
        console.warn(`[Receiver] Finalizing with ${state.pendingChunks.size} pending chunks left! Force writing...`);
        // 남은거 강제 쓰기 (순서대로)
        const sortedKeys = Array.from(state.pendingChunks.keys()).sort((a, b) => a - b);
        for (const key of sortedKeys) {
           state.opfsHandle?.write(state.pendingChunks.get(key)!);
        }
        state.pendingChunks.clear();
      }
      
      await this.finalizeTransfer(transferId, state);
    }
  }

  private reportProgress(transferId: string, state: TransferState) {
    const elapsed = (Date.now() - state.startTime) / 1000;
    const speed = elapsed > 0 ? state.receivedSize / elapsed : 0;
    const progress = state.receivedSize / state.totalSize;
    
    self.postMessage({
      type: 'progress',
      payload: { transferId, progress, speed, received: state.receivedSize, total: state.totalSize }
    });
  }

  private async finalizeTransfer(transferId: string, state: TransferState) {
    if (state.isComplete) return;
    state.isComplete = true;

    console.log(`[Receiver Worker] ✅ Finalizing ${state.fileName}`);

    if (state.useDiskWrite && state.opfsHandle) {
      state.opfsHandle.flush();
      state.opfsHandle.close();
      state.opfsHandle = undefined;

      self.postMessage({
        type: 'complete',
        payload: {
          transferId,
          fileName: state.fileName,
          fileType: state.mimeType,
          storageMode: 'opfs',
          tempFileName: state.tempFileName,
          size: state.totalSize
        }
      });
    } else {
      const sortedChunks = Array.from(state.chunks.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, chunk]) => chunk);
      
      const blob = new Blob(sortedChunks, { type: state.mimeType });
      const url = URL.createObjectURL(blob);

      self.postMessage({
        type: 'complete',
        payload: {
          transferId,
          fileName: state.fileName,
          fileType: state.mimeType,
          storageMode: 'blob',
          url,
          size: blob.size
        }
      });
      
      state.chunks.clear();
    }

    setTimeout(() => this.transfers.delete(transferId), 10000);
  }

  private async cancelTransfer(transferId: string) {
    const state = this.transfers.get(transferId);
    if (state) {
      if (state.opfsHandle) {
        state.opfsHandle.close();
        try {
          if (state.opfsRoot && state.tempFileName) {
            await state.opfsRoot.removeEntry(state.tempFileName);
          }
        } catch (e) { console.warn(e); }
      }
      state.chunks.clear();
      state.pendingChunks?.clear(); // 대기열 정리
      this.transfers.delete(transferId);
    }
    self.postMessage({ type: 'cancelled', payload: { transferId } });
  }
}

new FileReceiver();
