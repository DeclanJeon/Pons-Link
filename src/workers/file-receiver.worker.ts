declare const self: DedicatedWorkerGlobalScope;

interface ChunkPayload {
  transferId: string;
  index: number;
  data: ArrayBuffer;
  senderId: string; // ✅ 추가
}

interface InitTransferPayload {
  transferId: string;
  totalChunks: number;
  totalSize: number;
  senderId: string; // ✅ 추가
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
 senderId: string; // ✅ 추가
}

class FileReceiver {
  private transfers = new Map<string, TransferState>();
  private readonly PROGRESS_REPORT_INTERVAL = 200; // ✅ 200ms마다 진행률 보고

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
    // ✅ 중복 초기화 방지
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
      senderId: payload.senderId, // ✅ 추가
    });

    console.log(`[Receiver Worker] Transfer initialized:`, payload);
  }

  private async handleChunk(payload: ChunkPayload) {
    const { transferId, index, data, senderId } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.warn(`[Receiver Worker] Unknown transfer: ${transferId}`);
      return;
    }

    // ✅ 중복 청크 무시
    if (state.chunks.has(index)) {
      console.warn(`[Receiver Worker] Duplicate chunk ignored: ${index}`);
      return;
    }

    state.chunks.set(index, data);
    state.receivedCount++;
    state.receivedSize += data.byteLength;
    state.lastUpdateTime = Date.now();

    // ✅ ACK 즉시 전송 (senderId 포함)
    self.postMessage({
      type: 'ack',
      payload: {
        transferId,
        chunkIndex: index,
        senderId: senderId || state.senderId // ✅ 송신자 ID 포함
      },
    });

    // ✅ 진행률 보고 (일정 간격마다)
    const now = Date.now();
    if (
      now - state.lastReportTime >= this.PROGRESS_REPORT_INTERVAL ||
      state.receivedCount % 10 === 0
    ) {
      this.reportProgress(transferId, state);
      state.lastReportTime = now;
    }

    // ✅ 완료 체크
    if (state.receivedCount === state.totalChunks) {
      console.log(`[Receiver Worker] All chunks received for ${transferId}`);
    }
  }

  private reportProgress(transferId: string, state: TransferState) {
    const elapsed = (Date.now() - state.startTime) / 1000;
    const speed = elapsed > 0 ? state.receivedSize / elapsed : 0;
    const progress = state.receivedSize / state.totalSize;
    const remaining = state.totalSize - state.receivedSize;
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

  private async assemble(payload: AssemblePayload) {
    const { transferId, mimeType, fileName } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[Receiver Worker] Cannot assemble unknown transfer: ${transferId}`);
      return;
    }

    if (state.receivedCount !== state.totalChunks) {
      console.error(
        `[Receiver Worker] Incomplete transfer: ${state.receivedCount}/${state.totalChunks}`
      );
      return;
    }

    self.postMessage({
      type: 'assembling',
      payload: { transferId },
    });

    try {
      const sortedChunks = Array.from(state.chunks.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, data]) => data);

      const blob = new Blob(sortedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);

      const totalTime = (Date.now() - state.startTime) / 1000;
      const averageSpeed = totalTime > 0 ? state.totalSize / totalTime : 0;

      console.log(`[Receiver Worker] Assembly complete:`, {
        transferId,
        fileName,
        size: blob.size,
        totalTime: `${totalTime.toFixed(2)}s`,
        averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)} MB/s`,
      });

      self.postMessage({
        type: 'complete',
        payload: {
          transferId,
          url,
          name: fileName,
          size: blob.size,
          averageSpeed,
          totalTime,
        },
      });

      // ✅ 메모리 정리
      state.chunks.clear();
      this.transfers.delete(transferId);
    } catch (error) {
      console.error('[Receiver Worker] Assembly error:', error);
      self.postMessage({
        type: 'error',
        payload: {
          transferId,
          message: (error as Error).message,
        },
      });
    }
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