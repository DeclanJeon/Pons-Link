/**
 * LRU 청크 캐시 전략
 * 모든 청크를 캐시하는 대신, LRU(Least Recently Used) 알고리즘으로 
 * 제한된 수의 청크만 유지합니다.
 */

export interface CacheEntry {
  data: ArrayBuffer;
  lastUsed: number;
  accessCount: number;
  size: number;
}

export interface CacheStats {
  maxSize: number;
  currentSize: number;
  entryCount: number;
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  memoryUsage: number;
}

export class LRUChunkCache {
  private cache = new Map<number, CacheEntry>();
  private accessOrder: number[] = [];
  private totalRequests = 0;
  private totalHits = 0;
  private readonly MAX_CACHE_SIZE: number;
  private MAX_MEMORY_USAGE: number; // bytes
  private currentMemoryUsage = 0;
  
  constructor(
    maxEntries: number = 50,
    maxMemoryUsage: number = 50 * 1024 * 1024 // 50MB
  ) {
    this.MAX_CACHE_SIZE = maxEntries;
    this.MAX_MEMORY_USAGE = maxMemoryUsage;
    
    console.log(`[LRUChunkCache] Initialized:`, {
      maxEntries,
      maxMemoryUsage: this.formatBytes(maxMemoryUsage)
    });
  }
  
  /**
   * 청크 캐시에 추가
   */
  set(index: number, data: ArrayBuffer): void {
    this.totalRequests++;
    
    // 기존 엔트리가 있으면 업데이트
    if (this.cache.has(index)) {
      this.updateExistingEntry(index, data);
      return;
    }
    
    // 캐시 크기 초과 시 LRU 제거
    while (this.shouldEvict()) {
      this.evictLRU();
    }
    
    // 새 엔트리 추가
    const entry: CacheEntry = {
      data: data.slice(0), // 복사본 저장
      lastUsed: Date.now(),
      accessCount: 1,
      size: data.byteLength
    };
    
    this.cache.set(index, entry);
    this.accessOrder.push(index);
    this.currentMemoryUsage += data.byteLength;
    
    console.log(`[LRUChunkCache] Added chunk ${index}:`, {
      size: this.formatBytes(data.byteLength),
      totalEntries: this.cache.size,
      memoryUsage: this.formatBytes(this.currentMemoryUsage)
    });
  }
  
  /**
   * 청크 캐시에서 가져오기
   */
  get(index: number): ArrayBuffer | null {
    this.totalRequests++;
    
    const entry = this.cache.get(index);
    if (!entry) {
      return null;
    }
    
    // 캐시 히트
    this.totalHits++;
    entry.lastUsed = Date.now();
    entry.accessCount++;
    
    // 접근 순서 업데이트
    this.updateAccessOrder(index);
    
    // 데이터 복사본 반환 (원본 보호)
    return entry.data.slice(0);
  }
  
  /**
   * 청크 캐시에서 제거
   */
  delete(index: number): boolean {
    const entry = this.cache.get(index);
    if (!entry) {
      return false;
    }
    
    this.cache.delete(index);
    this.removeFromAccessOrder(index);
    this.currentMemoryUsage -= entry.size;
    
    console.log(`[LRUChunkCache] Removed chunk ${index}:`, {
      freedMemory: this.formatBytes(entry.size),
      remainingEntries: this.cache.size,
      memoryUsage: this.formatBytes(this.currentMemoryUsage)
    });
    
    return true;
  }
  
  /**
   * ACK 받은 청크 즉시 제거
   */
  removeAcked(index: number): void {
    this.delete(index);
  }
  
  /**
   * 캐시 비우기
   */
  clear(): void {
    const entryCount = this.cache.size;
    const freedMemory = this.currentMemoryUsage;
    
    this.cache.clear();
    this.accessOrder = [];
    this.currentMemoryUsage = 0;
    
    console.log(`[LRUChunkCache] Cleared:`, {
      clearedEntries: entryCount,
      freedMemory: this.formatBytes(freedMemory)
    });
  }
  
  /**
   * 캐시 통계 반환
   */
  getStats(): CacheStats {
    return {
      maxSize: this.MAX_CACHE_SIZE,
      currentSize: this.cache.size,
      entryCount: this.cache.size,
      hitRate: this.totalRequests > 0 ? this.totalHits / this.totalRequests : 0,
      totalRequests: this.totalRequests,
      totalHits: this.totalHits,
      memoryUsage: this.currentMemoryUsage
    };
  }
  
