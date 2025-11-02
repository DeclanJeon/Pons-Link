import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { StreamingFileReader } from '@/lib/fileTransfer/streamingFileReader';
import { AdaptiveChecksumValidator } from '@/lib/fileTransfer/adaptiveChecksumValidator';
import { getChecksumWorkerPool, cleanupChecksumWorkerPool } from '@/lib/fileTransfer/checksumWorkerPool';
import { PreflightAnalyzer, formatFileSize, formatETA, formatSpeed } from '@/lib/fileTransfer/preflightAnalyzer';
import { BatchAckManager } from '@/lib/fileTransfer/batchAckManager';
import { AdaptiveWindowManager } from '@/lib/fileTransfer/adaptiveWindowManager';
import { LRUChunkCache } from '@/lib/fileTransfer/lruChunkCache';
import { ProgressSmoother, formatProgress, formatSpeed as formatSpeedUtil } from '@/lib/fileTransfer/progressSmoother';
import { ErrorRecoveryManager } from '@/lib/fileTransfer/errorRecoveryManager';
import { MetadataPreflight } from '@/lib/fileTransfer/metadataPreflight';

export interface TransferProgress {
  transferId: string;
  progress: number;
  speed: number;
  eta: number;
  bytesSent: number;
  chunksSent: number;
  totalChunks: number;
  pendingChunks: number;
  windowSize: number;
  cacheStats: any;
  recoveryStats: any;
}

export interface PreflightProgress {
  transferId: string;
  stage: 'initial' | 'quick' | 'detailed' | 'ready';
  progress: number;
  quick: any;
  detailed?: any;
}

export interface TransferStats {
  transferId: string;
  averageSpeed: number;
  totalTime: number;
  stats: {
    cacheStats: any;
    recoveryStats: any;
    windowStats: any;
  };
}

export interface OptimizedFileTransferOptions {
  chunkSize?: number;
  maxRetries?: number;
  enableBatchAck?: boolean;
  enableAdaptiveWindow?: boolean;
  enableLRUCache?: boolean;
  enableProgressiveUI?: boolean;
}

