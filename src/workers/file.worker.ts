/// <reference lib="webworker" />
/**
 * @fileoverview 하이브리드 파일 전송 워커 (SCTP + 경량 ACK)
 * @module workers/file.worker
 * @description SCTP의 신뢰성을 활용하되, 진행률 동기화를 위한 경량 ACK 유지
 */

import {
  calculateTotalChunks,
  calculateFileOffset,
  calculateActualChunkSize,
} from '../lib/fileTransferUtils';

declare const self: DedicatedWorkerGlobalScope;

// 전송 설정 (단순화)
const TRANSFER_CONFIG = {
  windowSize: 16,        // 동시 전송 청크 수
  maxRetries: 3,         // 최대 재시도 (네트워크 끊김 대비)
  stallTimeout: 5000,    // 진행 없음 타임아웃 (5초)
  sendDelay: 5,          // 청크 간 지연 (ms)
};

interface ChunkState {
  acked: boolean;
  sent: boolean;
  retries: number;
  lastSentTime: number;
  size: number;
}

class HybridFileWorker {
  private file: File | null = null;
  private transferId: string = '';
  private chunkSize: number = 0;
  private totalChunks: number = 0;
  private chunkStates: Map<number, ChunkState> = new Map();

  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private isSendingAllowed: boolean = true;

  private currentWindowSize: number = TRANSFER_CONFIG.windowSize;
  private inFlightChunks: Set<number> = new Set();
  private nextChunkToSend: number = 0;

