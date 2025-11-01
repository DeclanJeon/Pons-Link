// src/lib/reliableTransfer.ts

interface ChunkMetadata {
  index: number;
  attempts: number;
  lastAttempt: number;
  checksum: string;
}

export class ReliableTransfer {
  private failedChunks = new Map<number, ChunkMetadata>();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1초

  async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  markChunkFailed(chunkIndex: number) {
    const existing = this.failedChunks.get(chunkIndex);
    
    if (existing) {
      existing.attempts++;
      existing.lastAttempt = Date.now();
    } else {
      this.failedChunks.set(chunkIndex, {
        index: chunkIndex,
        attempts: 1,
        lastAttempt: Date.now(),
        checksum: '',
      });
    }
  }

  shouldRetry(chunkIndex: number): boolean {
    const metadata = this.failedChunks.get(chunkIndex);
    if (!metadata) return false;

    const timeSinceLastAttempt = Date.now() - metadata.lastAttempt;
    return (
      metadata.attempts < this.MAX_RETRIES &&
      timeSinceLastAttempt >= this.RETRY_DELAY
    );
  }

  async verifyChunk(data: ArrayBuffer, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
}