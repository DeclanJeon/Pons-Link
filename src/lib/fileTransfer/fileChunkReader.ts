/**
 * FileChunkReader - 메인 스레드에서 안전하게 파일 청크를 읽는 클래스
 * NotReadableError를 방지하기 위해 동시 읽기를 제어합니다
 */
export class FileChunkReader {
  private file: File;
  private chunkSize: number;
  private readingChunks = new Set<number>();
  
  constructor(file: File, chunkSize: number) {
    this.file = file;
    this.chunkSize = chunkSize;
  }
  
  /**
   * 지정된 인덱스의 청크를 읽습니다
   * @param index 읽을 청크의 인덱스
   * @returns 청크 데이터를 포함하는 ArrayBuffer
   */
  async readChunk(index: number): Promise<ArrayBuffer> {
    // 중복 읽기 방지
    if (this.readingChunks.has(index)) {
      throw new Error(`Chunk ${index} is already being read`);
    }
    
    this.readingChunks.add(index);
    
    try {
      const start = index * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      
      // slice는 안전 (메모리 복사 없음)
      const blob = this.file.slice(start, end);
      
      // 작은 청크만 읽으므로 안전
      const arrayBuffer = await blob.arrayBuffer();
      
      return arrayBuffer;
    } finally {
      this.readingChunks.delete(index);
    }
  }
  
  /**
   * 전체 청크 수를 반환합니다
   * @returns 전체 청크 수
   */
  getTotalChunks(): number {
    return Math.ceil(this.file.size / this.chunkSize);
  }
  
  /**
   * 파일 크기를 반환합니다
   * @returns 파일 크기 (바이트)
   */
  getFileSize(): number {
    return this.file.size;
  }
  
  /**
   * 파일 이름을 반환합니다
   * @returns 파일 이름
   */
  getFileName(): string {
    return this.file.name;
  }
  
  /**
   * 파일 타입을 반환합니다
   * @returns 파일 MIME 타입
   */
  getFileType(): string {
    return this.file.type;
  }
  
  /**
   * 현재 읽고 있는 청크 수를 반환합니다
   * @returns 현재 읽고 있는 청크 수
   */
  getReadingChunksCount(): number {
    return this.readingChunks.size;
  }
}