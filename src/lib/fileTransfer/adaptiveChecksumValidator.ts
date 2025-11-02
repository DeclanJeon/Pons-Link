/**
 * 적응형 체크섬 검증 전략
 * 모든 청크를 검증하는 대신, 통계적으로 유의미한 샘플링 + 최종 파일 검증을 수행합니다.
 */
export class AdaptiveChecksumValidator {
  private fileSize: number;
  private totalChunks: number;
  private sampleRate: number;
  private sampledChunks: Set<number>;
  
  constructor(fileSize: number, chunkSize: number) {
    this.fileSize = fileSize;
    this.totalChunks = Math.ceil(fileSize / chunkSize);
    this.sampleRate = this.getSamplingRate(fileSize);
    this.sampledChunks = this.selectSampleChunks(this.totalChunks, this.sampleRate);
  }
  
  /**
   * 파일 크기에 따른 샘플링 비율 결정
   */
  private getSamplingRate(fileSize: number): number {
    if (fileSize < 100 * 1024 * 1024) return 1.0;      // 100MB 미만: 전체
    if (fileSize < 1024 * 1024 * 1024) return 0.1;    // 1GB 미만: 10%
    return 0.01;                                        // 1GB 이상: 1%
  }
  
  /**
   * 전략적 샘플 선택 (첫/중간/끝 + 랜덤)
   */
  private selectSampleChunks(totalChunks: number, rate: number): Set<number> {
    const samples = new Set<number>();
    
    // 필수 검증: 첫 청크, 마지막 청크, 중간 청크
    samples.add(0);
    samples.add(totalChunks - 1);
    samples.add(Math.floor(totalChunks / 2));
    
    // 랜덤 샘플링
    const sampleCount = Math.max(3, Math.floor(totalChunks * rate));
    while (samples.size < sampleCount) {
      samples.add(Math.floor(Math.random() * totalChunks));
    }
    
    console.log(`[AdaptiveChecksum] Sampling strategy:`, {
      fileSize: this.fileSize,
      totalChunks,
      sampleRate: rate,
      sampleCount,
      sampledChunks: Array.from(samples).sort((a, b) => a - b)
    });
    
    return samples;
  }
  
  /**
   * 특정 청크가 검증 대상인지 확인
   */
  shouldValidate(chunkIndex: number): boolean {
    return this.sampledChunks.has(chunkIndex);
  }
  
  /**
   * 샘플링 정보 반환
   */
  getSamplingInfo() {
    return {
      fileSize: this.fileSize,
      totalChunks: this.totalChunks,
      sampleRate: this.sampleRate,
      sampledChunks: Array.from(this.sampledChunks).sort((a, b) => a - b),
      sampleCount: this.sampledChunks.size,
      validationReduction: Math.round((1 - this.sampleRate) * 100)
    };
  }
  
  /**
   * 체크섬 계산 (Web Worker용)
   */
  static async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * 파일 전체 체크섬 계산 (최종 검증용)
   */
  static async calculateFileChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return this.calculateChecksum(buffer);
  }
  
  /**
   * 체크섬 검증
   */
  static async verifyChecksum(data: ArrayBuffer, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
}