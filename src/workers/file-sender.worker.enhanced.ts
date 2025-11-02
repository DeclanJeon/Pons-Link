declare const self: DedicatedWorkerGlobalScope;

interface StartTransferPayload {
  fileName: string;
  fileSize: number;
  fileType: string;
  transferId: string;
  chunkSize: number;
}

class EnhancedFileSender {
  private fileName = '';
  private fileSize = 0;
  private fileType = '';
  private transferId = '';
  private chunkSize = 64 * 1024;
  private totalChunks = 0;
  private isPaused = false;
  private isCancelled = false;
  private startTime = 0;
  private bytesSent = 0;
  private ackedChunks = new Set<number>();
  private ackTimeouts = new Map<number, NodeJS.Timeout>();
  private pendingChunks = new Map<number, {
    sentAt: number;
    retries: number;
    rawData: ArrayBuffer;
  }>();
  private failedChunks = new Set<number>(); // 실패한 청크 추적
  private lastProgressReport = 0;
  private targetProgress = 0;
  private isTransmitting = false;
  
  // RTT 기반 적응형 타임아웃을 위한 변수
  private rttSamples: number[] = [];
  private averageRTT = 1000; // 초기값 1초
  
  // 개선된 설정 값
  private readonly MAX_PENDING = 10;
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly MAX_RETRIES = 10; // 5 → 10으로 증가
  private readonly BASE_TIMEOUT = 5000; // 기본 5초
  private readonly FAILED_CHUNK_RETRY_INTERVAL = 5000; // 5초마다 실패 청크 재시도
  
  constructor() {
    self.onmessage = this.handleMessage.bind(this);
    this.startFailedChunkRetryLoop(); // 실패 청크 재시도 루프 시작
  }
  
  // 실패한 청크 재시도 루프
  private startFailedChunkRetryLoop() {
    setInterval(() => {
      if (this.isCancelled || this.isPaused) return;
      
      if (this.failedChunks.size > 0) {
        console.warn(`[Enhanced Sender] 🔄 Retrying ${this.failedChunks.size} failed chunks`);
        
        // 실패한 청크를 pending으로 다시 이동
        for (const chunkIndex of this.failedChunks) {
          if (!this.ackedChunks.has(chunkIndex)) {
            // 다시 읽기 요청
            self.postMessage({
              type: 'request-chunk',
              payload: { chunkIndex }
            });
            
            this.pendingChunks.set(chunkIndex, {
              sentAt: Date.now(),
              retries: 0, // 재시도 카운트 리셋
              rawData: new ArrayBuffer(0)
            });
          }
          
          this.failedChunks.delete(chunkIndex);
        }
      }
    }, this.FAILED_CHUNK_RETRY_INTERVAL);
  }
  
  private async handleMessage(e: MessageEvent) {
    const { type, payload } = e.data;
    
    switch (type) {
      case 'start-transfer':
        this.startTransfer(payload);
        break;
      case 'chunk-data':
        await this.handleChunkData(payload);
        break;
      case 'chunk-error':
        this.handleChunkError(payload);
        break;
      case 'pause-transfer':
        this.isPaused = true;
        break;
      case 'resume-transfer':
        this.isPaused = false;
        this.requestNextChunks();
        break;
      case 'cancel-transfer':
        this.cancel();
        break;
      case 'ack-received':
        this.handleAck(payload);
        break;
      // ✅ 청크 재전송 요청
      case 'resend-chunk': {
        const { chunkIndex } = payload;
        
        console.warn(`[EnhancedSender] 🔄 Resending chunk ${chunkIndex}`);
        
        // ACK 목록에서 제거
        this.ackedChunks.delete(chunkIndex);
        
        // 다시 읽기 요청
        self.postMessage({
          type: 'request-chunk',
          payload: { chunkIndex }
        });
        
        this.pendingChunks.set(chunkIndex, {
          sentAt: Date.now(),
          retries: 0,
          rawData: new ArrayBuffer(0)
        });
        
        break;
      }
    }
  }
  
  private startTransfer(payload: StartTransferPayload) {
    // payload에서 직접 값 가져오기
    this.fileName = payload.fileName;
    this.fileSize = payload.fileSize;
    this.fileType = payload.fileType;
    this.transferId = payload.transferId;
    this.chunkSize = payload.chunkSize;
    this.totalChunks = Math.ceil(this.fileSize / this.chunkSize);
    this.startTime = Date.now();
    this.bytesSent = 0;
    this.ackedChunks.clear();
    this.pendingChunks.clear();
    this.failedChunks.clear();
    this.lastProgressReport = Date.now();
    this.rttSamples = [];
    this.averageRTT = 1000;
    
    const lastChunkSize = this.fileSize - (this.totalChunks - 1) * this.chunkSize;
    
    console.log(`[Enhanced Sender] 🚀 Starting transfer:`, {
      fileName: this.fileName,
      fileSize: this.fileSize,
      chunkSize: this.chunkSize,
      totalChunks: this.totalChunks,
      lastChunkSize,
    });
    
    this.requestNextChunks();
  }
  