  /**
   * 캐시 상세 정보
   */
  getDetailedInfo() {
    const entries = Array.from(this.cache.entries()).map(([index, entry]) => ({
      index,
      size: entry.size,
      accessCount: entry.accessCount,
      lastUsed: entry.lastUsed,
      age: Date.now() - entry.lastUsed
    }));
    
    return {
      stats: this.getStats(),
      entries: entries.sort((a, b) => b.lastUsed - a.lastUsed), // 최근 사용 순
      memoryEfficiency: this.currentMemoryUsage / this.MAX_MEMORY_USAGE,
      entryEfficiency: this.cache.size / this.MAX_CACHE_SIZE
    };
  }
  
  /**
   * 기존 엔트리 업데이트
   */
  private updateExistingEntry(index: number, data: ArrayBuffer): void {
    const entry = this.cache.get(index)!;
    const sizeDiff = data.byteLength - entry.size;
    
    // 데이터 업데이트
    entry.data = data.slice(0);
    entry.lastUsed = Date.now();
    entry.accessCount++;
    entry.size = data.byteLength;
    
    // 메모리 사용량 업데이트
    this.currentMemoryUsage += sizeDiff;
    
    // 접근 순서 업데이트
    this.updateAccessOrder(index);
    
    // 메모리 초과 시 LRU 제거
    while (this.shouldEvict()) {
      this.evictLRU();
    }
  }
  
  /**
   * 제거해야 하는지 확인
   */
  private shouldEvict(): boolean {
    return (
      this.cache.size >= this.MAX_CACHE_SIZE ||
      this.currentMemoryUsage >= this.MAX_MEMORY_USAGE
    );
  }
  
  /**
   * LRU 엔트리 제거
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    // 가장 오래전에 접근한 엔트리 찾기
    let lruIndex = this.accessOrder[0];
    let lruTime = this.cache.get(lruIndex)!.lastUsed;
    
    for (let i = 1; i < this.accessOrder.length; i++) {
      const index = this.accessOrder[i];
      const entry = this.cache.get(index)!;
      
      if (entry.lastUsed < lruTime) {
        lruTime = entry.lastUsed;
        lruIndex = index;
      }
    }
    
    // LRU 엔트리 제거
    const entry = this.cache.get(lruIndex)!;
    this.cache.delete(lruIndex);
    this.removeFromAccessOrder(lruIndex);
    this.currentMemoryUsage -= entry.size;
    
    console.log(`[LRUChunkCache] Evicted LRU chunk ${lruIndex}:`, {
      size: this.formatBytes(entry.size),
      accessCount: entry.accessCount,
      age: Date.now() - entry.lastUsed
    });
  }
  
  /**
   * 접근 순서 업데이트
   */
  private updateAccessOrder(index: number): void {
    this.removeFromAccessOrder(index);
    this.accessOrder.push(index);
  }
  
  /**
   * 접근 순서에서 제거
   */
  private removeFromAccessOrder(index: number): void {
    const pos = this.accessOrder.indexOf(index);
    if (pos !== -1) {
      this.accessOrder.splice(pos, 1);
    }
  }
  
  /**
   * 바이트 크기 포맷
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * 캐시 최적화
   */
  optimize(): void {
    // 접근 횟수가 낮은 엔트리 제거
    const entries = Array.from(this.cache.entries());
    const avgAccessCount = entries.reduce((sum, [, entry]) => sum + entry.accessCount, 0) / entries.length;
    
    for (const [index, entry] of entries) {
      if (entry.accessCount < avgAccessCount * 0.5 && this.cache.size > this.MAX_CACHE_SIZE * 0.7) {
        this.delete(index);
      }
    }
    
    console.log(`[LRUChunkCache] Optimized:`, this.getStats());
  }
  
  /**
   * 메모리 압박 시 캐시 크기 조정
   */
  adjustMemoryPressure(newMaxMemory: number): void {
    this.MAX_MEMORY_USAGE = newMaxMemory;
    
    // 새 제한에 맞게 캐시 정리
    while (this.currentMemoryUsage > this.MAX_MEMORY_USAGE && this.cache.size > 0) {
      this.evictLRU();
    }
    
    console.log(`[LRUChunkCache] Memory pressure adjusted:`, {
      newMaxMemory: this.formatBytes(newMaxMemory),
      currentUsage: this.formatBytes(this.currentMemoryUsage)
    });
  }
}