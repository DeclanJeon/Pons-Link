import { getOptimalChunkSize } from '../device/deviceDetector';

export const MAX_MESSAGE_SIZE = 16 * 1024;

export const calculateOptimalChunkSize = (fileSize: number): number => {
  // MTU 고려: 일반적으로 1500 bytes
  // SCTP 헤더: ~50 bytes
  // 커스텀 헤더: ~20 bytes
  // 안전 마진: 64KB가 대부분 환경에서 최적
  
  if (fileSize < 10 * 1024 * 1024) { // 10MB 미만
    return 32 * 1024; // 32KB
  } else if (fileSize < 100 * 1024 * 1024) { // 100MB 미만
    return 64 * 1024; // 64KB
  } else {
    return 128 * 1024; // 128KB (대용량)
  }
};

/**
 * 네트워크 상태에 따른 동적 청크 크기 계산
 */
export const calculateAdaptiveChunkSize = (
  baseChunkSize: number,
  averageRTT: number,
  congestionWindow: number,
  isInSlowStart: boolean
): number => {
  // 기본 크기
  let adaptiveSize = baseChunkSize;
  
  // RTT 기반 조정
  if (averageRTT < 50) {
    // 매우 빠른 네트워크 (LAN)
    adaptiveSize = Math.min(256 * 1024, baseChunkSize * 2);
  } else if (averageRTT < 150) {
    // 빠른 네트워크
    adaptiveSize = Math.min(128 * 1024, baseChunkSize * 1.5);
  } else if (averageRTT > 500) {
    // 느린 네트워크
    adaptiveSize = Math.max(16 * 1024, baseChunkSize * 0.5);
  }
  
  // 혼잡 윈도우 기반 조정
  if (congestionWindow < 8) {
    // 혼잡 상태: 더 작은 청크
    adaptiveSize = Math.max(16 * 1024, adaptiveSize * 0.7);
  } else if (congestionWindow > 32 && isInSlowStart) {
    // Slow Start 중이고 윈도우가 크면: 더 큰 청크
    adaptiveSize = Math.min(256 * 1024, adaptiveSize * 1.3);
  }
  
  // 최소/최대 제한
  return Math.max(8 * 1024, Math.min(256 * 1024, adaptiveSize));
};

/**
 * 네트워크 품질 평가
 */
export const assessNetworkQuality = (
  averageRTT: number,
  rttVariance: number,
  congestionWindow: number
): 'excellent' | 'good' | 'fair' | 'poor' => {
  // RTT 점수 (0-100)
  const rttScore = Math.max(0, Math.min(100, 100 - (averageRTT / 10)));
  
  // 안정성 점수 (분산이 낮을수록 높음)
  const stabilityScore = Math.max(0, Math.min(100, 100 - (rttVariance / 5)));
  
  // 혼잡 윈도우 점수 (클수록 좋음)
  const windowScore = Math.max(0, Math.min(100, (congestionWindow / 64) * 100));
  
  // 종합 점수
  const totalScore = (rttScore * 0.4) + (stabilityScore * 0.3) + (windowScore * 0.3);
  
  if (totalScore >= 80) return 'excellent';
  if (totalScore >= 60) return 'good';
  if (totalScore >= 40) return 'fair';
  return 'poor';
};

export const isValidFileSize = (fileSize: number, maxSize: number = 100 * 1024 * 1024 * 1024): boolean => {
  return fileSize > 0 && fileSize <= maxSize;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const calculateFileOffset = (chunkIndex: number, chunkSize: number): number => {
  return chunkIndex * chunkSize;
};

export const calculateTotalChunks = (fileSize: number, chunkSize: number): number => {
  if (chunkSize <= 0) return 0;
  return Math.ceil(fileSize / chunkSize);
};

export const calculateActualChunkSize = (fileSize: number, chunkIndex: number, chunkSize: number): number => {
  const offset = calculateFileOffset(chunkIndex, chunkSize);
  const remaining = fileSize - offset;
  return Math.min(chunkSize, remaining);
};

export const calculateProgress = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(1, completed / total);
};

export const calculateTransferSpeed = (bytesTransferred: number, startTime: number, currentTime: number = Date.now()): number => {
  const elapsedSeconds = (currentTime - startTime) / 1000;
  if (elapsedSeconds <= 0) return 0;
  return bytesTransferred / elapsedSeconds;
};

export const calculateETA = (bytesRemaining: number, currentSpeed: number): number => {
  if (currentSpeed === 0) return Infinity;
  return bytesRemaining / currentSpeed;
};

export const formatETA = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

export const isValidChunkIndex = (chunkIndex: number, totalChunks: number): boolean => {
  return chunkIndex >= 0 && chunkIndex < totalChunks;
};

export const isValidFileType = (file: File): boolean => {
  const dangerousTypes = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-sharedlib',
    'application/javascript',
    'text/html',
  ];
  if (dangerousTypes.includes(file.type)) {
    return false;
  }
  const dangerousExtensions = ['.exe', '.dll', '.bat', '.sh', '.js', '.html', '.htm'];
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (dangerousExtensions.includes(extension)) {
    return false;
  }
  return true;
};

/**
 * 파일 체크섬 계산 (SHA-256)
 */
export const calculateFileChecksum = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Blob 체크섬 계산 (SHA-256)
 */
export const calculateBlobChecksum = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * 체크섬 검증
 */
export const verifyChecksum = async (blob: Blob, expectedChecksum: string): Promise<boolean> => {
  const actualChecksum = await calculateBlobChecksum(blob);
  
  console.log('🔍 Checksum verification:', {
    expected: expectedChecksum,
    actual: actualChecksum,
    match: expectedChecksum === actualChecksum,
  });
  
  return expectedChecksum === actualChecksum;
};
