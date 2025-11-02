/**
 * 프로그레시브 UI 업데이트
 * 진행률 업데이트를 스무딩하여 부드러운 사용자 경험을 제공합니다.
 */

export interface ProgressUpdate {
  progress: number;
  speed?: number;
  eta?: number;
  smoothed: boolean;
  timestamp: number;
}

export interface SmoothingConfig {
  factor: number; // 스무딩 계수 (0-1)
  updateInterval: number; // 업데이트 간격 (ms)
  minChangeThreshold: number; // 최소 변화 임계값
  maxChangePerUpdate: number; // 업데이트당 최대 변화량
}

export class ProgressSmoother {
  private displayProgress = 0;
  private targetProgress = 0;
  private displaySpeed = 0;
  private targetSpeed = 0;
  private displayETA = 0;
  private targetETA = 0;
  
  private lastUpdateTime = 0;
  private animationFrame: number | null = null;
  private isRunning = false;
  
  private config: SmoothingConfig;
  private onUpdateCallback?: (update: ProgressUpdate) => void;
  
  constructor(config?: Partial<SmoothingConfig>) {
    this.config = {
      factor: 0.15, // 15% 스무딩
      updateInterval: 16, // ~60fps
      minChangeThreshold: 0.001, // 0.1%
      maxChangePerUpdate: 0.05, // 5%
      ...config
    };
    
    console.log('[ProgressSmoother] Initialized with config:', this.config);
  }
  
  /**
   * 업데이트 콜백 설정
   */
  onUpdate(callback: (update: ProgressUpdate) => void) {
    this.onUpdateCallback = callback;
  }
  
  /**
   * 목표 진행률 설정
   */
  setTarget(progress: number, speed?: number, eta?: number) {
    this.targetProgress = Math.max(0, Math.min(1, progress));
    
    if (speed !== undefined) {
      this.targetSpeed = Math.max(0, speed);
    }
    
    if (eta !== undefined) {
      this.targetETA = Math.max(0, eta);
    }
    
    if (!this.isRunning) {
      this.startAnimation();
    }
  }
  
  /**
   * 즉시 진행률 설정 (스무딩 없음)
   */
  setImmediate(progress: number, speed?: number, eta?: number) {
    this.displayProgress = Math.max(0, Math.min(1, progress));
    this.targetProgress = this.displayProgress;
    
    if (speed !== undefined) {
      this.displaySpeed = Math.max(0, speed);
      this.targetSpeed = this.displaySpeed;
    }
    
    if (eta !== undefined) {
      this.displayETA = Math.max(0, eta);
      this.targetETA = this.displayETA;
    }
    
    this.notifyUpdate(false);
  }
  
  /**
   * 현재 표시 진행률 반환
   */
  getDisplayProgress(): number {
    return this.displayProgress;
  }
  
  /**
   * 현재 표시 속도 반환
   */
  getDisplaySpeed(): number {
    return this.displaySpeed;
  }
  
  /**
   * 현재 표시 ETA 반환
   */
  getDisplayETA(): number {
    return this.displayETA;
  }
  
  /**
   * 목표 진행률 반환
   */
  getTargetProgress(): number {
    return this.targetProgress;
  }
  
