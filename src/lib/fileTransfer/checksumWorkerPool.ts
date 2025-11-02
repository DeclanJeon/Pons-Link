/**
 * 병렬 체크섬 계산 풀
 * 여러 Web Worker를 풀로 관리하여 체크섬 계산을 병렬화합니다.
 */

// 체크섬 계산용 Worker 코드
const checksumWorkerCode = `
  self.onmessage = async function(e) {
    const { id, chunk } = e.data;
    
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', chunk);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      self.postMessage({
        id,
        success: true,
        checksum
      });
    } catch (error) {
      self.postMessage({
        id,
        success: false,
        error: error.message
      });
    }
  };
`;

interface ChecksumTask {
  id: string;
  chunk: ArrayBuffer;
  resolve: (checksum: string) => void;
  reject: (error: Error) => void;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  pendingResolve?: ((checksum: string) => void) | null;
}

export class ChecksumWorkerPool {
  private workers: WorkerInstance[] = [];
  private queue: ChecksumTask[] = [];
  private readonly POOL_SIZE: number;
  private taskId = 0;
  
  constructor(poolSize?: number) {
    // 하드웨어 동시성에 따라 풀 크기 결정 (최소 2, 최대 8)
    this.POOL_SIZE = Math.min(
      Math.max(2, navigator.hardwareConcurrency || 4),
      8
    );
    
    this.initializeWorkers();
  }
  
  /**
   * Worker 풀 초기화
   */
  private initializeWorkers() {
    const blob = new Blob([checksumWorkerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (e) => {
        const { id, success, checksum, error } = e.data;
        this.handleWorkerResult(i, id, success, checksum, error);
      };
      
      worker.onerror = (error) => {
        console.error(`[ChecksumWorkerPool] Worker ${i} error:`, error);
      };
      
      this.workers.push({
        worker,
        busy: false
      });
    }
    
    console.log(`[ChecksumWorkerPool] Initialized with ${this.POOL_SIZE} workers`);
  }
  
  /**
   * Worker 결과 처리
   */
  private handleWorkerResult(
    workerIndex: number,
    taskId: string,
    success: boolean,
    checksum: string | undefined,
    error: string | undefined
  ) {
    const worker = this.workers[workerIndex];
    worker.busy = false;
    
    // 큐에서 다음 작업 처리
    this.processQueue();
    
    // 결과 찾아서 처리
    const taskIndex = this.queue.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;
    
    const task = this.queue[taskIndex];
    this.queue.splice(taskIndex, 1);
    
    if (success && checksum) {
      task.resolve(checksum);
    } else {
      task.reject(new Error(error || 'Unknown checksum error'));
    }
  }
  
  /**
   * 큐에서 다음 작업 처리
   */
  private processQueue() {
    if (this.queue.length === 0) return;
    
    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;
    
    const task = this.queue[0];
    availableWorker.busy = true;
    
    availableWorker.worker.postMessage({
      id: task.id,
      chunk: task.chunk
    }, [task.chunk]); // Transferable 객체로 전달하여 메모리 효율화
  }
  
  /**
   * 체크섬 계산 요청
   */
  async calculateChecksum(chunk: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const task: ChecksumTask = {
        id: `checksum-${++this.taskId}-${Date.now()}`,
        chunk,
        resolve,
        reject
      };
      
      this.queue.push(task);
      this.processQueue();
    });
  }
  
  /**
   * 여러 청크의 체크섬을 병렬로 계산
   */
  async calculateMultipleChecksums(chunks: ArrayBuffer[]): Promise<string[]> {
    const promises = chunks.map(chunk => this.calculateChecksum(chunk));
    return Promise.all(promises);
  }
  
  /**
   * 풀 상태 정보
   */
  getStatus() {
    return {
      poolSize: this.POOL_SIZE,
      busyWorkers: this.workers.filter(w => w.busy).length,
      availableWorkers: this.workers.filter(w => !w.busy).length,
      queueLength: this.queue.length
    };
  }
  
  /**
   * 리소스 정리
   */
  cleanup() {
    this.workers.forEach(({ worker }) => {
      worker.terminate();
    });
    this.workers = [];
    this.queue = [];
    console.log('[ChecksumWorkerPool] Cleaned up');
  }
}

// 싱글톤 인스턴스
let checksumWorkerPool: ChecksumWorkerPool | null = null;

export function getChecksumWorkerPool(): ChecksumWorkerPool {
  if (!checksumWorkerPool) {
    checksumWorkerPool = new ChecksumWorkerPool();
  }
  return checksumWorkerPool;
}

export function cleanupChecksumWorkerPool() {
  if (checksumWorkerPool) {
    checksumWorkerPool.cleanup();
    checksumWorkerPool = null;
  }
}