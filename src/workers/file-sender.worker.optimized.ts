declare const self: DedicatedWorkerGlobalScope;

import { StreamingFileReader } from '@/lib/fileTransfer/streamingFileReader';
import { AdaptiveChecksumValidator } from '@/lib/fileTransfer/adaptiveChecksumValidator';
import { getChecksumWorkerPool } from '@/lib/fileTransfer/checksumWorkerPool';
import { PreflightAnalyzer, formatFileSize, formatETA, formatSpeed } from '@/lib/fileTransfer/preflightAnalyzer';
import { BatchAckManager } from '@/lib/fileTransfer/batchAckManager';
import { AdaptiveWindowManager } from '@/lib/fileTransfer/adaptiveWindowManager';
import { LRUChunkCache } from '@/lib/fileTransfer/lruChunkCache';
import { ProgressSmoother, formatProgress } from '@/lib/fileTransfer/progressSmoother';
import { ErrorRecoveryManager } from '@/lib/fileTransfer/errorRecoveryManager';
import { MetadataPreflight } from '@/lib/fileTransfer/metadataPreflight';

interface StartTransferPayload {
  file: File;
  transferId: string;
  chunkSize: number;
}

class OptimizedFileSender {
  private file: File | null = null;
  private transferId = '';
  private chunkSize = 64 * 1024;
  private totalChunks = 0;
  private isPaused = false;
  private isCancelled = false;
  private isSending = false;
  private startTime = 0;
  private bytesSent = 0;
  private ackedChunks = new Set<number>();
  private pendingChunks = new Map<number, { sentAt: number; retries: number }>();
  
  // 최적화 컴포넌트
  private streamingReader: StreamingFileReader | null = null;
  private checksumValidator: AdaptiveChecksumValidator | null = null;
  private checksumPool = getChecksumWorkerPool();
  private batchAckManager = new BatchAckManager();
  private windowManager = new AdaptiveWindowManager();
  private chunkCache = new LRUChunkCache();
  private progressSmoother = new ProgressSmoother();
  private errorRecovery = new ErrorRecoveryManager();
  private preflightAnalyzer = new PreflightAnalyzer(this.chunkSize);
  
  private lastProgressReport = 0;
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly ACK_TIMEOUT = 15000;
  
  constructor() {
    self.onmessage = this.handleMessage.bind(this);
    this.setupOptimizations();
  }
  
