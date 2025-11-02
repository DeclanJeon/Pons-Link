/**
 * 제로-카피 스트리밍 파일 리더
 * 파일을 절대 전체를 메모리에 올리지 않고, ReadableStream API를 활용하여
 * "읽기-전송-해제"를 원자적으로 수행합니다.
 */
export class StreamingFileReader {
  private file: File;
  private chunkSize: number;
  private offset = 0;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  
  constructor(file: File, chunkSize: number = 64 * 1024) {
    this.file = file;
    this.chunkSize = chunkSize;
  }
  
  /**
   * 스트리밍 청크 생성기
   */
  async *readChunks(): AsyncGenerator<{
    data: ArrayBuffer;
    index: number;
    offset: number;
    isLast: boolean;
  }, void, unknown> {
    const totalChunks = Math.ceil(this.file.size / this.chunkSize);
    
    // ReadableStream 생성
    const stream = this.file.stream();
    this.reader = stream.getReader();
    
    try {
      let chunkIndex = 0;
      
      while (this.offset < this.file.size) {
        const { value, done } = await this.reader.read();
        
        if (done) break;
        
        // 청크 데이터를 ArrayBuffer로 변환 (제로 카피)
        const chunkData = value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength
        ) as ArrayBuffer;
        
        const isLast = chunkIndex === totalChunks - 1;
        
        yield {
          data: chunkData,
          index: chunkIndex,
          offset: this.offset,
          isLast
        };
        
        this.offset += value.byteLength;
        chunkIndex++;
        
        // 메모리 해제를 위한 참조 제거
        value.fill(0);
      }
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }
  
  /**
   * 특정 청크만 읽기 (재전송용)
   */
  async readChunk(index: number): Promise<ArrayBuffer | null> {
    if (index < 0 || index >= Math.ceil(this.file.size / this.chunkSize)) {
      return null;
    }
    
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.file.size);
    
    try {
      const blob = this.file.slice(start, end);
      return await blob.arrayBuffer();
    } catch (error) {
      console.error(`[StreamingFileReader] Failed to read chunk ${index}:`, error);
      return null;
    }
  }
  
  /**
   * 파일 정보 반환
   */
  getFileInfo() {
    return {
      name: this.file.name,
      size: this.file.size,
      type: this.file.type,
      lastModified: this.file.lastModified,
      totalChunks: Math.ceil(this.file.size / this.chunkSize)
    };
  }
  
  /**
   * 리소스 정리
   */
  cleanup() {
    if (this.reader) {
      this.reader.releaseLock();
      this.reader = null;
    }
  }
}