  /**
   * 애니메이션 시작
   */
  private startAnimation() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdateTime = performance.now();
    this.animate();
  }
  
  /**
   * 애니메이션 중지
   */
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    this.isRunning = false;
  }
  
  /**
   * 애니메이션 루프
   */
  private animate() {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    
    // 업데이트 간격 체크
    if (deltaTime >= this.config.updateInterval) {
      this.updateValues();
      this.lastUpdateTime = now;
    }
    
    // 목표값에 도달했는지 확인
    if (this.isAtTarget()) {
      this.snapToTarget();
      this.stop();
      return;
    }
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }
  
  /**
   * 값 업데이트
   */
  private updateValues() {
    let hasChanges = false;
    
    // 진행률 업데이트
    const progressDiff = this.targetProgress - this.displayProgress;
    if (Math.abs(progressDiff) > this.config.minChangeThreshold) {
      const maxChange = this.config.maxChangePerUpdate;
      const actualChange = Math.max(
        -maxChange,
        Math.min(maxChange, progressDiff * this.config.factor)
      );
      
      this.displayProgress += actualChange;
      hasChanges = true;
    }
    
    // 속도 업데이트
    const speedDiff = this.targetSpeed - this.displaySpeed;
    if (Math.abs(speedDiff) > 0.1) { // 0.1 bytes/s 이상 변화
      this.displaySpeed += speedDiff * this.config.factor;
      hasChanges = true;
    }
    
    // ETA 업데이트
    const etaDiff = this.targetETA - this.displayETA;
    if (Math.abs(etaDiff) > 100) { // 100ms 이상 변화
      this.displayETA += etaDiff * this.config.factor;
      hasChanges = true;
    }
    
    if (hasChanges) {
      this.notifyUpdate(true);
    }
  }
  
  /**
   * 목표값에 도달했는지 확인
   */
  private isAtTarget(): boolean {
    return (
      Math.abs(this.targetProgress - this.displayProgress) < this.config.minChangeThreshold &&
      Math.abs(this.targetSpeed - this.displaySpeed) < 0.1 &&
      Math.abs(this.targetETA - this.displayETA) < 100
    );
  }
  
  /**
   * 목표값으로 스냅
   */
  private snapToTarget() {
    this.displayProgress = this.targetProgress;
    this.displaySpeed = this.targetSpeed;
    this.displayETA = this.targetETA;
    this.notifyUpdate(false);
  }
  
  /**
   * 업데이트 알림
   */
  private notifyUpdate(smoothed: boolean) {
    if (this.onUpdateCallback) {
      this.onUpdateCallback({
        progress: this.displayProgress,
        speed: this.displaySpeed,
        eta: this.displayETA,
        smoothed,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * 리셋
   */
  reset() {
    this.stop();
    
    this.displayProgress = 0;
    this.targetProgress = 0;
    this.displaySpeed = 0;
    this.targetSpeed = 0;
    this.displayETA = 0;
    this.targetETA = 0;
    this.lastUpdateTime = 0;
    
    console.log('[ProgressSmoother] Reset');
  }
  
  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<SmoothingConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('[ProgressSmoother] Config updated:', this.config);
  }
  
  /**
   * 현재 설정 반환
   */
  getConfig(): SmoothingConfig {
    return { ...this.config };
  }
  
  /**
   * 상태 정보
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      displayProgress: this.displayProgress,
      targetProgress: this.targetProgress,
      displaySpeed: this.displaySpeed,
      targetSpeed: this.targetSpeed,
      displayETA: this.displayETA,
      targetETA: this.targetETA,
      progressDiff: Math.abs(this.targetProgress - this.displayProgress),
      speedDiff: Math.abs(this.targetSpeed - this.displaySpeed),
      etaDiff: Math.abs(this.targetETA - this.displayETA)
    };
  }
}

/**
 * 진행률 포맷 유틸리티
 */
export const formatProgress = (progress: number): string => {
  return `${Math.round(progress * 100)}%`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let size = bytesPerSecond;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const formatETA = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * 진행률 색상 계산
 */
export const getProgressColor = (progress: number): string => {
  if (progress < 0.3) return '#ef4444'; // red-500
  if (progress < 0.6) return '#f59e0b'; // amber-500
  if (progress < 0.9) return '#3b82f6'; // blue-500
  return '#10b981'; // emerald-500
};

/**
 * 진행률 상태 텍스트
 */
export const getProgressStatus = (progress: number): string => {
  if (progress < 0.1) return '초기화 중...';
  if (progress < 0.3) return '전송 시작 중...';
  if (progress < 0.6) return '전송 중...';
  if (progress < 0.9) return '거의 완료...';
  if (progress < 0.99) return '완료 처리 중...';
  return '완료';
};