  private getAdaptiveTimeout(): number {
    // RTT의 3배 + 안전 마진
    return Math.max(
      this.BASE_TIMEOUT,
      this.averageRTT * 3 + 2000
    );
  }
  
  private updateRTT(rtt: number) {
    this.rttSamples.push(rtt);
    
    // 최근 10개 샘플만 유지
    if (this.rttSamples.length > 10) {
      this.rttSamples.shift();
    }
    
    // 평균 RTT 계산
    this.averageRTT = this.rttSamples.reduce((sum, val) => sum + val, 0) / this.rttSamples.length;
  }
  
  private requestNextChunks() {
    if (this.isPaused || this.isCancelled) return;
    
    for (let i = 0; i < this.totalChunks; i++) {
      // 이미 ACK 받았으면 스킵
      if (this.ackedChunks.has(i)) continue;
      
      // 실패한 청크는 스킵 (재시도 루프에서 처리)
      if (this.failedChunks.has(i)) continue;
      
      // 이미 전송 중이면 스킵
      if (this.pendingChunks.has(i)) continue;
      
      // pending 한도 체크
      if (this.pendingChunks.size >= this.MAX_PENDING) break;
      
      self.postMessage({
        type: 'request-chunk',
        payload: { chunkIndex: i }
      });
      
      this.pendingChunks.set(i, {
        sentAt: Date.now(),
        retries: 0,
        rawData: new ArrayBuffer(0)
      });
    }
    
    // 상태 로그
    if (this.pendingChunks.size > 0) {
      console.log(`[Enhanced Sender] ⏸️ Waiting for ACKs: ${this.ackedChunks.size}/${this.totalChunks} (pending: ${this.pendingChunks.size}, failed: ${this.failedChunks.size})`);
    }
  }
  
  private async handleChunkData(payload: { chunkIndex: number; data: ArrayBuffer }) {
    const { chunkIndex, data } = payload;
    
    const pending = this.pendingChunks.get(chunkIndex);
    if (!pending) return;
    
    pending.rawData = data;
    
    const packet = this.createPacket(chunkIndex, data);
    
    self.postMessage({
      type: 'chunk-ready',
      payload: {
        transferId: this.transferId,
        chunkIndex,
        chunk: packet,
        isLast: chunkIndex === this.totalChunks - 1
      }
    }, [packet]);
    
    // 적응형 타임아웃 사용
    const timeout = this.getAdaptiveTimeout();
    
    setTimeout(() => {
      this.handleTimeout(chunkIndex);
    }, timeout);
    
    console.log(`[Enhanced Sender] Chunk ${chunkIndex} sent (timeout: ${timeout}ms)`);
  }
  
  private handleChunkError(payload: { chunkIndex: number; error: string }) {
    console.error(`[Enhanced Sender] Failed to read chunk ${payload.chunkIndex}:`, payload.error);
    
    const pending = this.pendingChunks.get(payload.chunkIndex);
    if (pending && pending.retries < this.MAX_RETRIES) {
      pending.retries++;
      
      setTimeout(() => {
        self.postMessage({
          type: 'request-chunk',
          payload: { chunkIndex: payload.chunkIndex }
        });
      }, 1000);
    } else {
      // 실패한 청크로 표시 (재시도 루프에서 처리)
      this.failedChunks.add(payload.chunkIndex);
      this.pendingChunks.delete(payload.chunkIndex);
      
      console.warn(`[Enhanced Sender] 📋 Chunk ${payload.chunkIndex} marked as failed (will retry later)`);
    }
  }
  
  private createPacket(chunkIndex: number, data: ArrayBuffer): ArrayBuffer {
    const idBytes = new TextEncoder().encode(this.transferId);
    const headerSize = 1 + 2 + idBytes.length + 4 + 4;
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
    
    new Uint8Array(packet, offset, data.byteLength).set(new Uint8Array(data));
    
    return packet;
  }
  
  private handleAck(payload: { chunkIndex: number }) {
    const { chunkIndex } = payload;
    
    // ✅ 수정: 상단에 가드 추가
    if (this.ackedChunks.has(chunkIndex)) return;
    
    // ✅ 추가로 pendingChunks.get(chunkIndex) 없으면 리턴
    const pending = this.pendingChunks.get(chunkIndex);
    if (!pending) return;
    
    // 타임아웃 제거
    const timeout = this.ackTimeouts.get(chunkIndex);
    if (timeout) {
      clearTimeout(timeout);
      this.ackTimeouts.delete(chunkIndex);
    }
    
    // RTT 계산
    const rtt = Date.now() - pending.sentAt;
    this.updateRTT(rtt);
    
    // ACK 처리
    this.ackedChunks.add(chunkIndex);
    this.pendingChunks.delete(chunkIndex);
    this.failedChunks.delete(chunkIndex);
    
    const chunkBytes = Math.min(
      this.chunkSize,
      this.fileSize - chunkIndex * this.chunkSize
    );
    this.bytesSent += chunkBytes;
    
    this.targetProgress = this.bytesSent / this.fileSize;
    
    console.log(`[Enhanced Sender] ✅ ACK ${chunkIndex}, total: ${this.ackedChunks.size}/${this.totalChunks}, RTT: ${rtt}ms`);
    
    const now = Date.now();
    if (now - this.lastProgressReport >= this.PROGRESS_REPORT_INTERVAL) {
      this.reportProgress();
      this.lastProgressReport = now;
    }
    
    if (this.ackedChunks.size === this.totalChunks) {
      console.log(`[Enhanced Sender] 🎉 All chunks ACKed!`);
      this.completeTransfer();
    } else if (!this.isTransmitting) {
      setTimeout(() => this.requestNextChunks(), 10);
    }
  }
  