  private startTime: number = 0;
  private bytesAcked: number = 0;
  private bytesSent: number = 0;
  private lastProgressReportTime: number = 0;
  private lastActivityTime: number = 0;
  private stallCheckInterval: number | null = null;

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private resetState(): void {
    this.file = null;
    this.transferId = '';
    this.chunkSize = 0;
    this.totalChunks = 0;
    this.chunkStates.clear();
    this.isCancelled = false;
    this.isPaused = false;
    this.isSendingAllowed = true;
    this.currentWindowSize = TRANSFER_CONFIG.windowSize;
    this.inFlightChunks.clear();
    this.nextChunkToSend = 0;
    this.startTime = 0;
    this.bytesAcked = 0;
    this.bytesSent = 0;
    this.lastActivityTime = 0;
    
    if (this.stallCheckInterval) {
      self.clearInterval(this.stallCheckInterval);
      this.stallCheckInterval = null;
    }
    
    console.log('[FileWorker] State reset');
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
        console.log('[FileWorker] Transfer paused');
        break;
      case 'resume-transfer':
        this.isPaused = false;
        console.log('[FileWorker] Transfer resumed');
        this.transferLoop();
        break;
      case 'cancel-transfer':
        this.cancelTransfer();
        break;
      default:
        console.warn(`[FileWorker] Unknown message type: ${type}`);
    }
  }

  private async startTransfer(file: File, transferId: string, chunkSize: number): Promise<void> {
    this.file = file;
    this.transferId = transferId;
    this.chunkSize = chunkSize;
    this.totalChunks = calculateTotalChunks(file.size, this.chunkSize);
    this.startTime = Date.now();
    this.lastActivityTime = Date.now();

    this.initializeChunkStates();
    console.log(`[FileWorker] Starting transfer: ${transferId}, Chunks: ${this.totalChunks}`);
    
    // 진행 멈춤 감지 (5초마다 체크)
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
        size: calculateActualChunkSize(this.file!.size, i, this.chunkSize),
      });
    }
  }

  private async transferLoop(): Promise<void> {
    if (this.isCancelled || this.isPaused) return;

    // 윈도우 크기만큼 청크 전송
    while (
      this.isSendingAllowed &&
      this.inFlightChunks.size < this.currentWindowSize &&
      this.nextChunkToSend < this.totalChunks
    ) {
      const chunkIndex = this.nextChunkToSend;
      this.nextChunkToSend++;
      await this.sendChunk(chunkIndex);
      
      // 작은 지연으로 CPU 양보
      if (TRANSFER_CONFIG.sendDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, TRANSFER_CONFIG.sendDelay));
      }
    }

    // 모든 청크가 ACK되었는지 확인
    if (this.getAckedCount() === this.totalChunks) {
      await this.completeTransfer();
    }
  }

  private async sendChunk(chunkIndex: number): Promise<void> {
    if (!this.file || this.isCancelled) return;

    const state = this.chunkStates.get(chunkIndex);
    if (!state || state.acked) return;

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
      
    } catch (error) {
      console.error(`[FileWorker] Error preparing chunk ${chunkIndex}:`, error);
      this.inFlightChunks.delete(chunkIndex);
    }
  }

  private createChunkPacket(chunkIndex: number, data: ArrayBuffer): ArrayBuffer {
    const transferIdBytes = new TextEncoder().encode(this.transferId);
    const headerSize = 1 + 2 + transferIdBytes.length + 4;
    const packet = new ArrayBuffer(headerSize + data.byteLength);
    const view = new DataView(packet);
    
    let offset = 0;
    view.setUint8(offset, 1); // Type: DATA
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
      
      this.reportProgress();
      this.transferLoop();
    }
  }

  private checkStall(): void {
    if (this.isPaused || this.isCancelled) return;

    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;

    // 5초 이상 진행 없으면 재전송 시도
    if (timeSinceActivity > TRANSFER_CONFIG.stallTimeout && this.inFlightChunks.size > 0) {
      console.warn(`[FileWorker] Stall detected, retrying in-flight chunks`);
      
      this.inFlightChunks.forEach(chunkIndex => {
        const state = this.chunkStates.get(chunkIndex);
        if (state && state.retries < TRANSFER_CONFIG.maxRetries) {
          state.retries++;
          state.sent = false;
          this.inFlightChunks.delete(chunkIndex);
          this.sendChunk(chunkIndex);
        } else if (state && state.retries >= TRANSFER_CONFIG.maxRetries) {
          this.cancelTransfer(`Chunk ${chunkIndex} failed after max retries`);
        }
      });
      
      this.lastActivityTime = now;
    }
  }

  private async completeTransfer(): Promise<void> {
    if (this.isCancelled) return;

    console.log(`[FileWorker] Transfer complete: ${this.transferId}`);

    // END 신호 전송
    const transferIdBytes = new TextEncoder().encode(this.transferId);
    const endPacket = new ArrayBuffer(1 + 2 + transferIdBytes.length);
    const view = new DataView(endPacket);
    
    view.setUint8(0, 2); // Type: END
    view.setUint16(1, transferIdBytes.length, false);
    new Uint8Array(endPacket, 3).set(transferIdBytes);

    // END 신호 3번 전송
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

    // 완료 알림
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.file!.size / totalTime : 0;

    self.postMessage({
      type: 'transfer-complete',
      payload: {
        transferId: this.transferId,
        startTime: this.startTime,
        totalSize: this.file!.size,
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
    const eta = speed > 0 ? (this.file!.size - this.bytesAcked) / speed : Infinity;
    
    self.postMessage({
      type: 'progress-update',
      payload: {
        transferId: this.transferId,
        ackedSize: this.bytesAcked,
        sentSize: this.bytesSent,
        totalSize: this.file!.size,
        ackedChunks: this.getAckedCount(),
        sentChunks: this.nextChunkToSend,
        totalChunks: this.totalChunks,
        speed,
        eta,
        startTime: this.startTime,
      },
    });
  }

  private getAckedCount = (): number => 
    Array.from(this.chunkStates.values()).filter(s => s.acked).length;

  private cancelTransfer(reason: string = "User cancelled"): void {
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
    
    this.resetState();
    console.log(`[FileWorker] Cleanup complete`);
  }
}

new HybridFileWorker();
