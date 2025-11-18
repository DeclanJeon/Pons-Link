/**
 * FileChunkReader - 대용량 파일의 효율적인 읽기를 담당
 */
export class FileChunkReader {
  private file: File;
  private chunkSize: number;
  // 동시 읽기 제한을 위한 세마포어 역할
  private activeReads = 0;
  private readonly MAX_CONCURRENT_READS = 5;
  
  constructor(file: File, chunkSize: number) {
    this.file = file;
    this.chunkSize = chunkSize;
  }
  
  /**
   * 특정 인덱스의 청크를 읽습니다.
   * @param index 청크 인덱스
   * @returns ArrayBuffer
   */
  async readChunk(index: number): Promise<ArrayBuffer> {
    if (this.activeReads >= this.MAX_CONCURRENT_READS) {
      // 너무 많은 동시 읽기 요청 시 잠시 대기 (Backpressure)
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.activeReads++;
    
    try {
      const start = index * this.chunkSize;
      // 파일 크기를 초과하지 않도록 조정
      const end = Math.min(start + this.chunkSize, this.file.size);
      
      if (start >= this.file.size) {
        throw new Error(`Chunk index ${index} out of bounds`);
      }

      // Blob.slice는 메모리를 복사하지 않고 포인터만 생성하므로 가볍습니다.
      const blob = this.file.slice(start, end);
      
      // 여기서 실제 메모리 할당이 일어납니다.
      const arrayBuffer = await blob.arrayBuffer();
      
      return arrayBuffer;
    } catch (error) {
      console.error(`[FileChunkReader] Error reading chunk ${index}:`, error);
      throw error;
    } finally {
      this.activeReads--;
    }
  }
  
  /**
   * 메모리 해제 등 정리 작업이 필요할 때 호출
   */
  cleanup() {
    // File 객체 자체는 JS GC가 처리하지만,
    // 만약 FileReader 등을 캐싱하고 있다면 여기서 null 처리합니다.
    this.activeReads = 0;
  }
  
  // ... (기존 Getters: getTotalChunks, getFileSize 등 그대로 유지) ...
  
  getTotalChunks(): number {
    return Math.ceil(this.file.size / this.chunkSize);
  }

  getFileSize(): number {
    return this.file.size;
  }

  getFileName(): string {
    return this.file.name;
  }

  getFileType(): string {
    return this.file.type;
  }

  /**
   * 현재 활성 읽기 작업 수를 반환합니다
   * @returns 현재 활성 읽기 작업 수
   */
  getActiveReadsCount(): number {
    return this.activeReads;
  }
}