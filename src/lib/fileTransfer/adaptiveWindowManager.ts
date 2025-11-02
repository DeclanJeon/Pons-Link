/**
 * 적응형 윈도우 크기 알고리즘
 * TCP의 혼잡 제어를 참고하여, 네트워크 상태에 따라 동시 전송 청크 수를 동적 조정합니다.
 */

export interface NetworkMetrics {
  rtt: number; // Round Trip Time (ms)
  packetLoss: number; // 패킷 손실률 (0-1)
  bandwidth: number; // 대역폭 (bytes/s)
}

export interface WindowState {
  currentSize: number;
  minSize: number;
  maxSize: number;
  ssthresh: number; // Slow Start Threshold
  state: 'slow-start' | 'congestion-avoidance' | 'fast-recovery';
  lastAdjustment: number;
}

export class AdaptiveWindowManager {
  private windowState: WindowState;
  private metrics: NetworkMetrics;
  private rttHistory: number[] = [];
  private readonly RTT_HISTORY_SIZE = 10;
  private readonly MIN_RTT_SAMPLES = 3;
  
  constructor(
    private initialWindowSize: number = 10,
    private minWindowSize: number = 5,
    private maxWindowSize: number = 100
  ) {
    this.windowState = {
      currentSize: initialWindowSize,
      minSize: minWindowSize,
      maxSize: maxWindowSize,
      ssthresh: Math.floor(maxWindowSize * 0.5),
      state: 'slow-start',
      lastAdjustment: Date.now()
    };
    
    this.metrics = {
      rtt: 100, // 초기 RTT 100ms 가정
      packetLoss: 0,
      bandwidth: 0
    };
    
    console.log('[AdaptiveWindowManager] Initialized:', this.windowState);
  }
  
  /**
   * ACK 수신 처리 (AIMD: Additive Increase, Multiplicative Decrease)
   */
  onAckReceived(rtt: number, isTimeout: boolean = false) {
    // RTT 업데이트
    this.updateRTT(rtt);
    
    if (isTimeout) {
      // 타임아웃 발생: 윈도우 크기 절반으로 감소
      this.handleTimeout();
    } else {
      // 성공적인 ACK: 윈도우 크기 증가
      this.handleSuccess();
    }
    
    // RTT 기반 미세 조정
    this.adjustByRTT(rtt);
    
    this.windowState.lastAdjustment = Date.now();
    
    console.log(`[AdaptiveWindowManager] ACK processed:`, {
      windowSize: this.windowState.currentSize,
      state: this.windowState.state,
      rtt,
      packetLoss: this.metrics.packetLoss
    });
  }
  
  /**
   * 패킷 손실 감지
   */
  onPacketLoss() {
    this.metrics.packetLoss = Math.min(1, this.metrics.packetLoss + 0.1);
    this.handlePacketLoss();
  }
  
  /**
   * 대역폭 업데이트
   */
  updateBandwidth(bytes: number, timeMs: number) {
    if (timeMs > 0) {
      this.metrics.bandwidth = (bytes / timeMs) * 1000; // bytes/s
    }
  }
  
  /**
   * 현재 윈도우 크기 반환
   */
  getWindowSize(): number {
    return Math.floor(this.windowState.currentSize);
  }
  
  /**
   * 윈도우 상태 반환
   */
  getWindowState(): WindowState {
    return { ...this.windowState };
  }
  