  // 주기적 메모리 정리
  private cleanupMemory() {
    const now = Date.now();
    
    for (const [chunkIndex, pending] of this.pendingChunks.entries()) {
      // ACK 받은 청크는 제거
      if (this.ackedChunks.has(chunkIndex)) {
        this.pendingChunks.delete(chunkIndex);
      }
      
      // 너무 오래된 pending 청크 정리 (60초 이상)
      if (now - pending.sentAt > 60000) {
        console.warn(`[Enhanced Sender] Cleaning up stale chunk ${chunkIndex}`);
        this.failedChunks.add(chunkIndex); // 실패 목록으로 이동
        this.pendingChunks.delete(chunkIndex);
      }
    }
  }
  
  private reportProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.bytesSent / elapsed : 0;
    const progress = this.bytesSent / this.fileSize;
    const remaining = this.fileSize - this.bytesSent;
    const eta = speed > 0 ? remaining / speed : Infinity;
    
    // 주기적 메모리 정리 (10초마다)
    if (Math.floor(elapsed) % 10 === 0) {
      this.cleanupMemory();
    }
    
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
        pendingChunks: this.pendingChunks.size,
        failedChunks: this.failedChunks.size, // 실패 청크 수 추가
        averageRTT: this.averageRTT
      }
    });
  }
  
  private handleTimeout(chunkIndex: number) {
    const pending = this.pendingChunks.get(chunkIndex);
    if (!pending || this.ackedChunks.has(chunkIndex)) return;
    
    if (pending.retries < this.MAX_RETRIES) {
      console.warn(`[Enhanced Sender] ⏰ Timeout for chunk ${chunkIndex}, retry ${pending.retries + 1}/${this.MAX_RETRIES} (RTT avg: ${this.averageRTT.toFixed(0)}ms)`);
      
      pending.retries++;
      pending.sentAt = Date.now();
      
      if (pending.rawData && pending.rawData.byteLength > 0) {
        const packet = this.createPacket(chunkIndex, pending.rawData);
        
        self.postMessage({
          type: 'chunk-ready',
          payload: {
            transferId: this.transferId,
            chunkIndex,
            chunk: packet,
            isLast: chunkIndex === this.totalChunks - 1
          }
        }, [packet]);
        
        // 적응형 타임아웃 사용
        const timeout = this.getAdaptiveTimeout();
        
        setTimeout(() => {
          this.handleTimeout(chunkIndex);
        }, timeout);
      } else {
        self.postMessage({
          type: 'request-chunk',
          payload: { chunkIndex }
        });
      }
    } else {
      console.error(`[Enhanced Sender] ⚠️ Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`);
      
      // 실패한 청크로 표시 (재시도 루프에서 처리)
      this.failedChunks.add(chunkIndex);
      this.pendingChunks.delete(chunkIndex);
      
      console.warn(`[Enhanced Sender] 📋 Chunk ${chunkIndex} marked as failed (will retry in ${this.FAILED_CHUNK_RETRY_INTERVAL}ms)`);
      
      // 다음 청크 계속 전송
      this.requestNextChunks();
    }
  }
  
  private completeTransfer() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const averageSpeed = totalTime > 0 ? this.bytesSent / totalTime : 0;
    
    console.log(`[Enhanced Sender] 🎊 Transfer complete:`, {
      transferId: this.transferId,
      totalTime: `${totalTime.toFixed(2)}s`,
      averageSpeed: `${(averageSpeed / 1024 / 1024).toFixed(2)} MB/s`,
      totalChunks: this.totalChunks,
      ackedChunks: this.ackedChunks.size,
      failedChunks: this.failedChunks.size,
      averageRTT: `${this.averageRTT.toFixed(0)}ms`
    });
    
    // 조립 신호 여러 번 전송 (신뢰성 향상)
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        self.postMessage({
          type: 'request-assemble',
          payload: {
            transferId: this.transferId
          }
        });
        console.log(`[Enhanced Sender] 📦 Assemble request sent (attempt ${i + 1}/3)`);
      }, 500 * (i + 1));
    }
    
    // 완료 신호 전송
    self.postMessage({
      type: 'complete',
      payload: {
        transferId: this.transferId,
        averageSpeed,
        totalTime,
        failedChunks: this.failedChunks.size,
      }
    });
  }
  
  private cancel() {
    this.isCancelled = true;
    this.pendingChunks.clear();
    this.failedChunks.clear();
    
    self.postMessage({
      type: 'cancelled',
      payload: { transferId: this.transferId }
    });
  }
}

new EnhancedFileSender();