  /**
   * 최적화 컴포넌트 설정
   */
  private setupOptimizations() {
    // 배치 ACK 콜백
    this.batchAckManager.onBatchAck((batchAck) => {
      self.postMessage({
        type: 'batch-ack',
        payload: batchAck
      });
    });
    
    // 프로그레스 스무더 콜백
    this.progressSmoother.onUpdate((update) => {
      this.reportProgress(update);
    });
    
    // 에러 복구 콜백
    this.errorRecovery.onRecovery((chunkIndex, attempt) => {
      console.log(`[OptimizedSender] Recovering chunk ${chunkIndex}, attempt ${attempt}`);
      this.retryChunk(chunkIndex);
    });
    
    this.errorRecovery.onFatalError((chunkIndex, error) => {
      console.error(`[OptimizedSender] Fatal error for chunk ${chunkIndex}:`, error);
      self.postMessage({
        type: 'error',
        payload: {
          transferId: this.transferId,
          message: `Chunk ${chunkIndex} failed permanently: ${error.message}`
        }
      });
    });
    
    this.errorRecovery.onRecoveryComplete((recoveredChunks) => {
      console.log(`[OptimizedSender] Recovery complete for ${recoveredChunks.length} chunks`);
    });
    
    console.log('[OptimizedSender] Optimization components initialized');
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
      case 'batch-ack-received':
        this.handleBatchAck(payload);
        break;
      case 'receiver-complete':
        this.handleReceiverComplete(payload);
        break;
    }
  }
  
  /**
   * 전송 시작 (최적화된 버전)
   */
  private async startTransfer(payload: StartTransferPayload) {
    this.file = payload.file;
    this.transferId = payload.transferId;
    this.chunkSize = payload.chunkSize;
    this.totalChunks = Math.ceil(this.file.size / this.chunkSize);
    this.startTime = Date.now();
    this.bytesSent = 0;
    this.ackedChunks.clear();
    this.pendingChunks.clear();
    this.lastProgressReport = Date.now();
    
    // 스트리밍 리더 초기화
    this.streamingReader = new StreamingFileReader(this.file, this.chunkSize);
    
    // 체크섬 검증기 초기화
    this.checksumValidator = new AdaptiveChecksumValidator(this.file.size, this.chunkSize);
    
    // 프리플라이트 분석 시작
    this.preflightAnalyzer.onProgress((report) => {
      self.postMessage({
        type: 'preflight-progress',
        payload: {
          transferId: this.transferId,
          stage: report.stage,
          progress: report.progress,
          quick: report.quick,
          detailed: report.detailed
        }
      });
    });
    
    const preflightReport = await this.preflightAnalyzer.analyzeFile(this.file);
    
    // 메타데이터 선전송
    const preflightPacket = await new MetadataPreflight(this.chunkSize).prepareTransfer(this.file, this.transferId);
    const serializedPacket = MetadataPreflight.serializePacket(preflightPacket);
    
    self.postMessage({
      type: 'preflight-ready',
      payload: {
        transferId: this.transferId,
        packet: serializedPacket,
        analysis: preflightReport
      }
    }, [serializedPacket]);
    
    // 첫 번째 청크가 포함되어 있으면 ACK 목록에 추가
    if (preflightPacket.firstChunk) {
      this.ackedChunks.add(0);
      this.bytesSent += preflightPacket.firstChunk.size;
    }
    
    console.log(`[OptimizedSender] 🚀 Starting optimized transfer:`, {
      fileName: this.file.name,
      fileSize: this.file.size,
      chunkSize: this.chunkSize,
      totalChunks: this.totalChunks,
      checksumStrategy: this.checksumValidator.getSamplingInfo()
    });
    
    this.sendNextBatch();
  }
  
  /**
   * 다음 배치 전송
   */
  private async sendNextBatch() {
    if (this.isPaused || this.isCancelled || !this.file || this.isSending) return;
    
    this.isSending = true;
    
    try {
      const windowSize = this.windowManager.getWindowSize();
      let sentCount = 0;
      
      // 스트리밍 청크 전송
      if (this.streamingReader) {
        for await (const chunk of this.streamingReader.readChunks()) {
          // 이미 ACK 받은 청크는 스킵
          if (this.ackedChunks.has(chunk.index)) continue;
          
          // 이미 전송 중인 청크는 스킵
          if (this.pendingChunks.has(chunk.index)) continue;
          
          // 윈도우 크기 제한
          if (this.pendingChunks.size >= windowSize) break;
          
          // 체크섬 검증이 필요한 청크만 계산
          let checksum: string | undefined;
          if (this.checksumValidator && this.checksumValidator.shouldValidate(chunk.index)) {
            checksum = await this.checksumPool.calculateChecksum(chunk.data);
          }
          
          // 청크 전송
          await this.sendChunk(chunk.index, chunk.data, checksum, chunk.isLast);
          sentCount++;
          
          // 마지막 청크이면 루프 종료
          if (chunk.isLast) break;
        }
      }
      
      console.log(`[OptimizedSender] 📤 Sent batch: ${sentCount} chunks, window: ${windowSize}`);
      
    } finally {
      this.isSending = false;
    }
  }
  
  /**
   * 청크 전송
   */
  private async sendChunk(
    chunkIndex: number, 
    data: ArrayBuffer, 
    checksum?: string, 
    isLast: boolean = false
  ) {
    if (!this.file) return;
    
    const expectedSize = isLast
      ? this.file.size - chunkIndex * this.chunkSize
      : this.chunkSize;
    
    if (data.byteLength !== expectedSize) {
      console.error(`[OptimizedSender] ❌ Chunk size mismatch at ${chunkIndex}:`, {
        expected: expectedSize,
        actual: data.byteLength,
      });
      return;
    }
    
    // 패킷 생성
    const packet = this.createPacket(chunkIndex, data, checksum || '');
    
    // 캐시에 저장
    this.chunkCache.set(chunkIndex, data);
    
    // 전송 기록
    this.pendingChunks.set(chunkIndex, {
      sentAt: Date.now(),
      retries: 0
    });
    
    // 타임아웃 설정
    setTimeout(() => {
      this.handleTimeout(chunkIndex);
    }, this.ACK_TIMEOUT);
    
    // 전송
    self.postMessage({
      type: 'chunk-ready',
      payload: {
        transferId: this.transferId,
        chunkIndex,
        chunk: packet,
        isLast,
      },
    }, [packet]);
    
    console.log(`[OptimizedSender] 📤 Sending chunk ${chunkIndex}/${this.totalChunks - 1}, size: ${data.byteLength} bytes${isLast ? ' (LAST)' : ''}`);
  }
  
  /**
   * 청크 재시도
   */
  private async retryChunk(chunkIndex: number) {
    if (!this.streamingReader) return;
    
    const chunkData = await this.streamingReader.readChunk(chunkIndex);
    if (!chunkData) {
      console.error(`[OptimizedSender] ❌ Failed to re-read chunk ${chunkIndex}`);
      return;
    }
    
    // 체크섬 계산
    let checksum: string | undefined;
    if (this.checksumValidator && this.checksumValidator.shouldValidate(chunkIndex)) {
      checksum = await this.checksumPool.calculateChecksum(chunkData);
    }
    
    const isLast = chunkIndex === this.totalChunks - 1;
    await this.sendChunk(chunkIndex, chunkData, checksum, isLast);
  }
  
  /**
   * 패킷 생성
   */
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
  
  /**
   * 개별 ACK 처리
   */
  private handleAck(payload: { chunkIndex: number }) {
    const { chunkIndex } = payload;
    
    if (this.ackedChunks.has(chunkIndex)) {
      return;
    }
    
    if (chunkIndex >= this.totalChunks) {
      console.error(`[OptimizedSender] ❌ Invalid ACK: chunk ${chunkIndex} >= totalChunks ${this.totalChunks}`);
      return;
    }
    
    this.ackedChunks.add(chunkIndex);
    this.pendingChunks.delete(chunkIndex);
    this.chunkCache.removeAcked(chunkIndex);
    this.errorRecovery.handleChunkSuccess(chunkIndex);
    
    const chunkBytes = Math.min(
      this.chunkSize,
      this.file!.size - chunkIndex * this.chunkSize
    );
    this.bytesSent += chunkBytes;
    
    // 윈도우 관리자에 알림
    const rtt = Date.now() - (this.pendingChunks.get(chunkIndex)?.sentAt || Date.now());
    this.windowManager.onAckReceived(rtt);
    
    // 배치 ACK에 추가
    this.batchAckManager.addAck(this.transferId, chunkIndex);
    
    // 프로그레스 업데이트
    const progress = this.bytesSent / this.file!.size;
    const speed = this.bytesSent / ((Date.now() - this.startTime) / 1000);
    const eta = (this.file!.size - this.bytesSent) / speed;
    
    this.progressSmoother.setTarget(progress, speed, eta);
    
    console.log(`[OptimizedSender] ✅ ACK received for chunk ${chunkIndex}, total ACKed: ${this.ackedChunks.size}/${this.totalChunks}`);
    
    if (this.ackedChunks.size === this.totalChunks) {
      console.log(`[OptimizedSender] 🎉 All chunks ACKed!`);
      this.progressSmoother.setTarget(1.0);
      this.batchAckManager.flush(this.transferId);
    } else if (!this.isSending) {
      this.sendNextBatch();
    }
  }
  
  /**
   * 배치 ACK 처리
   */
  private handleBatchAck(payload: any) {
    const acks = BatchAckManager.parseBatchAck(payload);
    
    for (const chunkIndex of acks) {
      if (!this.ackedChunks.has(chunkIndex)) {
        this.handleAck({ chunkIndex });
      }
    }
    
    console.log(`[OptimizedSender] 📦 Processed batch ACK: ${acks.length} chunks`);
  }
  
  /**
   * 타임아웃 처리
   */
  private async handleTimeout(chunkIndex: number) {
    const pending = this.pendingChunks.get(chunkIndex);
    if (!pending || this.isCancelled) return;
    
    // 에러 복구 관리자에 위임
    const canRecover = await this.errorRecovery.handleChunkError(
      chunkIndex, 
      new Error(`Timeout after ${this.ACK_TIMEOUT}ms`)
    );
    
    if (canRecover) {
      // 윈도우 관리자에 패킷 손실 알림
      this.windowManager.onPacketLoss();
      
      // 재시도는 에러 복구 관리자가 처리
    } else {
      console.error(`[OptimizedSender] ❌ Chunk ${chunkIndex} failed permanently`);
      
      self.postMessage({
        type: 'error',
        payload: {
          transferId: this.transferId,
          message: `Chunk ${chunkIndex} failed after multiple retries`,
        },
      });
      
      this.cancel();
    }
  }
  
  /**
   * 수신자 완료 처리
   */
  private handleReceiverComplete(payload: { transferId: string }) {
    if (payload.transferId === this.transferId && !this.isCancelled) {
      console.log(`[OptimizedSender] ✅ Receiver confirmed assembly complete`);
      
      this.progressSmoother.setTarget(1.0);
      this.complete();
    }
  }
  
  /**
   * 프로그레스 보고
   */
  private reportProgress(update: any) {
    const now = Date.now();
    if (now - this.lastProgressReport >= this.PROGRESS_REPORT_INTERVAL) {
      const remaining = this.file ? this.file.size - this.bytesSent : 0;
      
      self.postMessage({
        type: 'progress',
        payload: {
          transferId: this.transferId,
          progress: update.progress,
          actualProgress: this.bytesSent / (this.file?.size || 1),
          speed: update.speed || 0,
          eta: update.eta || Infinity,
          bytesSent: this.bytesSent,
          chunksSent: this.ackedChunks.size,
          totalChunks: this.totalChunks,
          pendingChunks: this.pendingChunks.size,
          windowSize: this.windowManager.getWindowSize(),
          cacheStats: this.chunkCache.getStats(),
          recoveryStats: this.errorRecovery.getRecoveryStats()
        },
      });
      
      this.lastProgressReport = now;
    }
  }
  
  /**
   * 전송 완료
   */
  private complete() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.bytesSent / totalTime : 0;

    console.log(`[OptimizedSender] 🎊 Transfer complete:`, {
      transferId: this.transferId,
      totalTime: `${totalTime.toFixed(2)}s`,
      averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)} MB/s`,
      totalChunks: this.totalChunks,
      ackedChunks: this.ackedChunks.size,
      cacheStats: this.chunkCache.getStats(),
      recoveryStats: this.errorRecovery.getRecoveryStats()
    });

    self.postMessage({
      type: 'complete',
      payload: {
        transferId: this.transferId,
        averageSpeed,
        totalTime,
        stats: {
          cacheStats: this.chunkCache.getStats(),
          recoveryStats: this.errorRecovery.getRecoveryStats(),
          windowStats: this.windowManager.getWindowState()
        }
      },
    });
    
    this.cleanup();
  }
  
  /**
   * 취소
   */
  private cancel() {
    this.isCancelled = true;
    this.pendingChunks.clear();
    this.batchAckManager.cleanup(this.transferId);
    
    self.postMessage({
      type: 'cancelled',
      payload: { transferId: this.transferId },
    });
    
    this.cleanup();
  }
  
  /**
   * 리소스 정리
   */
  private cleanup() {
    if (this.streamingReader) {
      this.streamingReader.cleanup();
      this.streamingReader = null;
    }
    
    this.chunkCache.clear();
    this.progressSmoother.stop();
    this.errorRecovery.reset();
    this.windowManager.reset();
    
    console.log('[OptimizedSender] Resources cleaned up');
  }
}

new OptimizedFileSender();