  /**
   * 네트워크 메트릭 반환
   */
  getNetworkMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }
  
  /**
   * RTT 업데이트
   */
  private updateRTT(rtt: number) {
    this.rttHistory.push(rtt);
    
    if (this.rttHistory.length > this.RTT_HISTORY_SIZE) {
      this.rttHistory.shift();
    }
    
    // 평균 RTT 계산
    if (this.rttHistory.length >= this.MIN_RTT_SAMPLES) {
      this.metrics.rtt = this.rttHistory.reduce((sum, r) => sum + r, 0) / this.rttHistory.length;
    }
  }
  
  /**
   * 성공적인 ACK 처리
   */
  private handleSuccess() {
    if (this.windowState.state === 'slow-start') {
      // Slow Start: 지수 증가
      this.windowState.currentSize = Math.min(
        this.windowState.currentSize * 2,
        this.windowState.maxSize
      );
      
      // ssthresh 도달 시 Congestion Avoidance로 전환
      if (this.windowState.currentSize >= this.windowState.ssthresh) {
        this.windowState.state = 'congestion-avoidance';
      }
    } else if (this.windowState.state === 'congestion-avoidance') {
      // Congestion Avoidance: 선형 증가
      this.windowState.currentSize = Math.min(
        this.windowState.currentSize + 1,
        this.windowState.maxSize
      );
    } else if (this.windowState.state === 'fast-recovery') {
      // Fast Recovery: 복구 후 Congestion Avoidance로 전환
      this.windowState.state = 'congestion-avoidance';
    }
    
    // 패킷 손실률 감소
    this.metrics.packetLoss = Math.max(0, this.metrics.packetLoss - 0.05);
  }
  
  /**
   * 타임아웃 처리
   */
  private handleTimeout() {
    // 윈도우 크기 절반으로 감소
    this.windowState.ssthresh = Math.max(
      this.windowState.minSize,
      Math.floor(this.windowState.currentSize / 2)
    );
    this.windowState.currentSize = this.windowState.minSize;
    this.windowState.state = 'slow-start';
    
    // 패킷 손실률 증가
    this.metrics.packetLoss = Math.min(1, this.metrics.packetLoss + 0.2);
  }
  
  /**
   * 패킷 손실 처리
   */
  private handlePacketLoss() {
    if (this.windowState.state === 'fast-recovery') {
      // 이미 Fast Recovery 상태면 타임아웃 처리
      this.handleTimeout();
    } else {
      // Fast Recovery로 전환
      this.windowState.ssthresh = Math.max(
        this.windowState.minSize,
        Math.floor(this.windowState.currentSize / 2)
      );
      this.windowState.currentSize = this.windowState.ssthresh;
      this.windowState.state = 'fast-recovery';
    }
  }
  
  /**
   * RTT 기반 미세 조정
   */
  private adjustByRTT(rtt: number) {
    if (rtt < 50) {
      // 매우 빠른 네트워크: 윈도우 증가
      this.windowState.currentSize = Math.min(
        this.windowState.currentSize + 5,
        this.windowState.maxSize
      );
    } else if (rtt > 500) {
      // 느린 네트워크: 윈도우 감소
      this.windowState.currentSize = Math.max(
        this.windowState.currentSize - 2,
        this.windowState.minSize
      );
    } else if (rtt > 200) {
      // 중간 속도 네트워크: 약간 감소
      this.windowState.currentSize = Math.max(
        this.windowState.currentSize - 1,
        this.windowState.minSize
      );
    }
  }
  
  /**
   * 네트워크 상태 분석
   */
  analyzeNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const { rtt, packetLoss } = this.metrics;
    
    if (rtt < 50 && packetLoss < 0.01) return 'excellent';
    if (rtt < 100 && packetLoss < 0.05) return 'good';
    if (rtt < 200 && packetLoss < 0.1) return 'fair';
    return 'poor';
  }
  
  /**
   * 최적 윈도우 크기 추천
   */
  getRecommendedWindowSize(): number {
    const quality = this.analyzeNetworkQuality();
    
    switch (quality) {
      case 'excellent':
        return Math.min(50, this.windowState.maxSize);
      case 'good':
        return Math.min(30, this.windowState.maxSize);
      case 'fair':
        return Math.min(20, this.windowState.maxSize);
      case 'poor':
        return Math.max(10, this.windowState.minSize);
      default:
        return this.windowState.currentSize;
    }
  }
  
  /**
   * 상태 리셋
   */
  reset() {
    this.windowState = {
      currentSize: this.initialWindowSize,
      minSize: this.minWindowSize,
      maxSize: this.maxWindowSize,
      ssthresh: Math.floor(this.maxWindowSize * 0.5),
      state: 'slow-start',
      lastAdjustment: Date.now()
    };
    
    this.metrics = {
      rtt: 100,
      packetLoss: 0,
      bandwidth: 0
    };
    
    this.rttHistory = [];
    
    console.log('[AdaptiveWindowManager] Reset to initial state');
  }
  
  /**
   * 상태 정보 로깅
   */
  logStatus() {
    console.log('[AdaptiveWindowManager] Status:', {
      window: this.windowState,
      metrics: this.metrics,
      quality: this.analyzeNetworkQuality(),
      recommended: this.getRecommendedWindowSize()
    });
  }
}