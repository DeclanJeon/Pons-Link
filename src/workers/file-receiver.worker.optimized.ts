declare const self: DedicatedWorkerGlobalScope;

import { BatchAckManager, BatchAck } from '@/lib/fileTransfer/batchAckManager';
import { AdaptiveChecksumValidator } from '@/lib/fileTransfer/adaptiveChecksumValidator';
import { MetadataPreflight } from '@/lib/fileTransfer/metadataPreflight';

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
  preflightPacket?: any;
}

class OptimizedFileReceiver {
  private transfers = new Map<string, TransferState>();
  private readonly PROGRESS_REPORT_INTERVAL = 200;
  private readonly ASSEMBLY_DELAY = 3000;
  
  // 최적화 컴포넌트
  private batchAckManager = new BatchAckManager();
  
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
    
    console.log('[OptimizedReceiver] Optimization components initialized');
  }
  
  private async handleMessage(e: MessageEvent) {
    const { type, payload } = e.data;

    switch (type) {
      case 'init-transfer':
        this.initTransfer(payload);
        break;
      case 'init-preflight':
        this.initPreflightTransfer(payload);
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
  
  /**
   * 전송 초기화
   */
  private initTransfer(payload: InitTransferPayload) {
    if (this.transfers.has(payload.transferId)) {
      console.warn(`[OptimizedReceiver] Transfer already initialized: ${payload.transferId}`);
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

    console.log(`[OptimizedReceiver] 🚀 Transfer initialized:`, {
      transferId: payload.transferId,
      totalChunks: payload.totalChunks,
      totalSize: payload.totalSize,
      senderId: payload.senderId,
    });
  }
  
  /**
   * 프리플라이트 전송 초기화
   */
  private initPreflightTransfer(payload: any) {
    const { transferId, packet, analysis } = payload;
    
    try {
      // 프리플라이트 패킷 파싱
      const preflightPacket = MetadataPreflight.deserializePacket(packet);
      
      // 전송 상태 초기화
      this.transfers.set(transferId, {
        chunks: new Map(),
        receivedCount: 0,
        totalChunks: preflightPacket.metadata.totalChunks,
        totalSize: preflightPacket.metadata.size,
        receivedSize: 0,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        lastReportTime: Date.now(),
        senderId: '', // senderId는 별도 메시지로 받음
        mimeType: preflightPacket.metadata.type,
        fileName: preflightPacket.metadata.name,
        isAssembling: false,
        isComplete: false,
        originalChecksum: preflightPacket.metadata.checksum,
        preflightPacket
      });
      
      // 첫 번째 청크가 포함되어 있으면 처리
      if (preflightPacket.firstChunk) {
        this.processPreflightChunk(transferId, preflightPacket.firstChunk);
      }
      
      console.log(`[OptimizedReceiver] 🚀 Preflight transfer initialized:`, {
        transferId,
        fileName: preflightPacket.metadata.name,
        fileSize: preflightPacket.metadata.size,
        hasFirstChunk: !!preflightPacket.firstChunk,
        hasThumbnail: !!preflightPacket.thumbnail
      });
      
      // 프리플라이트 완료 알림
      self.postMessage({
        type: 'preflight-complete',
        payload: {
          transferId,
          metadata: preflightPacket.metadata,
          thumbnail: preflightPacket.thumbnail,
          analysis
        }
      });
      
    } catch (error) {
      console.error(`[OptimizedReceiver] ❌ Failed to parse preflight packet:`, error);
      
      self.postMessage({
        type: 'error',
        payload: {
          transferId,
          message: `Invalid preflight packet: ${error}`
        }
      });
    }
  }
  
  /**
   * 프리플라이트 청크 처리
   */
  private processPreflightChunk(transferId: string, firstChunk: any) {
    const state = this.transfers.get(transferId);
    if (!state) return;
    
    // 청크 데이터 복원
    const chunkData = firstChunk.data;
    
    // 청크 저장
    state.chunks.set(0, chunkData);
    state.receivedCount++;
    state.receivedSize += chunkData.byteLength;
    state.lastUpdateTime = Date.now();
    
    // 체크섬 검증 (선택적)
    if (firstChunk.checksum) {
      this.verifyChunkChecksum(chunkData, firstChunk.checksum, 0).then(isValid => {
        if (!isValid) {
          console.warn(`[OptimizedReceiver] ⚠️ Preflight chunk 0 checksum mismatch`);
        }
      });
    }
    
    // ACK 전송
    this.sendAck(transferId, 0, state.senderId);
    
    // 진행률 보고
    this.reportProgress(transferId, state);
  }
  
  /**
   * 청크 처리
   */
  private async handleChunk(payload: ChunkPayload) {
    const { transferId, index, data: rawData, senderId } = payload;
    let state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[OptimizedReceiver] ❌ Unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.log(`[OptimizedReceiver] 🚫 Transfer complete, ignoring chunk ${index} and sending ACK`);
      this.sendAck(transferId, index, senderId);
      return;
    }

    // 인덱스 검증
    if (index < 0) {
      console.error(`[OptimizedReceiver] ❌ Negative index: ${index}`);
      return;
    }
    
    if (state.totalChunks > 0 && index >= state.totalChunks) {
      console.error(`[OptimizedReceiver] ❌ Index out of range: ${index} >= ${state.totalChunks}`);
      return;
    }

    if (state.chunks.has(index)) {
      console.warn(`[OptimizedReceiver] ⚠️ Duplicate chunk ${index}`);
      this.sendAck(transferId, index, senderId);
      return;
    }

    // 패킷 파싱
    const arrayBuffer = rawData instanceof ArrayBuffer ? rawData : (rawData as any).buffer;
    const view = new DataView(arrayBuffer);
    let offset = 0;

    try {
      // 패킷 타입 (1 byte)
      const packetType = view.getUint8(offset);
      offset += 1;

      if (packetType !== 1) {
        console.error(`[OptimizedReceiver] ❌ Invalid packet type: ${packetType}`);
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
        console.error(`[OptimizedReceiver] ❌ TransferId mismatch: expected ${transferId}, got ${parsedTransferId}`);
        return;
      }

      // 청크 인덱스 (4 bytes)
      const chunkIndex = view.getUint32(offset, false);
      offset += 4;

      if (chunkIndex !== index) {
        console.error(`[OptimizedReceiver] ❌ ChunkIndex mismatch: expected ${index}, got ${chunkIndex}`);
        return;
      }

      // 데이터 길이 (4 bytes)
      const dataLength = view.getUint32(offset, false);
      offset += 4;

      // 체크섬 길이 (2 bytes)
      const checksumLength = view.getUint16(offset, false);
      offset += 2;

      // 체크섬 (n bytes)
      const checksumBytes = new Uint8Array(arrayBuffer, offset, checksumLength);
      offset += checksumLength;
      const expectedChecksum = new TextDecoder().decode(checksumBytes);

      // 데이터 추출
      if (offset + dataLength > arrayBuffer.byteLength) {
        console.error(`[OptimizedReceiver] ❌ Data overflow:`, {
          offset,
          dataLength,
          totalSize: arrayBuffer.byteLength,
        });
        return;
      }

      const chunkData = arrayBuffer.slice(offset, offset + dataLength);

      // 선택적 체크섬 검증
      if (expectedChecksum) {
        const isValid = await this.verifyChunkChecksum(chunkData, expectedChecksum, index);
        if (!isValid) {
          console.warn(`[OptimizedReceiver] ⚠️ CHECKSUM MISMATCH for chunk ${index}:`, {
            expected: expectedChecksum,
            actual: await this.calculateChecksum(chunkData),
          });
          // ACK를 보내지 않음 (재전송 유도)
          return;
        }
      }

      console.log(`[OptimizedReceiver] 📥 Chunk ${index} received (${chunkData.byteLength} bytes)`);

      // 청크 저장
      state.chunks.set(index, chunkData);
      state.receivedCount++;
      state.receivedSize += chunkData.byteLength;
      state.lastUpdateTime = Date.now();

      // ACK 전송
      this.sendAck(transferId, index, senderId);

      // 진행률 보고
      const now = Date.now();
      if (now - state.lastReportTime >= this.PROGRESS_REPORT_INTERVAL || state.receivedCount % 50 === 0) {
        this.reportProgress(transferId, state);
        state.lastReportTime = now;
      }

    } catch (error) {
      console.error(`[OptimizedReceiver] ❌ Parsing error:`, error);
    }
  }
  
  /**
   * 체크섬 검증
   */
  private async verifyChunkChecksum(data: ArrayBuffer, expectedChecksum: string, chunkIndex: number): Promise<boolean> {
    // 적응형 체크섬 검증: 샘플링된 청크만 검증
    const state = this.transfers.values().next().value;
    if (!state) return true;
    
    // 파일 크기에 따른 검증 빈도 조정
    const fileSize = state.totalSize;
    const totalChunks = state.totalChunks;
    
    // 100MB 미만: 전체 검증
    // 1GB 미만: 10% 샘플링
    // 1GB 이상: 1% 샘플링
    let shouldValidate = true;
    if (fileSize >= 100 * 1024 * 1024) {
      if (fileSize >= 1024 * 1024 * 1024) {
        // 1GB 이상: 1% 샘플링
        shouldValidate = Math.random() < 0.01;
      } else {
        // 100MB-1GB: 10% 샘플링
        shouldValidate = Math.random() < 0.1;
      }
    }
    
    // 필수 청크는 항상 검증 (첫, 마지막, 중간)
    if (chunkIndex === 0 || chunkIndex === totalChunks - 1 || chunkIndex === Math.floor(totalChunks / 2)) {
      shouldValidate = true;
    }
    
    if (!shouldValidate) {
      return true; // 검증 스킵
    }
    
    const actualChecksum = await this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
  
  /**
   * 체크섬 계산
   */
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * ACK 전송
   */
  private sendAck(transferId: string, chunkIndex: number, senderId: string) {
    // 배치 ACK 관리자에 추가
    this.batchAckManager.addAck(transferId, chunkIndex);
  }
  
  /**
   * 진행률 보고
   */
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
  
  /**
   * 파일 조립
   */
  private async assemble(payload: AssemblePayload) {
    const { transferId, mimeType, fileName } = payload;
    const state = this.transfers.get(transferId);

    if (!state) {
      console.error(`[OptimizedReceiver] ❌ Cannot assemble unknown transfer: ${transferId}`);
      return;
    }

    if (state.isComplete) {
      console.warn(`[OptimizedReceiver] ⚠️ Transfer ${transferId} already complete`);
      return;
    }

    if (state.chunks.size !== state.totalChunks) {
      console.error(`[OptimizedReceiver] ❌ Chunk count mismatch: expected ${state.totalChunks}, got ${state.chunks.size}`);
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
          console.error(`[OptimizedReceiver] ❌ Missing chunk ${i}`);
          self.postMessage({ type: 'error', payload: { transferId, message: `Missing chunk ${i}` } });
          return;
        }
        sortedChunks.push(chunk);
        calculatedSize += chunk.byteLength;
      }

      if (calculatedSize !== state.totalSize) {
        console.error(`[OptimizedReceiver] ❌ Size mismatch: expected ${state.totalSize}, got ${calculatedSize}`);
        self.postMessage({ type: 'error', payload: { transferId, message: 'Size mismatch' } });
        return;
      }

      const blob = new Blob(sortedChunks, { type: mimeType });

      // 최종 파일 체크섬 검증
      const buffer = await blob.arrayBuffer();
      const finalChecksum = await this.calculateChecksum(buffer);
      console.log(`[OptimizedReceiver] 🔐 Final checksum: ${finalChecksum}`);

      if (state.originalChecksum && finalChecksum !== state.originalChecksum) {
        console.error(`[OptimizedReceiver] ❌ FILE CORRUPTED:`, {
          expected: state.originalChecksum,
          actual: finalChecksum,
        });
        self.postMessage({ type: 'error', payload: { transferId, message: 'File corrupted: checksum mismatch' } });
        return;
      }

      console.log(`[OptimizedReceiver] ✅ File integrity verified!`);

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
          totalTime,
          checksum: finalChecksum
        },
      });

      // 청크 데이터만 삭제, 상태는 유지 (60초 후 삭제)
      state.chunks.clear();
      
      setTimeout(() => {
        const s = this.transfers.get(transferId);
        if (s) {
          this.transfers.delete(transferId);
          console.log(`[OptimizedReceiver] 🗑️ Transfer state deleted: ${transferId}`);
        }
      }, 60000);

    } catch (e) {
      self.postMessage({ type: 'error', payload: { transferId, message: (e as Error).message } });
    }
  }
  
  /**
   * 전송 취소
   */
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
    
    // 배치 ACK 정리
    this.batchAckManager.cleanup(transferId);
  }
}

new OptimizedFileReceiver();