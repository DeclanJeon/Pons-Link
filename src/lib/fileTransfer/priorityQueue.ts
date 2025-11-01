// src/lib/priorityQueue.ts

interface TransferTask {
  id: string;
  file: File;
  priority: number; // 0 (highest) ~ 10 (lowest)
  createdAt: number;
}

export class TransferPriorityQueue {
  private queue: TransferTask[] = [];

  enqueue(task: TransferTask) {
    this.queue.push(task);
    this.queue.sort((a, b) => {
      // 우선순위가 같으면 먼저 들어온 순서
      if (a.priority === b.priority) {
        return a.createdAt - b.createdAt;
      }
      return a.priority - b.priority;
    });
  }

  dequeue(): TransferTask | undefined {
    return this.queue.shift();
  }

  peek(): TransferTask | undefined {
    return this.queue[0];
  }

  remove(taskId: string) {
    this.queue = this.queue.filter(task => task.id !== taskId);
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}