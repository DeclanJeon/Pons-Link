// src/lib/adaptiveChunking.ts

interface NetworkMetrics {
  rtt: number; // Round Trip Time (ms)
  bandwidth: number; // bytes/s
  packetLoss: number; // 0~1
}

export class AdaptiveChunkSizer {
  private metrics: NetworkMetrics = {
    rtt: 100,
    bandwidth: 1024 * 1024, // 1MB/s 기본값
    packetLoss: 0,
  };

  private readonly MIN_CHUNK_SIZE = 16 * 1024; // 16KB
  private readonly MAX_CHUNK_SIZE = 256 * 1024; // 256KB
  private readonly TARGET_TRANSFER_TIME = 200; // 목표 전송 시간 (ms)

  updateMetrics(rtt: number, bandwidth: number, packetLoss: number) {
    // 지수 이동 평균으로 스무딩
    this.metrics.rtt = this.metrics.rtt * 0.7 + rtt * 0.3;
    this.metrics.bandwidth = this.metrics.bandwidth * 0.7 + bandwidth * 0.3;
    this.metrics.packetLoss = this.metrics.packetLoss * 0.7 + packetLoss * 0.3;
  }

  calculateOptimalChunkSize(): number {
    // 대역폭 기반 초기 크기
    let chunkSize = (this.metrics.bandwidth * this.TARGET_TRANSFER_TIME) / 1000;

    // RTT 보정 (RTT가 높으면 청크 크기 증가)
    if (this.metrics.rtt > 200) {
      chunkSize *= 1.5;
    } else if (this.metrics.rtt < 50) {
      chunkSize *= 0.8;
    }

    // 패킷 손실 보정 (손실률이 높으면 청크 크기 감소)
    if (this.metrics.packetLoss > 0.05) {
      chunkSize *= 0.5;
    }

    // 범위 제한
    return Math.max(
      this.MIN_CHUNK_SIZE,
      Math.min(this.MAX_CHUNK_SIZE, Math.round(chunkSize))
    );
  }

  getRecommendedWindowSize(): number {
    // 대역폭-지연 곱(Bandwidth-Delay Product) 기반
    const bdp = (this.metrics.bandwidth * this.metrics.rtt) / 1000;
    const chunkSize = this.calculateOptimalChunkSize();
    
    // 동시 전송 가능한 청크 수
    return Math.max(10, Math.min(100, Math.ceil(bdp / chunkSize)));
  }
}