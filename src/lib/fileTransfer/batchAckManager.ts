/**
 * 배치 ACK 프로토콜
 * 개별 ACK 대신, 여러 청크의 ACK를 하나로 묶어서 전송합니다.
 */

export interface BatchAck {
  transferId: string;
  ranges: Array<{start: number, end: number}>; // 연속된 청크 범위
  bitmap?: Uint8Array; // 비연속 청크용 비트맵
  timestamp: number;
  totalAcks: number;
}

export interface AckPacket {
  transferId: string;
  chunkIndex: number;
  timestamp: number;
}

export class BatchAckManager {
  private pendingAcks = new Map<string, Set<number>>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private readonly BATCH_SIZE = 50; // 배치 크기
  private readonly BATCH_INTERVAL = 100; // ms
  private readonly MAX_BITMAP_SIZE = 1000; // 비트맵 최대 크기
  
  private onBatchAckCallback?: (batchAck: BatchAck) => void;
  
  constructor() {
    console.log('[BatchAckManager] Initialized');
  }
  
  /**
   * 배치 ACK 콜백 설정
   */
  onBatchAck(callback: (batchAck: BatchAck) => void) {
    this.onBatchAckCallback = callback;
  }
  
  /**
   * ACK 추가
   */
  addAck(transferId: string, chunkIndex: number) {
    if (!this.pendingAcks.has(transferId)) {
      this.pendingAcks.set(transferId, new Set());
    }
    
    const acks = this.pendingAcks.get(transferId)!;
    acks.add(chunkIndex);
    
    // 배치 크기 도달 시 즉시 전송
    if (acks.size >= this.BATCH_SIZE) {
      this.flush(transferId);
    } else {
      // 타이머 설정 (이미 설정되어 있지 않은 경우)
      if (!this.batchTimers.has(transferId)) {
        const timer = setTimeout(() => {
          this.flush(transferId);
        }, this.BATCH_INTERVAL);
        
        this.batchTimers.set(transferId, timer);
      }
    }
  }
  
  /**
   * 강제 플러시 (전송 완료 등)
   */
  flush(transferId: string) {
    const acks = this.pendingAcks.get(transferId);
    if (!acks || acks.size === 0) return;
    
    // 타이머 정리
    const timer = this.batchTimers.get(transferId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(transferId);
    }
    
    // ACK 배열 정렬
    const sortedAcks = Array.from(acks).sort((a, b) => a - b);
    
    // 배치 ACK 생성
    const batchAck = this.createBatchAck(transferId, sortedAcks);
    
    // 콜백 호출
    if (this.onBatchAckCallback) {
      this.onBatchAckCallback(batchAck);
    }
    
    // ACK 목록 정리
    acks.clear();
    
    console.log(`[BatchAckManager] Sent batch ACK for ${transferId}:`, {
      totalAcks: batchAck.totalAcks,
      ranges: batchAck.ranges.length,
      hasBitmap: !!batchAck.bitmap
    });
  }
  
  /**
   * 배치 ACK 생성
   */
  private createBatchAck(transferId: string, acks: number[]): BatchAck {
    const batchAck: BatchAck = {
      transferId,
      ranges: [],
      timestamp: Date.now(),
      totalAcks: acks.length
    };
    
    // 연속된 범위로 압축
    const ranges = this.compressToRanges(acks);
    
    // 범위가 너무 많으면 비트맵 사용
    if (ranges.length > 10 || acks.length > this.MAX_BITMAP_SIZE) {
      batchAck.bitmap = this.createBitmap(acks);
      batchAck.ranges = []; // 비트맵 사용 시 범위는 비움
    } else {
      batchAck.ranges = ranges;
    }
    
    return batchAck;
  }
  
  /**
   * 연속된 범위로 압축
   */
  private compressToRanges(indices: number[]): Array<{start: number, end: number}> {
    const ranges: Array<{start: number, end: number}> = [];
    
    if (indices.length === 0) return ranges;
    
    let start = indices[0];
    let prev = indices[0];
    
    for (let i = 1; i < indices.length; i++) {
      const current = indices[i];
      
      if (current === prev + 1) {
        // 연속된 경우
        prev = current;
      } else {
        // 연속되지 않은 경우, 범위 추가
        ranges.push({ start, end: prev });
        start = current;
        prev = current;
      }
    }
    
    // 마지막 범위 추가
    ranges.push({ start, end: prev });
    
    return ranges;
  }
  
  /**
   * 비트맵 생성
   */
  private createBitmap(acks: number[]): Uint8Array {
    const maxIndex = Math.max(...acks);
    const bitmapSize = Math.ceil((maxIndex + 1) / 8);
    const bitmap = new Uint8Array(bitmapSize);
    
    for (const ack of acks) {
      const byteIndex = Math.floor(ack / 8);
      const bitIndex = ack % 8;
      bitmap[byteIndex] |= (1 << bitIndex);
    }
    
    return bitmap;
  }
  
  /**
   * 배치 ACK 파싱 (수신자용)
   */
  static parseBatchAck(batchAck: BatchAck): number[] {
    const acks: number[] = [];
    
    if (batchAck.bitmap) {
      // 비트맵에서 ACK 추출
      for (let i = 0; i < batchAck.bitmap.length * 8; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        
        if (batchAck.bitmap[byteIndex] & (1 << bitIndex)) {
          acks.push(i);
        }
      }
    } else {
      // 범위에서 ACK 추출
      for (const range of batchAck.ranges) {
        for (let i = range.start; i <= range.end; i++) {
          acks.push(i);
        }
      }
    }
    
    return acks;
  }
  
  /**
   * 개별 ACK 패킷 생성 (송신자용)
   */
  static createAckPacket(transferId: string, chunkIndex: number): AckPacket {
    return {
      transferId,
      chunkIndex,
      timestamp: Date.now()
    };
  }
  
  /**
   * 전송 상태 정보
   */
  getStatus() {
    const totalPending = Array.from(this.pendingAcks.values())
      .reduce((sum, acks) => sum + acks.size, 0);
    
    return {
      activeTransfers: this.pendingAcks.size,
      totalPendingAcks: totalPending,
      activeTimers: this.batchTimers.size
    };
  }
  
  /**
   * 전송 정리
   */
  cleanup(transferId?: string) {
    if (transferId) {
      // 특정 전송 정리
      const timer = this.batchTimers.get(transferId);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(transferId);
      }
      
      this.pendingAcks.delete(transferId);
      
      console.log(`[BatchAckManager] Cleaned up transfer: ${transferId}`);
    } else {
      // 모든 전송 정리
      this.batchTimers.forEach(timer => clearTimeout(timer));
      this.batchTimers.clear();
      this.pendingAcks.clear();
      
      console.log('[BatchAckManager] Cleaned up all transfers');
    }
  }
}