export const useOptimizedFileTransfer = (options: OptimizedFileTransferOptions = {}) => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<string | null>(null);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [preflightProgress, setPreflightProgress] = useState<PreflightProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Worker refs
  const senderWorkerRef = useRef<Worker | null>(null);
  const receiverWorkerRef = useRef<Worker | null>(null);
  
  // 최적화 컴포넌트 refs
  const streamingReaderRef = useRef<StreamingFileReader | null>(null);
  const checksumValidatorRef = useRef<AdaptiveChecksumValidator | null>(null);
  const batchAckManagerRef = useRef<BatchAckManager | null>(null);
  const windowManagerRef = useRef<AdaptiveWindowManager | null>(null);
  const chunkCacheRef = useRef<LRUChunkCache | null>(null);
  const progressSmootherRef = useRef<ProgressSmoother | null>(null);
  const errorRecoveryRef = useRef<ErrorRecoveryManager | null>(null);
  const preflightAnalyzerRef = useRef<PreflightAnalyzer | null>(null);
  
  const {
    chunkSize = 64 * 1024,
    maxRetries = 5,
    enableBatchAck = true,
    enableAdaptiveWindow = true,
    enableLRUCache = true,
    enableProgressiveUI = true
  } = options;
  
  // Workers 초기화
  useEffect(() => {
    try {
      // Sender Worker
      const senderWorker = new Worker(
        new URL('./file-sender.worker.optimized.ts', import.meta.url),
        { type: 'module' }
      );
      
      senderWorker.onmessage = (e) => {
        const { type, payload } = e.data;
        
        switch (type) {
          case 'preflight-progress':
            setPreflightProgress(payload);
            break;
          case 'preflight-complete':
            handlePreflightComplete(payload);
            break;
          case 'progress':
            setProgress(payload);
            break;
          case 'complete':
            handleTransferComplete(payload);
            break;
          case 'error':
            handleTransferError(payload);
            break;
          case 'cancelled':
            handleTransferCancelled(payload);
            break;
        }
      };
      
      senderWorker.onerror = (error) => {
        console.error('[OptimizedFileTransfer] Sender worker error:', error);
        setError('Sender worker initialization failed');
      };
      
      senderWorkerRef.current = senderWorker;
      
      // Receiver Worker
      const receiverWorker = new Worker(
        new URL('./file-receiver.worker.optimized.ts', import.meta.url),
        { type: 'module' }
      );
      
      receiverWorker.onmessage = (e) => {
        const { type, payload } = e.data;
        
        switch (type) {
          case 'progress':
            // 수신자 진행률 처리 (필요시)
            break;
          case 'complete':
            handleReceiveComplete(payload);
            break;
          case 'error':
            handleReceiveError(payload);
            break;
          case 'preflight-complete':
            handleReceivePreflightComplete(payload);
            break;
        }
      };
      
      receiverWorker.onerror = (error) => {
        console.error('[OptimizedFileTransfer] Receiver worker error:', error);
        setError('Receiver worker initialization failed');
      };
      
      receiverWorkerRef.current = receiverWorker;
      
      console.log('[OptimizedFileTransfer] Workers initialized');
      
    } catch (error) {
      console.error('[OptimizedFileTransfer] Failed to initialize workers:', error);
      setError('Failed to initialize file transfer workers');
    }
    
    return () => {
      // Workers 정리
      if (senderWorkerRef.current) {
        senderWorkerRef.current.terminate();
        senderWorkerRef.current = null;
      }
      
      if (receiverWorkerRef.current) {
        receiverWorkerRef.current.terminate();
        receiverWorkerRef.current = null;
      }
      
      // 체크섬 Worker 풀 정리
      cleanupChecksumWorkerPool();
      
      console.log('[OptimizedFileTransfer] Workers cleaned up');
    };
  }, []);
  
  /**
   * 프리플라이트 완료 처리
   */
  const handlePreflightComplete = useCallback((payload: any) => {
    const { transferId, metadata, thumbnail, analysis } = payload;
    
    console.log('[OptimizedFileTransfer] Preflight complete:', {
      transferId,
      fileName: metadata.name,
      fileSize: metadata.size,
      hasThumbnail: !!thumbnail
    });
    
    // 썸네일 처리
    if (thumbnail) {
      const thumbnailUrl = MetadataPreflight.createThumbnailURL(thumbnail);
      
      toast.success(`File ready: ${metadata.name}`, {
        description: `${formatFileSize(metadata.size)} • ${formatETA(analysis.detailed?.refinedEstimate || 0)}`,
        duration: 3000,
        action: {
          label: 'View Thumbnail',
          onClick: () => {
            // 썸네일 미리보기
            window.open(thumbnailUrl, '_blank');
          }
        }
      });
      
      // 나중에 정리
      setTimeout(() => {
        MetadataPreflight.revokeThumbnailURL(thumbnailUrl);
      }, 10000);
    } else {
      toast.success(`File ready: ${metadata.name}`, {
        description: `${formatFileSize(metadata.size)} • ${formatETA(analysis.detailed?.refinedEstimate || 0)}`,
        duration: 3000
      });
    }
    
    setCurrentTransfer(transferId);
  }, []);
  
  /**
   * 전송 완료 처리
   */
  const handleTransferComplete = useCallback((payload: TransferStats) => {
    const { transferId, averageSpeed, totalTime, stats } = payload;
    
    console.log('[OptimizedFileTransfer] Transfer complete:', {
      transferId,
      averageSpeed: formatSpeedUtil(averageSpeed),
      totalTime: `${totalTime.toFixed(2)}s`,
      stats
    });
    
    setIsTransferring(false);
    setCurrentTransfer(null);
    setProgress(null);
    setError(null);
    
    toast.success('File transfer completed!', {
      description: `Average speed: ${formatSpeedUtil(averageSpeed)} • Time: ${totalTime.toFixed(2)}s`,
      duration: 5000
    });
  }, []);
  
  /**
   * 전송 에러 처리
   */
  const handleTransferError = useCallback((payload: any) => {
    const { transferId, message } = payload;
    
    console.error('[OptimizedFileTransfer] Transfer error:', {
      transferId,
      message
    });
    
    setIsTransferring(false);
    setCurrentTransfer(null);
    setProgress(null);
    setError(message);
    
    toast.error(`Transfer failed: ${message}`, {
      duration: 5000
    });
  }, []);
  
  /**
   * 전송 취소 처리
   */
  const handleTransferCancelled = useCallback((payload: any) => {
    const { transferId } = payload;
    
    console.log('[OptimizedFileTransfer] Transfer cancelled:', { transferId });
    
    setIsTransferring(false);
    setCurrentTransfer(null);
    setProgress(null);
    setError(null);
    
    toast.info('Transfer cancelled', {
      duration: 3000
    });
  }, []);
  
  /**
   * 수신 완료 처리
   */
  const handleReceiveComplete = useCallback((payload: any) => {
    const { transferId, url, name, size } = payload;
    
    console.log('[OptimizedFileTransfer] Receive complete:', {
      transferId,
      fileName: name,
      fileSize: size
    });
    
    // 파일 다운로드
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // URL 정리
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    toast.success(`File received: ${name}`, {
      description: formatFileSize(size),
      duration: 5000
    });
  }, []);
  
  /**
   * 수신 에러 처리
   */
  const handleReceiveError = useCallback((payload: any) => {
    const { transferId, message } = payload;
    
    console.error('[OptimizedFileTransfer] Receive error:', {
      transferId,
      message
    });
    
    toast.error(`Receive failed: ${message}`, {
      duration: 5000
    });
  }, []);
  
  /**
   * 수신 프리플라이트 완료 처리
   */
  const handleReceivePreflightComplete = useCallback((payload: any) => {
    const { transferId, metadata, thumbnail } = payload;
    
    console.log('[OptimizedFileTransfer] Receive preflight complete:', {
      transferId,
      fileName: metadata.name,
      fileSize: metadata.size,
      hasThumbnail: !!thumbnail
    });
    
    // 수신 준비 알림
    toast.info(`Incoming file: ${metadata.name}`, {
      description: formatFileSize(metadata.size),
      duration: 5000
    });
  }, []);
  
  /**
   * 파일 전송 시작
   */
  const sendFile = useCallback(async (file: File, receiverId: string) => {
    if (!senderWorkerRef.current || !receiverWorkerRef.current) {
      setError('Workers not initialized');
      return;
    }
    
    try {
      setIsTransferring(true);
      setError(null);
      setProgress(null);
      
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('[OptimizedFileTransfer] Starting file transfer:', {
        transferId,
        fileName: file.name,
        fileSize: file.size,
        receiverId
      });
      
      // 수신자에게 전송 시작 알림
      senderWorkerRef.current.postMessage({
        type: 'start-transfer',
        payload: {
          file,
          transferId,
          chunkSize,
          receiverId
        }
      });
      
      // 수신자에게 전송 초기화 알림
      receiverWorkerRef.current.postMessage({
        type: 'init-transfer',
        payload: {
          transferId,
          totalChunks: Math.ceil(file.size / chunkSize),
          totalSize: file.size,
          senderId: 'self',
          mimeType: file.type,
          fileName: file.name
        }
      });
      
    } catch (error) {
      console.error('[OptimizedFileTransfer] Failed to start transfer:', error);
      setError(`Failed to start transfer: ${error}`);
      setIsTransferring(false);
    }
  }, [chunkSize]);
  
  /**
   * 전송 일시 중지
   */
  const pauseTransfer = useCallback(() => {
    if (senderWorkerRef.current && currentTransfer) {
      senderWorkerRef.current.postMessage({
        type: 'pause-transfer',
        payload: {}
      });
      
      toast.info('Transfer paused', {
        duration: 2000
      });
    }
  }, [currentTransfer]);
  
  /**
   * 전송 재개
   */
  const resumeTransfer = useCallback(() => {
    if (senderWorkerRef.current && currentTransfer) {
      senderWorkerRef.current.postMessage({
        type: 'resume-transfer',
        payload: {}
      });
      
      toast.info('Transfer resumed', {
        duration: 2000
      });
    }
  }, [currentTransfer]);
  
  /**
   * 전송 취소
   */
  const cancelTransfer = useCallback(() => {
    if (senderWorkerRef.current && currentTransfer) {
      senderWorkerRef.current.postMessage({
        type: 'cancel-transfer',
        payload: {}
      });
      
      if (receiverWorkerRef.current) {
        receiverWorkerRef.current.postMessage({
          type: 'cancel',
          payload: { transferId: currentTransfer }
        });
      }
    }
  }, [currentTransfer]);
  
  /**
   * ACK 수신 (외부에서 호출)
   */
  const receiveAck = useCallback((transferId: string, chunkIndex: number) => {
    if (senderWorkerRef.current) {
      senderWorkerRef.current.postMessage({
        type: 'ack-received',
        payload: { transferId, chunkIndex }
      });
    }
  }, []);
  
  /**
   * 배치 ACK 수신 (외부에서 호출)
   */
  const receiveBatchAck = useCallback((batchAck: any) => {
    if (senderWorkerRef.current) {
      senderWorkerRef.current.postMessage({
        type: 'batch-ack-received',
        payload: batchAck
      });
    }
  }, []);
  
  /**
   * 청크 수신 (외부에서 호출)
   */
  const receiveChunk = useCallback((transferId: string, chunkIndex: number, data: ArrayBuffer, senderId: string) => {
    if (receiverWorkerRef.current) {
      receiverWorkerRef.current.postMessage({
        type: 'chunk',
        payload: {
          transferId,
          index: chunkIndex,
          data,
          senderId
        }
      }, [data]);
    }
  }, []);
  
  /**
   * 파일 조립 요청 (외부에서 호출)
   */
  const assembleFile = useCallback((transferId: string, mimeType: string, fileName: string) => {
    if (receiverWorkerRef.current) {
      receiverWorkerRef.current.postMessage({
        type: 'assemble',
        payload: {
          transferId,
          mimeType,
          fileName
        }
      });
    }
  }, []);
  
  return {
    // 상태
    isTransferring,
    currentTransfer,
    progress,
    preflightProgress,
    error,
    
    // 액션
    sendFile,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    
    // 외부 인터페이스
    receiveAck,
    receiveBatchAck,
    receiveChunk,
    assembleFile
  };
};