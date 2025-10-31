import { getOptimalChunkSize } from './device/deviceDetector';

export const MAX_MESSAGE_SIZE = 16 * 1024;

export const calculateOptimalChunkSize = (fileSize: number): number => {
  const baseChunkSize = getOptimalChunkSize();
  if (fileSize < 1 * 1024 * 1024) {
    return 16 * 1024;
  }
  if (fileSize < 100 * 1024 * 1024) {
    return Math.min(baseChunkSize, 64 * 1024);
  }
  return 64 * 1024;
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
