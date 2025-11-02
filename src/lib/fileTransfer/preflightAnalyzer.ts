/**
 * 프리플라이트 UI 피드백 시스템
 * 파일 선택 즉시 분석을 시작하고, 사용자에게 실시간 진행 상황을 보여줍니다.
 */

export interface QuickAnalysis {
  estimatedTime: number;
  chunkCount: number;
  requiredMemory: number;
  recommendedChunkSize: number;
  transferStrategy: string;
}

export interface DetailedAnalysis extends QuickAnalysis {
  actualChecksumSpeed: number;
  refinedEstimate: number;
  networkOptimization: string;
  compressionRecommendation: boolean;
}

export interface PreflightReport {
  file: File;
  quick: QuickAnalysis;
  detailed?: DetailedAnalysis;
  stage: 'initial' | 'quick' | 'detailed' | 'ready';
  progress: number;
}

export class PreflightAnalyzer {
  private onProgressCallback?: (report: PreflightReport) => void;
  private chunkSize: number;
  
  constructor(chunkSize: number = 64 * 1024) {
    this.chunkSize = chunkSize;
  }
  
  /**
   * 진행 상황 콜백 설정
   */
  onProgress(callback: (report: PreflightReport) => void) {
    this.onProgressCallback = callback;
  }
  
  /**
   * 파일 사전 분석
   */
  async analyzeFile(file: File): Promise<PreflightReport> {
    const report: PreflightReport = {
      file,
      stage: 'initial',
      progress: 0,
      quick: {
        estimatedTime: 0,
        chunkCount: 0,
        requiredMemory: 0,
        recommendedChunkSize: this.chunkSize,
        transferStrategy: 'standard'
      }
    };
    
    // 1단계: 즉시 표시 (0ms)
    this.showInitialUI(report);
    
    // 2단계: 빠른 분석 (100ms)
    const quickAnalysis = await this.quickScan(file);
    report.quick = quickAnalysis;
    report.stage = 'quick';
    report.progress = 30;
    this.updateUI(report);
    
    // 3단계: 상세 분석 (500ms)
    const detailedAnalysis = await this.detailedScan(file, quickAnalysis);
    report.detailed = detailedAnalysis;
    report.stage = 'detailed';
    report.progress = 70;
    this.updateUI(report);
    
    // 4단계: 준비 완료
    report.stage = 'ready';
    report.progress = 100;
    this.updateUI(report);
    
    return report;
  }
  
  /**
   * 초기 UI 표시
   */
  private showInitialUI(report: PreflightReport) {
    if (this.onProgressCallback) {
      this.onProgressCallback(report);
    }
  }
  
  /**
   * 빠른 분석
   */
  private async quickScan(file: File): Promise<QuickAnalysis> {
    const chunkCount = Math.ceil(file.size / this.chunkSize);
    const estimatedTime = this.estimateTransferTime(file.size);
    const requiredMemory = this.estimateMemory(file.size, chunkCount);
    const transferStrategy = this.selectTransferStrategy(file);
    
    return {
      estimatedTime,
      chunkCount,
      requiredMemory,
      recommendedChunkSize: this.chunkSize,
      transferStrategy
    };
  }
  
  /**
   * 상세 분석
   */
  private async detailedScan(file: File, quick: QuickAnalysis): Promise<DetailedAnalysis> {
    // 첫 1MB 읽어서 실제 성능 측정
    const sampleSize = Math.min(1024 * 1024, file.size);
    const sample = await file.slice(0, sampleSize).arrayBuffer();
    
    // 체크섬 속도 측정
    const startTime = performance.now();
    await this.calculateChecksum(sample);
    const checksumTime = performance.now() - startTime;
    const actualChecksumSpeed = sample.byteLength / checksumTime;
    
    // 네트워크 최적화 추천
    const networkOptimization = this.analyzeNetworkOptimization(file.size, actualChecksumSpeed);
    
    // 압축 추천
    const compressionRecommendation = this.shouldCompress(file);
    
    // 정교한 예측
    const refinedEstimate = this.refineEstimate(file.size, actualChecksumSpeed, quick.estimatedTime);
    
    return {
      ...quick,
      actualChecksumSpeed,
      refinedEstimate,
      networkOptimization,
      compressionRecommendation
    };
  }
  
  /**
   * 전송 시간 예측
   */
  private estimateTransferTime(fileSize: number): number {
    // 평균 전송 속도 (5MB/s) 가정
    const averageSpeed = 5 * 1024 * 1024;
    return fileSize / averageSpeed;
  }
  
  /**
   * 메모리 요구량 예측
   */
  private estimateMemory(fileSize: number, chunkCount: number): number {
    // 청크 캐시 + 오버헤드
    const cacheSize = Math.min(chunkCount, 50) * this.chunkSize;
    const overhead = cacheSize * 0.2; // 20% 오버헤드
    return cacheSize + overhead;
  }
  
  /**
   * 전송 전략 선택
   */
  private selectTransferStrategy(file: File): string {
    if (file.size < 10 * 1024 * 1024) return 'fast';
    if (file.size < 100 * 1024 * 1024) return 'standard';
    if (file.size < 1024 * 1024 * 1024) return 'optimized';
    return 'streaming';
  }
  
  /**
   * 네트워크 최적화 분석
   */
  private analyzeNetworkOptimization(fileSize: number, checksumSpeed: number): string {
    if (checksumSpeed < 10 * 1024 * 1024) {
      return 'low-power'; // 저사양 기기
    } else if (fileSize > 500 * 1024 * 1024) {
      return 'batch-transfer'; // 대용량 파일
    } else {
      return 'standard';
    }
  }
  
  /**
   * 압축 추천
   */
  private shouldCompress(file: File): boolean {
    // 이미 압축된 형식은 스킵
    const compressedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'video/', 'audio/',
      'application/zip', 'application/x-gzip'
    ];
    
    if (compressedTypes.some(type => file.type.includes(type))) {
      return false;
    }
    
    // 텍스트 기반 파일은 압축 효과 높음
    if (file.type.includes('text/') || file.type.includes('application/json')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 정교한 예측
   */
  private refineEstimate(fileSize: number, checksumSpeed: number, baseEstimate: number): number {
    // 체크섬 속도에 따라 예측 조정
    const checksumFactor = Math.max(0.1, checksumSpeed / (10 * 1024 * 1024));
    return baseEstimate * (2 - checksumFactor); // 속도가 빠를수록 시간 단축
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
   * UI 업데이트
   */
  private updateUI(report: PreflightReport) {
    if (this.onProgressCallback) {
      this.onProgressCallback(report);
    }
  }
}

/**
 * UI 표시용 유틸리티 함수
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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