/**
 * 에러 복구 전략
 * 전송 실패 시 전체를 재시작하는 대신, 실패한 부분만 재전송합니다.
 */

export interface FailedChunk {
  index: number;
  attempts: number;
  lastError: Error;
  lastAttempt: number;
  backoffDelay: number;
}

export interface RecoveryStats {
  totalFailures: number;
  totalRecoveries: number;
  successRate: number;
  averageRetries: number;
  failureReasons: Map<string, number>;
}

export interface RecoveryOptions {
  maxRetries: number;
  baseBackoffDelay: number; // ms
  maxBackoffDelay: number; // ms
  backoffMultiplier: number;
  enablePartialRecovery: boolean;
  enableAdaptiveRetry: boolean;
}

export class ErrorRecoveryManager {
  private failedChunks = new Map<number, FailedChunk>();
  private recoveryStats: RecoveryStats;
  private options: RecoveryOptions;
  
  private onRecoveryCallback?: (chunkIndex: number, attempt: number) => void;
  private onFatalErrorCallback?: (chunkIndex: number, error: Error) => void;
  private onRecoveryCompleteCallback?: (recoveredChunks: number[]) => void;
  
  constructor(options?: Partial<RecoveryOptions>) {
    this.options = {
      maxRetries: 5,
      baseBackoffDelay: 1000, // 1초
      maxBackoffDelay: 30000, // 30초
      backoffMultiplier: 2,
      enablePartialRecovery: true,
      enableAdaptiveRetry: true,
      ...options
    };
    
    this.recoveryStats = {
      totalFailures: 0,
      totalRecoveries: 0,
      successRate: 1.0,
      averageRetries: 0,
      failureReasons: new Map()
    };
    
    console.log('[ErrorRecoveryManager] Initialized:', this.options);
  }
  
  /**
   * 콜백 설정
   */
  onRecovery(callback: (chunkIndex: number, attempt: number) => void) {
    this.onRecoveryCallback = callback;
  }
  
  onFatalError(callback: (chunkIndex: number, error: Error) => void) {
    this.onFatalErrorCallback = callback;
  }
  
  onRecoveryComplete(callback: (recoveredChunks: number[]) => void) {
    this.onRecoveryCompleteCallback = callback;
  }
  
  /**
   * 청크 에러 처리
   */
  async handleChunkError(chunkIndex: number, error: Error): Promise<boolean> {
    const failed = this.failedChunks.get(chunkIndex);
    
    if (!failed) {
      // 첫 실패
      this.failedChunks.set(chunkIndex, {
        index: chunkIndex,
        attempts: 1,
        lastError: error,
        lastAttempt: Date.now(),
        backoffDelay: this.options.baseBackoffDelay
      });
      
      this.updateStats(error);
      
      console.warn(`[ErrorRecoveryManager] First failure for chunk ${chunkIndex}:`, error.message);
      return true; // 재시도 가능
    }
    
    // 이전 실패 기록 업데이트
    failed.attempts++;
    failed.lastError = error;
    failed.lastAttempt = Date.now();
    
    // 최대 재시도 횟수 확인
    if (failed.attempts >= this.options.maxRetries) {
      console.error(`[ErrorRecoveryManager] Chunk ${chunkIndex} failed after ${failed.attempts} attempts`);
      
      if (this.onFatalErrorCallback) {
        this.onFatalErrorCallback(chunkIndex, error);
      }
      
      return false; // 재시도 불가
    }
    
    // 백오프 지연 계산
    failed.backoffDelay = this.calculateBackoffDelay(failed.attempts);
    
    console.warn(`[ErrorRecoveryManager] Retry ${failed.attempts}/${this.options.maxRetries} for chunk ${chunkIndex} after ${failed.backoffDelay}ms:`, error.message);
    
    // 지연 후 재시도
    await this.waitForBackoff(failed.backoffDelay);
    
    if (this.onRecoveryCallback) {
      this.onRecoveryCallback(chunkIndex, failed.attempts);
    }
    
    return true; // 재시도 가능
  }
  
  /**
   * 청크 성공 처리
   */
  handleChunkSuccess(chunkIndex: number) {
    if (this.failedChunks.has(chunkIndex)) {
      const failed = this.failedChunks.get(chunkIndex)!;
      this.failedChunks.delete(chunkIndex);
      
      this.recoveryStats.totalRecoveries++;
      
      console.log(`[ErrorRecoveryManager] Chunk ${chunkIndex} recovered after ${failed.attempts} attempts`);
    }
  }
  
  /**
   * 부분 복구 실행
   */
  async recoverFailedChunks(): Promise<number[]> {
    if (!this.options.enablePartialRecovery) {
      console.log('[ErrorRecoveryManager] Partial recovery disabled');
      return [];
    }
    
    const failedIndices = Array.from(this.failedChunks.keys());
    
    if (failedIndices.length === 0) {
      console.log('[ErrorRecoveryManager] No failed chunks to recover');
      return [];
    }
    
    console.log(`[ErrorRecoveryManager] Recovering ${failedIndices.length} failed chunks`);
    
    const recoveredChunks: number[] = [];
    
    for (const index of failedIndices) {
      const failed = this.failedChunks.get(index)!;
      
      // 백오프 지연 확인
      const timeSinceLastAttempt = Date.now() - failed.lastAttempt;
      if (timeSinceLastAttempt < failed.backoffDelay) {
        continue; // 아직 대기 중
      }
      
      // 재시도 가능 여부 확인
      if (failed.attempts < this.options.maxRetries) {
        recoveredChunks.push(index);
        
        if (this.onRecoveryCallback) {
          this.onRecoveryCallback(index, failed.attempts);
        }
      }
    }
    
    if (this.onRecoveryCompleteCallback) {
      this.onRecoveryCompleteCallback(recoveredChunks);
    }
    
    return recoveredChunks;
  }
  
  /**
   * 네트워크 상태 기반 적응적 재시도
   */
  adaptToNetworkCondition(networkQuality: 'excellent' | 'good' | 'fair' | 'poor') {
    if (!this.options.enableAdaptiveRetry) return;
    
    const originalMaxRetries = this.options.maxRetries;
    const originalBaseDelay = this.options.baseBackoffDelay;
    
    switch (networkQuality) {
      case 'excellent':
        this.options.maxRetries = Math.max(2, originalMaxRetries - 2);
        this.options.baseBackoffDelay = Math.max(500, originalBaseDelay / 2);
        break;
      case 'good':
        this.options.maxRetries = Math.max(3, originalMaxRetries - 1);
        this.options.baseBackoffDelay = Math.max(750, originalBaseDelay * 0.75);
        break;
      case 'fair':
        // 기본값 유지
        break;
      case 'poor':
        this.options.maxRetries = Math.min(8, originalMaxRetries + 2);
        this.options.baseBackoffDelay = Math.min(2000, originalBaseDelay * 1.5);
        break;
    }
    
    console.log(`[ErrorRecoveryManager] Adapted to network quality ${networkQuality}:`, {
      maxRetries: this.options.maxRetries,
      baseBackoffDelay: this.options.baseBackoffDelay
    });
  }
  
  /**
   * 백오프 지연 계산
   */
  private calculateBackoffDelay(attempt: number): number {
    // 지수 백오프 + 지터
    const exponentialDelay = this.options.baseBackoffDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% 지터
    
    return Math.min(
      exponentialDelay + jitter,
      this.options.maxBackoffDelay
    );
  }
  
  /**
   * 백오프 대기
   */
  private waitForBackoff(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * 통계 업데이트
   */
  private updateStats(error: Error) {
    this.recoveryStats.totalFailures++;
    
    // 실패 원인 집계
    const reason = error.message || 'Unknown error';
    const count = this.recoveryStats.failureReasons.get(reason) || 0;
    this.recoveryStats.failureReasons.set(reason, count + 1);
    
    // 성공률 계산
    const totalAttemptsForSuccess = this.recoveryStats.totalFailures + this.recoveryStats.totalRecoveries;
    this.recoveryStats.successRate = totalAttemptsForSuccess > 0 ? this.recoveryStats.totalRecoveries / totalAttemptsForSuccess : 1.0;
    
    // 평균 재시도 횟수 계산
    const totalRetryAttempts = Array.from(this.failedChunks.values()).reduce((sum, failed) => sum + failed.attempts, 0);
    const failedCount = this.failedChunks.size;
    this.recoveryStats.averageRetries = failedCount > 0 ? totalRetryAttempts / failedCount : 0;
  }
  
  /**
   * 실패한 청크 목록 반환
   */
  getFailedChunks(): number[] {
    return Array.from(this.failedChunks.keys());
  }
  
  /**
   * 특정 청크의 실패 정보 반환
   */
  getFailedChunkInfo(index: number): FailedChunk | null {
    return this.failedChunks.get(index) || null;
  }
  
  /**
   * 복구 통계 반환
   */
  getRecoveryStats(): RecoveryStats {
    return { ...this.recoveryStats };
  }
  
  /**
   * 상세 상태 정보
   */
  getDetailedStatus() {
    const failedChunks = Array.from(this.failedChunks.values());
    const now = Date.now();
    
    return {
      stats: this.recoveryStats,
      failedChunks: failedChunks.map(failed => ({
        ...failed,
        timeSinceLastAttempt: now - failed.lastAttempt,
        nextRetryIn: Math.max(0, failed.backoffDelay - (now - failed.lastAttempt))
      })),
      options: this.options,
      canRecover: failedChunks.some(failed => 
        failed.attempts < this.options.maxRetries &&
        now - failed.lastAttempt >= failed.backoffDelay
      )
    };
  }
  
  /**
   * 설정 업데이트
   */
  updateOptions(newOptions: Partial<RecoveryOptions>) {
    this.options = { ...this.options, ...newOptions };
    console.log('[ErrorRecoveryManager] Options updated:', this.options);
  }
  
  /**
   * 실패한 청크 정리
   */
  clearFailedChunks(chunkIndices?: number[]) {
    if (chunkIndices) {
      // 특정 청크만 정리
      for (const index of chunkIndices) {
        this.failedChunks.delete(index);
      }
      console.log(`[ErrorRecoveryManager] Cleared ${chunkIndices.length} failed chunks`);
    } else {
      // 모든 실패 청크 정리
      const count = this.failedChunks.size;
      this.failedChunks.clear();
      console.log(`[ErrorRecoveryManager] Cleared all ${count} failed chunks`);
    }
  }
  
  /**
   * 통계 리셋
   */
  resetStats() {
    this.recoveryStats = {
      totalFailures: 0,
      totalRecoveries: 0,
      successRate: 1.0,
      averageRetries: 0,
      failureReasons: new Map()
    };
    
    console.log('[ErrorRecoveryManager] Stats reset');
  }
  
  /**
   * 전체 리셋
   */
  reset() {
    this.failedChunks.clear();
    this.resetStats();
    console.log('[ErrorRecoveryManager] Fully reset');
  }
  
  /**
   * 상태 로깅
   */
  logStatus() {
    console.log('[ErrorRecoveryManager] Status:', this.getDetailedStatus());
  }
}